/**
 * Render a ShortSpec to MP4.
 *
 *   npm run render -- --spec samples/en-prodigal-hook.json
 *
 * Order of operations is the whole point:
 *
 *   1. bake the spec into the frozen template
 *   2. RE-FETCH the passage from YouVersion, independently of the spec
 *   3. open the baked page in a real browser
 *   4. read the verse back OUT OF THE DOM and diff it against that fresh fetch
 *   5. only then capture frames
 *
 * Step 2 is not redundant, it is the entire guarantee. An earlier version of
 * this file compared the rendered DOM against `spec.passage.text` — but the
 * spec is precisely the artifact an attacker, a buggy pipeline stage, or a
 * careless hand-edit would modify. Comparing a file against itself always
 * passes: a tampered spec rendered a tampered verse, the check agreed with
 * itself, and an MP4 shipped.
 *
 * So the render asks YouVersion again, using the version id and USFM the spec
 * claims, and diffs the DOM against THAT. The only text that can reach a frame
 * is text the API served at render time.
 *
 * The gate fails CLOSED. No app key, no network, or a passage that no longer
 * resolves all refuse the render rather than falling back to the spec.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

import { bakeComposition } from '@/lib/render/bake';
import { verifyVerbatim } from '@/lib/verify/verbatim';

const ROOT = process.cwd();

interface Args {
  spec: string;
  out?: string;
  quality: string;
  fps: number;
  /**
   * Render content whose passage cannot be re-fetched — offline fixtures used
   * for the demo gallery. The render is then explicitly marked unverified in
   * its own output, because an unverifiable short must never be presentable as
   * a verified one.
   */
  allowUnverified: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { quality: 'high', fps: 30, allowUnverified: false };
  for (let i = 2; i < argv.length; i += 1) {
    const [key, inline] = argv[i].split('=');
    const next = () => inline ?? argv[++i];
    if (key === '--spec') args.spec = next();
    else if (key === '--out') args.out = next();
    else if (key === '--quality') args.quality = next();
    else if (key === '--fps') args.fps = Number(next());
    else if (key === '--allow-unverified') args.allowUnverified = true;
    else if (key.startsWith('--')) throw new Error(`Unknown option ${key}`);
  }
  if (!args.spec) throw new Error('--spec is required');
  return args as Args;
}

/**
 * Ask YouVersion for the passage again, independently of the spec.
 *
 * Returns null only when the passage genuinely cannot be retrieved. Callers
 * must treat null as a refusal, never as permission to trust the spec.
 */
async function refetchPassage(
  versionId: number,
  usfm: string,
): Promise<string | null> {
  const appKey = process.env.YVP_APP_KEY;
  if (!appKey) return null;

  const url = `https://api.youversion.com/v1/bibles/${versionId}/passages/${encodeURIComponent(
    usfm,
  )}?format=text&include_headings=false&include_notes=false`;

  try {
    const response = await fetch(url, {
      headers: { 'X-YVP-App-Key': appKey, Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { content?: string };
    return typeof json.content === 'string' && json.content.length > 0
      ? json.content
      : null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);

  const spec = JSON.parse(readFileSync(resolve(args.spec), 'utf8')) as Record<
    string,
    unknown
  >;
  const style = String(spec.style ?? 'warm-minimal');
  const id = String(spec.id ?? basename(args.spec, '.json'));
  const passage = spec.passage as {
    text: string;
    reference: string;
    usfm: string;
    versionId: number;
    versionAbbreviation: string;
  };

  const templatePath = join(ROOT, 'templates', style, 'index.html');
  if (!existsSync(templatePath)) fail(`Template "${style}" not found.`);

  // 1. bake ---------------------------------------------------------------
  const workdir = join(ROOT, '.render', id);
  mkdirSync(workdir, { recursive: true });

  const narration = spec.narration as { audioUrl?: string } | undefined;
  let audioSrc = '';

  // Narration travels as a file beside the composition. A data URI works in
  // preview but bloats the page the renderer has to parse.
  if (narration?.audioUrl?.startsWith('data:audio')) {
    const base64 = narration.audioUrl.split(',')[1] ?? '';
    writeFileSync(join(workdir, 'narration.wav'), Buffer.from(base64, 'base64'));
    audioSrc = 'narration.wav';
    spec.narration = { ...narration, audioUrl: audioSrc };
  }

  const html = bakeComposition({
    template: readFileSync(templatePath, 'utf8'),
    spec,
    audioSrc,
    // The workdir sits at <root>/.render/<id>, so public/ is two levels up.
    assetPrefix: '../../public/',
  });

  const indexPath = join(workdir, 'index.html');
  writeFileSync(indexPath, html, 'utf8');
  console.log(`baked       ${indexPath}`);

  // 2. re-fetch the passage, independently of the spec ---------------------
  const authoritative = await refetchPassage(
    Number(passage.versionId),
    String(passage.usfm),
  );

  if (authoritative === null && !args.allowUnverified) {
    fail(
      `Could not re-fetch ${passage.reference} (version ${passage.versionId}, ` +
        `${passage.usfm}) from YouVersion.\n` +
        'The integrity gate compares the rendered verse against a fresh API\n' +
        'response, never against the spec — so without that response there is\n' +
        'nothing to verify against. Set YVP_APP_KEY, or pass --allow-unverified\n' +
        'to render offline fixture content (which will be marked unverified).',
    );
  }

  if (authoritative === null) {
    console.warn(
      'UNVERIFIED  no API response available; rendering fixture content.\n' +
        '            This short must not be presented as verified.',
    );
  } else if (verifyVerbatim(passage.text, authoritative).ok) {
    console.log('refetched   spec passage matches the live YouVersion response');
  } else {
    console.error('\nSPEC TAMPERING DETECTED\n');
    console.error(verifyVerbatim(passage.text, authoritative).message);
    fail(
      "The spec's passage text does not match what YouVersion serves for " +
        `${passage.reference}. Refusing to render.`,
    );
  }

  // 3 + 4. verify the RENDERED DOM against the authoritative text -----------
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(`file://${indexPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });

    const rendered = await page.evaluate(() => {
      const node = document.querySelector('[data-verse-text]');
      return node ? (node.textContent ?? '') : null;
    });

    if (rendered === null) {
      fail(
        'No [data-verse-text] element in the rendered page. The gate cannot ' +
          'verify this composition, so it will not be rendered.',
      );
    }

    // Compare against the API response where we have one; only fixture renders
    // fall back to the spec, and those are already flagged unverified above.
    const result = verifyVerbatim(rendered, authoritative ?? passage.text);
    if (!result.ok) {
      console.error('\nSCRIPTURE INTEGRITY CHECK FAILED\n');
      console.error(result.message);
      fail('Refusing to render altered Scripture.');
    }
    console.log(
      `verified    ${result.message}` +
        (authoritative ? ' (against a live API response)' : ' (fixture, UNVERIFIED)'),
    );

    // On-screen attribution was dropped by product decision (the shorts carry
    // the reference, not a copyright block); the version and copyright still
    // travel in the spec and the gallery manifest, so provenance is never lost.

    // The renderer trusts data-duration; confirm the bake actually set it.
    const duration = await page.evaluate(() =>
      Number(document.getElementById('short')?.getAttribute('data-duration')),
    );
    console.log(`duration    ${duration}s`);
    if (!Number.isFinite(duration) || duration <= 1) {
      fail(`Composition declares an implausible duration (${duration}s).`);
    }
  } finally {
    await browser.close();
  }

  // 4. capture -------------------------------------------------------------
  const out = resolve(args.out ?? join(ROOT, 'renders', `${id}.mp4`));
  mkdirSync(dirname(out), { recursive: true });

  const cliArgs = [
    '--yes',
    'hyperframes@latest',
    'render',
    workdir,
    '--output',
    out,
    '--resolution',
    'portrait',
    '--quality',
    args.quality,
    '--fps',
    String(args.fps),
  ];

  console.log(`\nrendering   npx ${cliArgs.join(' ')}\n`);
  const code = await run('npx', cliArgs);
  if (code !== 0) fail(`hyperframes render exited ${code}`);

  console.log(`\nrendered    ${out}`);
}

function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', (code) => resolvePromise(code ?? 1));
  });
}

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
