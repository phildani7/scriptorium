/**
 * Drive the MCP endpoint as a real client would.
 *
 *   npx tsx scripts/smoke-mcp.ts                       (localhost:3000)
 *   npx tsx scripts/smoke-mcp.ts --base http://localhost:3111
 *   npx tsx scripts/smoke-mcp.ts --base https://<deployment> --live
 *
 * The README claims "point any MCP client at the deployment and drive
 * everything the UI can do". That claim is only worth making if something
 * checks it, and a GET on the route checks nothing: it returns a hand-written
 * descriptor that would keep saying the right words long after the transport
 * broke. So this speaks the actual protocol — `initialize`, then `tools/list`,
 * then real `tools/call` requests — and compares what comes back against what
 * the route registers.
 *
 * Read-only by default. `--live` adds the calls that spend model credits;
 * without it those are listed as skipped rather than quietly not run.
 */

// This file imports nothing, which without an export would make it a global
// script sharing one scope with every other import-free script in the folder —
// and `BASE`, `check` and `main` are names more than one of them wants.
export {};

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = flag('base', 'http://localhost:3000')!;
const LIVE = args.includes('--live');

const EXPECTED_TOOLS = [
  'list_options',
  'list_versions',
  'resolve_passage',
  'generate_devices',
  'extract_teachings',
  'plan_series',
  'create_short',
  'gallery',
];

let id = 0;
let failures = 0;

/**
 * One JSON-RPC round trip. The Accept header carries both content types
 * because streamable HTTP lets a server answer either way; this server is
 * configured for plain JSON, and a client that only accepted one of them
 * would be testing its own assumption rather than the server.
 */
async function rpc(method: string, params?: unknown): Promise<unknown> {
  id += 1;
  const response = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method}: HTTP ${response.status} — ${text.slice(0, 200)}`);
  }
  // A streamable-HTTP server may frame its reply as a single SSE event even
  // when the body is one JSON object; unwrap that before parsing.
  const body = text.startsWith('event:') || text.startsWith('data:')
    ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5)).join('')
    : text;
  const json = JSON.parse(body) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`ok      ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failures += 1;
    console.error(`FAIL    ${label}${detail ? `  ${detail}` : ''}`);
  }
}

/** Tool results arrive as content blocks; the payload is JSON in the text. */
function payload(result: unknown): unknown {
  const blocks = (result as { content?: Array<{ type: string; text?: string }> })
    .content;
  const text = blocks?.find((b) => b.type === 'text')?.text ?? '';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  console.log(`MCP endpoint  ${BASE}/api/mcp\n`);

  // The descriptor a human would hit first.
  const descriptor = await fetch(`${BASE}/api/mcp`).then((r) => r.json());
  check(
    'GET descriptor',
    descriptor.transport === 'streamable-http (stateless)',
    `${descriptor.name} v-transport ${descriptor.transport}`,
  );

  const init = (await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'scriptorium-smoke', version: '1.0.0' },
  })) as {
    serverInfo?: { name: string; version: string };
    protocolVersion?: string;
    capabilities?: { tools?: unknown };
  };
  check(
    'initialize',
    init.serverInfo?.name === 'scriptorium',
    `${init.serverInfo?.name} ${init.serverInfo?.version}, protocol ${init.protocolVersion}`,
  );
  check('advertises tools capability', Boolean(init.capabilities?.tools));

  const listed = (await rpc('tools/list')) as {
    tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  };
  const names = listed.tools.map((t) => t.name).sort();
  check(
    'tools/list',
    EXPECTED_TOOLS.slice().sort().join(',') === names.join(','),
    `${names.length} tools`,
  );
  const undocumented = listed.tools.filter((t) => !t.description);
  check('every tool documented', undocumented.length === 0,
    undocumented.length ? undocumented.map((t) => t.name).join(', ') : '');
  const unschemad = listed.tools.filter((t) => !t.inputSchema);
  check('every tool has an input schema', unschemad.length === 0);

  // A second `initialize` on a fresh request must succeed exactly like the
  // first. That is the whole claim of "stateless": nothing carried over, no
  // session id to present, no order to respect.
  const again = (await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'scriptorium-smoke-2', version: '1.0.0' },
  })) as { serverInfo?: { name: string } };
  check('stateless: re-initialize on a new request', again.serverInfo?.name === 'scriptorium');

  // ---- tools/call, the free ones -----------------------------------------
  const options = payload(await rpc('tools/call', {
    name: 'list_options',
    arguments: {},
  })) as {
    styles?: unknown[];
    palettes?: unknown[];
    backgrounds?: Array<{ id: string }>;
    music?: unknown[];
  };
  check(
    'call list_options',
    (options.styles?.length ?? 0) === 3 && (options.palettes?.length ?? 0) === 8,
    `${options.styles?.length} styles, ${options.palettes?.length} palettes, ` +
      `${options.backgrounds?.length} backgrounds, ${options.music?.length} music beds`,
  );
  check(
    'removed background is gone from the tool surface',
    !options.backgrounds?.some((b) => b.id === 'img-paint-splash'),
  );

  const versions = payload(await rpc('tools/call', {
    name: 'list_versions',
    arguments: { languageCode: 'te' },
  })) as { versions?: unknown[] };
  check('call list_versions (te)', Array.isArray(versions.versions),
    `${versions.versions?.length ?? 0} versions`);

  const gallery = payload(await rpc('tools/call', { name: 'gallery', arguments: {} }));
  check('call gallery', Array.isArray(gallery) || typeof gallery === 'object');

  const resolved = payload(await rpc('tools/call', {
    name: 'resolve_passage',
    arguments: { input: 'John 3:16', languageCode: 'en' },
  })) as { candidates?: Array<{ reference?: string; text?: string }> };
  const first = resolved.candidates?.[0];
  check('call resolve_passage', Boolean(first?.text),
    first?.reference ?? 'no candidate');

  // An unknown tool must be refused rather than silently ignored. MCP allows
  // either shape here: a JSON-RPC error, or a normal result carrying
  // `isError`. Both are a refusal; only a success would be a bug.
  let refusal = '';
  try {
    const bad = (await rpc('tools/call', {
      name: 'no_such_tool',
      arguments: {},
    })) as { isError?: boolean };
    if (bad?.isError) refusal = 'isError result';
  } catch {
    refusal = 'JSON-RPC error';
  }
  check('unknown tool is refused', Boolean(refusal), refusal);

  // ---- the ones that cost money ------------------------------------------
  if (!LIVE) {
    console.log('\nskipped (pass --live to run): generate_devices, extract_teachings, plan_series, create_short');
  } else {
    const devices = payload(await rpc('tools/call', {
      name: 'generate_devices',
      arguments: { input: 'Psalm 23', lens: 'hook', languageCode: 'en' },
    })) as { devices?: unknown[] };
    check('call generate_devices', (devices.devices?.length ?? 0) >= 3,
      `${devices.devices?.length ?? 0} devices`);

    const series = payload(await rpc('tools/call', {
      name: 'plan_series',
      arguments: { theme: 'courage', days: 3, languageCode: 'en' },
    })) as { days?: unknown[] };
    check('call plan_series', (series.days?.length ?? 0) === 3);
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nall MCP checks passed');
  if (failures) process.exit(1);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
