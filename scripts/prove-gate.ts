/**
 * Prove the Scripture integrity gate, end to end.
 *
 *   npm run prove:gate
 *
 * Takes a real spec, changes four words of the verse, and attempts to render
 * it. The render must refuse and produce no file.
 *
 * This exists because the unit tests prove the comparison function works, and
 * that is a weaker claim than it sounds. An earlier version of the renderer
 * passed every unit test while comparing the rendered verse against the spec
 * it had just baked — a tampered spec rendered a tampered verse, the check
 * agreed with itself, and an MP4 shipped. The gate only means something if it
 * compares against a fresh YouVersion response, and only this end-to-end run
 * demonstrates that it does.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = process.argv[2] ?? 'samples/en-prodigal-hook.json';
const WORK = 'samples/.gate-proof.json';
const OUT = 'renders/.gate-proof.mp4';

function run(command: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: process.platform === 'win32',
      env: process.env,
    });
    let output = '';
    child.stdout.on('data', (d) => (output += d.toString()));
    child.stderr.on('data', (d) => (output += d.toString()));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`No spec at ${SOURCE}. Run \`npm run samples\` first.`);
    process.exit(1);
  }

  const spec = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const original: string = spec.passage.text;

  // A plausible paraphrase — the kind of edit a model or a careless hand makes,
  // and one a reader would never notice on screen.
  const words = original.split(' ');
  const cut = Math.floor(words.length / 2);
  const tampered = [
    ...words.slice(0, cut),
    'and',
    'was',
    'moved',
    'with',
    'pity,',
    ...words.slice(cut + 4),
  ].join(' ');

  if (tampered === original) {
    console.error('Could not construct a tampered variant.');
    process.exit(1);
  }

  spec.passage.text = tampered;
  spec.id = 'gate-proof';

  mkdirSync('samples', { recursive: true });
  mkdirSync('renders', { recursive: true });
  rmSync(OUT, { force: true });
  writeFileSync(WORK, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

  console.log('Scripture integrity gate — end-to-end proof\n');
  console.log(`source spec : ${SOURCE}`);
  console.log(`passage     : ${spec.passage.reference} (${spec.passage.versionAbbreviation})`);
  console.log(`original    : …${original.slice(cut * 5, cut * 5 + 70)}…`);
  console.log(`tampered    : …${tampered.slice(cut * 5, cut * 5 + 70)}…`);
  console.log('\nattempting render of the tampered spec…\n');

  const { code, output } = await run('npx', [
    'tsx',
    '--env-file-if-exists=.env.local',
    'render/render.ts',
    '--spec',
    WORK,
    '--out',
    OUT,
    '--quality',
    'draft',
  ]);

  const refused = code !== 0;
  const noFile = !existsSync(OUT);
  const detected = /TAMPERING DETECTED|INTEGRITY CHECK FAILED/.test(output);

  for (const line of output.split('\n')) {
    if (/TAMPERING|INTEGRITY|difference|expected:|rendered:|Refusing/.test(line)) {
      console.log(`  ${line.trim()}`);
    }
  }

  rmSync(WORK, { force: true });

  console.log('\n-----------------------------------------');
  console.log(`  tampering detected : ${detected ? 'yes' : 'NO'}`);
  console.log(`  render refused     : ${refused ? 'yes' : 'NO'}`);
  console.log(`  no MP4 produced    : ${noFile ? 'yes' : 'NO'}`);
  console.log('-----------------------------------------');

  if (detected && refused && noFile) {
    console.log('\nPASS — altered Scripture cannot reach a frame.');
    process.exit(0);
  }

  console.error('\nFAIL — the gate let altered Scripture through.');
  rmSync(OUT, { force: true });
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
