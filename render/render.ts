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
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

import { bakeComposition } from '@/lib/render/bake';
import { cleanEnv } from '@/lib/env';
import { BACKGROUNDS } from '@/lib/theme/options';
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
  const appKey = cleanEnv('YVP_APP_KEY');
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

  // V2 visuals: localize remote hero images (CC0 photo / AI image) into the
  // bundle so the offline render never fetches. Icons already travel inline
  // as SVG markup. A failed download drops the item — a short must render
  // even when an image host is gone.
  const visuals = spec.visuals as
    | { items?: Array<{ kind?: string; svg?: string; src?: string }> }
    | undefined;
  if (visuals?.items?.length) {
    let visualIndex = 0;
    for (const item of visuals.items) {
      if (!item.src) continue;
      // Bundled art (cliparts, doodle panels) travels as a root-relative
      // path; the bundle itself is served from file://, so make it plain
      // relative instead.
      if (item.src.startsWith('/')) {
        const relative = item.src.slice(1);
        // The doodle library is ~18 MB across 61 panels and a short uses
        // exactly one, so copy the one rather than the folder — the whole
        // library in every render bundle is bandwidth and disk for nothing.
        if (relative.startsWith('doodles/')) {
          const from = join(ROOT, 'public', relative);
          if (existsSync(from)) {
            const to = join(workdir, relative);
            mkdirSync(dirname(to), { recursive: true });
            cpSync(from, to);
            console.log(`visual      ${relative} (bundled doodle panel)`);
          } else {
            console.warn(`visual      dropped (missing): ${relative}`);
            item.src = '';
            continue;
          }
        }
        item.src = relative;
        continue;
      }
      if (!/^https?:\/\//i.test(item.src)) continue;
      visualIndex += 1;
      const ext =
        item.src.split('?')[0].match(/\.(png|jpe?g|webp|gif)$/i)?.[1] ?? 'jpg';
      const name = `visual-${visualIndex}.${ext.toLowerCase()}`;
      try {
        const response = await fetch(item.src, {
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        writeFileSync(
          join(workdir, name),
          Buffer.from(await response.arrayBuffer()),
        );
        console.log(`visual      ${name} <- ${item.src.slice(0, 80)}`);
        item.src = name;
      } catch (error) {
        console.warn(
          `visual      dropped (${error instanceof Error ? error.message : error}): ${item.src.slice(0, 80)}`,
        );
        item.src = '';
      }
    }
    visuals.items = visuals.items.filter((i) => i.svg || i.src);
  }

  // Assets are copied INTO the workdir and referenced with plain relative
  // paths. "../../public/" traversal renders locally but the HyperFrames
  // producer rewrites asset paths against each composition root, and its
  // linter flags traversal as a real hazard — self-contained is also simply
  // the right shape for a render bundle.
  copyFonts(workdir, String(spec.script ?? 'latin'));
  for (const dir of ['music', 'cliparts']) {
    const src = join(ROOT, 'public', dir);
    if (existsSync(src)) cpSync(src, join(workdir, dir), { recursive: true });
  }

  // Backgrounds are copied one file deep rather than wholesale. The library is
  // 34 video loops and 18 images and a short uses exactly one of them, so
  // copying the folder put ~35 MB into every bundle to use half a megabyte of
  // it — paid for again on every sandbox upload and every Actions run.
  const themeBackground = (spec.theme as { backgroundId?: string } | undefined)?.backgroundId;
  const background = BACKGROUNDS.find((b) => b.id === themeBackground) ?? BACKGROUNDS[1];
  if (background?.src) {
    const relative = background.src.replace(/^\//, '');
    const from = join(ROOT, 'public', relative);
    if (existsSync(from)) {
      const to = join(workdir, relative);
      mkdirSync(dirname(to), { recursive: true });
      cpSync(from, to);
      console.log(`background  ${relative}`);
    } else {
      // The composition falls back to its plain ground rather than failing;
      // a missing texture is not worth refusing to render a verified short.
      console.warn(`background  MISSING ${relative} — rendering without it`);
    }
  }

  // public/vendor is generated, not committed: on a fresh checkout (CI) it
  // does not exist, so the runtime comes straight from node_modules.
  mkdirSync(join(workdir, 'vendor'), { recursive: true });
  const vendoredGsap = join(ROOT, 'public', 'vendor', 'gsap.min.js');
  cpSync(
    existsSync(vendoredGsap)
      ? vendoredGsap
      : join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
    join(workdir, 'vendor', 'gsap.min.js'),
  );

  const html = bakeComposition({
    template: readFileSync(templatePath, 'utf8'),
    spec,
    audioSrc,
    assetPrefix: '',
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

    // Teaching-format specs never display the verse — the narration teaches
    // and the short cites the source. There the DOM check inverts: the
    // gate-marked node must be EMPTY, so nothing on screen masquerades as
    // Scripture. Provenance is the spec-vs-API diff above, which already ran.
    const narrSegments = (spec.narration as { segments?: Array<{ kind?: string }> } | undefined)
      ?.segments ?? [];
    const displaysVerse = narrSegments.some((s) => s.kind === 'verse');

    if (!displaysVerse) {
      if (rendered.trim() !== '') {
        console.error('\nSCRIPTURE INTEGRITY CHECK FAILED\n');
        fail(
          'This teaching-format spec displays no verse, but the gate-marked ' +
            'node is not empty. Refusing to render unverified verse text.',
        );
      }
      console.log(
        'verified    teaching format: no verse displayed; spec passage ' +
          (authoritative ? 'matched the live API response' : 'is fixture content (UNVERIFIED)'),
      );
    } else {
      // Compare against the API response where we have one; only fixture
      // renders fall back to the spec, and those are already flagged
      // unverified above.
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
    }

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

/**
 * Copy the webfonts this short can actually use into the bundle.
 *
 * `public/fonts` carries a face for every script in the registry, and the CJK
 * families are 19 MB of that on their own — a Telugu short has no use for
 * 124 Japanese subsets, and copying them costs disk and upload on every render.
 *
 * `fonts.css` is copied whole and unmodified: it is a stack of `@font-face`
 * rules discriminated by `unicode-range`, and a rule whose file is absent is
 * simply never matched. Editing the stylesheet per render would make the
 * bundle's CSS differ from the app's, and "preview and export consume
 * byte-identical HTML" is the one property this pipeline is built on.
 */
function copyFonts(workdir: string, script: string): void {
  const from = join(ROOT, 'public', 'fonts');
  const to = join(workdir, 'fonts');
  mkdirSync(to, { recursive: true });

  const CJK: Record<string, string> = {
    notoserifsc: 'han',
    notoserifjp: 'han',
    notoserifkr: 'hangul',
  };

  let copied = 0;
  let bytes = 0;
  for (const file of readdirSync(from)) {
    const slug = file.replace(/-\d+\.woff2$/, '');
    const needs = CJK[slug];
    if (needs && needs !== script) continue;
    cpSync(join(from, file), join(to, file));
    copied += 1;
    bytes += statSync(join(from, file)).size;
  }
  console.log(
    `fonts       ${copied} files, ${(bytes / 1024 / 1024).toFixed(1)} MB ` +
      `(script: ${script})`,
  );
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
