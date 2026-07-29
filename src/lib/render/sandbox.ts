/**
 * MP4 rendering inside a Vercel Sandbox microVM — the alternate cloud render
 * backend, kept alongside the GitHub Actions job (see .github/workflows/
 * render.yml). Same compact render request, same scripts/render-request.ts,
 * same integrity gate; only the machine differs.
 *
 * The export API cannot wait minutes inside a serverless function, so the
 * sandbox job runs DETACHED: the route creates the VM, starts the job, and
 * returns. The job finishes by committing the MP4 + poster + manifest into
 * public/gallery with the same bot identity the Actions job uses, so the
 * gallery updates through the identical path. The VM halts itself when the
 * job script ends; the session timeout is only the hang backstop.
 *
 * Auth: on Vercel deployments the SDK authenticates via OIDC automatically;
 * locally set VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID.
 */

import { Sandbox } from '@vercel/sandbox';
import { cleanEnv } from '@/lib/env';

/** Hang backstop. A typical short renders in well under this. */
const SESSION_TIMEOUT_MS = 20 * 60 * 1000;

/** Chromium's system libraries on the sandbox image (Amazon Linux, dnf). */
const CHROMIUM_DEPS = [
  'nss', 'nspr', 'libxkbcommon', 'atk', 'at-spi2-atk', 'at-spi2-core',
  'libXcomposite', 'libXdamage', 'libXrandr', 'libXfixes', 'libXcursor',
  'libXi', 'libXtst', 'libXScrnSaver', 'libXext', 'mesa-libgbm', 'libdrm',
  'mesa-libGL', 'mesa-libEGL', 'cups-libs', 'alsa-lib', 'pango', 'cairo',
  'gtk3', 'dbus-libs',
];

export function sandboxConfigured(): boolean {
  return Boolean(
    process.env.VERCEL_OIDC_TOKEN ||
      (cleanEnv('VERCEL_TOKEN') && cleanEnv('VERCEL_TEAM_ID') && cleanEnv('VERCEL_PROJECT_ID')),
  );
}

function credentials() {
  const token = cleanEnv('VERCEL_TOKEN');
  const teamId = cleanEnv('VERCEL_TEAM_ID');
  const projectId = cleanEnv('VERCEL_PROJECT_ID');
  return token && teamId && projectId ? { token, teamId, projectId } : {};
}

/**
 * The whole job as one shell script, so it can run detached after the HTTP
 * response has already gone out. Mirrors .github/workflows/render.yml step
 * for step; ffmpeg comes from static npm builds because the sandbox image's
 * dnf repos do not carry it.
 */
function jobScript(repo: string): string {
  return `#!/bin/bash
set -euo pipefail
cd /vercel/sandbox
echo "== install system deps"
sudo dnf install -y --skip-broken ${CHROMIUM_DEPS.join(' ')} >/dev/null
sudo ldconfig
echo "== npm ci"
npm ci --no-audit --no-fund
echo "== render browser"
npx playwright install chromium --only-shell
echo "== static ffmpeg"
npm install --no-save --no-audit --no-fund ffmpeg-static ffprobe-static
sudo ln -sf /vercel/sandbox/node_modules/ffmpeg-static/ffmpeg /usr/local/bin/ffmpeg
sudo ln -sf "$(node -e "console.log(require('ffprobe-static').path)")" /usr/local/bin/ffprobe
echo "== piper (best effort; English uses Speechmatics)"
pip3 install --quiet piper-tts || echo "piper unavailable; non-English narration falls back to estimated timings"
echo "== render"
npx tsx scripts/render-request.ts --request request.json
if [ -n "\${GITHUB_PUSH_TOKEN:-}" ]; then
  echo "== push gallery entry"
  git config user.name "scriptorium-render-bot"
  git config user.email "render@scriptorium.invalid"
  git add public/gallery
  if git diff --cached --quiet; then
    echo "nothing to commit"
  else
    git commit -m "gallery: rendered short via sandbox [skip ci]"
    git pull --rebase "https://x-access-token:\${GITHUB_PUSH_TOKEN}@github.com/${repo}.git" master
    git push "https://x-access-token:\${GITHUB_PUSH_TOKEN}@github.com/${repo}.git" HEAD:master
  fi
else
  echo "no GITHUB_PUSH_TOKEN; render kept inside the sandbox only"
fi
echo "== done"
sudo halt || true
`;
}

export interface PreparedSandboxRender {
  sandbox: Sandbox;
  env: Record<string, string>;
}

/**
 * Create the VM from the public repo and stage request.json + the job script.
 * Callers own the compact request shape (same one the Actions dispatch
 * carries) and choose attached (CLI) or detached (export API) execution.
 */
export async function prepareSandboxRender(
  request: Record<string, unknown>,
): Promise<PreparedSandboxRender> {
  const repo = cleanEnv('GITHUB_REPO') ?? 'phildani7/scriptorium';

  const sandbox = await Sandbox.create({
    ...credentials(),
    source: { type: 'git', url: `https://github.com/${repo}.git`, depth: 1 },
    runtime: 'node24',
    resources: { vcpus: 4 },
    timeout: SESSION_TIMEOUT_MS,
  });

  await sandbox.writeFiles([
    {
      path: 'request.json',
      content: Buffer.from(JSON.stringify(request, null, 2)),
    },
    { path: 'render-job.sh', content: Buffer.from(jobScript(repo)) },
  ]);

  const env: Record<string, string> = {};
  for (const key of ['YVP_APP_KEY', 'SPEECHMATICS_API_KEY'] as const) {
    const value = cleanEnv(key);
    if (value) env[key] = value;
  }
  // The Actions dispatch token already has repo write; reuse it for the push.
  const pushToken = cleanEnv('GITHUB_DISPATCH_TOKEN');
  if (pushToken) env.GITHUB_PUSH_TOKEN = pushToken;

  return { sandbox, env };
}

/** Fire-and-forget launch for the export API: start the job, return the id. */
export async function launchSandboxRender(
  request: Record<string, unknown>,
): Promise<{ sandboxId: string }> {
  const { sandbox, env } = await prepareSandboxRender(request);
  await sandbox.runCommand({
    cmd: 'bash',
    args: ['render-job.sh'],
    env,
    detached: true,
  });
  return { sandboxId: sandbox.name };
}
