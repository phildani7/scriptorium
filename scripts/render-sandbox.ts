/**
 * Run one render request in a Vercel Sandbox from your machine and watch it.
 *
 *   npm run render:sandbox -- --request request.json
 *
 * Same job the export API launches detached; here it runs attached so the
 * whole log streams to your terminal, and the finished job pushes the gallery
 * entry exactly like the GitHub Actions runner does. Needs VERCEL_TOKEN +
 * VERCEL_TEAM_ID + VERCEL_PROJECT_ID in .env.local (OIDC replaces them on
 * deployments).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { prepareSandboxRender } from '@/lib/render/sandbox';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const requestPath = arg('--request');
  if (!requestPath) throw new Error('--request <file> is required');
  const request = JSON.parse(readFileSync(resolve(requestPath), 'utf8'));

  console.log('launching sandbox…');
  const { sandbox, env } = await prepareSandboxRender(request);
  console.log(`sandbox ${sandbox.name} running the job…`);

  try {
    const job = await sandbox.runCommand({
      cmd: 'bash',
      args: ['render-job.sh'],
      env,
    });
    console.log(await job.output('both'));
    if (job.exitCode !== 0) throw new Error(`render job exited ${job.exitCode}`);

    // Bring the MP4 home. With a push token the gallery commit carries it
    // anyway; without one this download is the deliverable.
    const id = String(request.id ?? 'short').replace(/[^\w.-]/g, '-');
    const remote = `/vercel/sandbox/renders/${id}.mp4`;
    try {
      const bytes = await sandbox.fs.readFile(remote);
      mkdirSync('renders', { recursive: true });
      const local = join('renders', `${id}.mp4`);
      writeFileSync(local, Buffer.from(bytes as Uint8Array));
      console.log(`downloaded  ${local} (${(bytes as Uint8Array).byteLength} bytes)`);
    } catch (error) {
      console.warn(`could not download ${remote}: ${error instanceof Error ? error.message : error}`);
    }
    console.log(
      'Done. With GITHUB_DISPATCH_TOKEN set the gallery entry was also pushed ' +
        'to the repo — `git pull` to see it.',
    );
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
