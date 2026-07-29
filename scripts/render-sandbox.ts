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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    console.log(
      'Done. With GITHUB_DISPATCH_TOKEN set the gallery entry was pushed to ' +
        'the repo — `git pull` to see it.',
    );
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
