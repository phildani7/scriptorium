/**
 * Scriptorium MCP — every feature as tools, over stateless streamable HTTP.
 *
 * One POST endpoint, no sessions, no SSE stream, no storage: each request
 * builds a fresh server + transport pair, answers as plain JSON, and throws
 * both away. An agent can point any MCP client at
 * `https://<deployment>/api/mcp` and drive the whole pipeline — resolve,
 * generate, extract, plan, compose, export — while the architecture's central
 * rule is enforced exactly as in the UI, because every tool is a thin wrapper
 * over the same API routes.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import {
  BACKGROUNDS,
  FONTS,
  MUSIC,
  PALETTES,
  SIZES,
  TEXT_STYLES,
} from '@/lib/theme/options';

export const dynamic = 'force-dynamic';
// create_short composes narration inline; give it the same ceiling compose has.
export const maxDuration = 300;

// Duplicated from the studio's client component on purpose: importing a
// 'use client' module into a route handler breaks under Turbopack.
const STYLES = [
  { id: 'warm-minimal', blurb: 'Editorial calm. Serif, whitespace, one accent.' },
  { id: 'kinetic-type', blurb: 'Poster type that lands word by word on the voice.' },
  { id: 'neon-night', blurb: 'Dark glow, drifting particles, a flare at the turn.' },
] as const;

const LENSES = ['hook', 'analogy', 'punch-line', 'illustration', 'object-lesson', 'summary'] as const;
const TONES = ['conversational', 'formal', 'liturgical'] as const;
const AGES = ['kids', 'youth', 'adult'] as const;

/** Self-call one of the app's own API routes and hand back its JSON. */
async function api<T>(origin: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(json.error || `${path} failed (${response.status})`);
  return json;
}

const asText = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

function buildServer(origin: string): McpServer {
  const server = new McpServer({ name: 'scriptorium', version: '1.0.0' });

  server.registerTool(
    'list_options',
    {
      description:
        'Everything customizable on a short: visual styles, palettes, fonts, sizes, backgrounds (incl. licensed video loops), text motions, music beds, teaching lenses, tones, audiences.',
      inputSchema: {},
    },
    async () =>
      asText({
        styles: STYLES.map((s) => ({ id: s.id, blurb: s.blurb })),
        lenses: LENSES,
        tones: TONES,
        audiences: AGES,
        palettes: PALETTES.map((p) => p.id),
        fonts: FONTS.map((f) => f.id),
        sizes: SIZES.map((s) => s.id),
        backgrounds: BACKGROUNDS.map((b) => ({ id: b.id, kind: b.kind })),
        textStyles: TEXT_STYLES.map((t) => t.id),
        music: MUSIC.map((m) => ({ id: m.id, credit: m.credit || 'silence' })),
      }),
  );

  server.registerTool(
    'list_versions',
    {
      description: 'Bible versions licensed for a language (for version pinning).',
      inputSchema: { languageCode: z.string().default('en') },
    },
    async ({ languageCode }) =>
      asText(await api(origin, `/api/versions?lang=${encodeURIComponent(languageCode)}`)),
  );

  server.registerTool(
    'resolve_passage',
    {
      description:
        'Reference, word, or situation -> candidate passages retrieved verbatim from YouVersion. Scripture is never generated.',
      inputSchema: {
        input: z.string().describe('e.g. "John 3:16" or "anxiety at work"'),
        languageCode: z.string().default('en'),
        versionId: z.number().optional(),
      },
    },
    async (args) => asText(await api(origin, '/api/resolve', args)),
  );

  server.registerTool(
    'generate_devices',
    {
      description:
        'Resolve a passage, then generate 3-7 teaching devices for it through one lens. Returns the passage and the device options.',
      inputSchema: {
        input: z.string().describe('Reference or topic'),
        lens: z.enum(LENSES).default('hook'),
        ageGroup: z.enum(AGES).default('adult'),
        tone: z.enum(TONES).default('conversational'),
        languageCode: z.string().default('en'),
        versionId: z.number().optional(),
      },
    },
    async ({ input, lens, ageGroup, tone, languageCode, versionId }) => {
      const resolved = await api<{
        candidates: Array<Record<string, unknown>>;
        declined?: boolean;
        message?: string;
      }>(origin, '/api/resolve', { input, languageCode, versionId });
      if (resolved.declined) throw new Error(resolved.message ?? 'Topic declined.');
      const passage = resolved.candidates[0];
      if (!passage) throw new Error(`No passage found for "${input}".`);
      const generated = await api<{ devices: unknown[] }>(origin, '/api/generate', {
        passage,
        lens,
        ageGroup,
        tone,
        languageCode,
      });
      return asText({ passage, devices: generated.devices });
    },
  );

  server.registerTool(
    'extract_teachings',
    {
      description:
        'Mine a creator-supplied source text (sermon, notes, article) for 3-5 teachings, each anchored to a Bible reference. References only — verse text always comes from YouVersion.',
      inputSchema: {
        text: z.string().min(120),
        languageCode: z.string().default('en'),
      },
    },
    async (args) => asText(await api(origin, '/api/extract', args)),
  );

  server.registerTool(
    'plan_series',
    {
      description:
        'Plan a multi-day shorts series on a theme: one passage + lens per day, references only.',
      inputSchema: {
        theme: z.string(),
        days: z.number().min(3).max(14).default(5),
        languageCode: z.string().default('en'),
      },
    },
    async (args) => asText(await api(origin, '/api/series', args)),
  );

  server.registerTool(
    'create_short',
    {
      description:
        'End-to-end: resolve the passage, generate devices, compose the chosen one into a verified short, and (by default) queue the MP4 export to the gallery. Returns the narration script, verification state, and export status.',
      inputSchema: {
        input: z.string().describe('Reference or topic'),
        lens: z.enum(LENSES).default('hook'),
        ageGroup: z.enum(AGES).default('adult'),
        tone: z.enum(TONES).default('conversational'),
        languageCode: z.string().default('en'),
        versionId: z.number().optional(),
        style: z.enum(['warm-minimal', 'kinetic-type', 'neon-night']).default('warm-minimal'),
        deviceIndex: z.number().default(0).describe('Which generated device to use'),
        theme: z
          .object({
            paletteId: z.string().optional(),
            fontId: z.string().optional(),
            sizeId: z.string().optional(),
            backgroundId: z.string().optional(),
            textStyleId: z.string().optional(),
            musicId: z.string().optional(),
            captions: z.enum(['on', 'off']).optional(),
          })
          .optional(),
        visualMode: z.enum(['text', 'free']).default('text'),
        export: z.boolean().default(true),
        backend: z.enum(['actions', 'sandbox']).optional(),
      },
    },
    async (args) => {
      const resolved = await api<{
        candidates: Array<Record<string, unknown>>;
        declined?: boolean;
        message?: string;
      }>(origin, '/api/resolve', {
        input: args.input, languageCode: args.languageCode, versionId: args.versionId,
      });
      if (resolved.declined) throw new Error(resolved.message ?? 'Topic declined.');
      const passage = resolved.candidates[0];
      if (!passage) throw new Error(`No passage found for "${args.input}".`);

      const generated = await api<{ devices: Array<Record<string, unknown>> }>(
        origin,
        '/api/generate',
        {
          passage,
          lens: args.lens,
          ageGroup: args.ageGroup,
          tone: args.tone,
          languageCode: args.languageCode,
        },
      );
      const device = generated.devices[Math.min(args.deviceIndex, generated.devices.length - 1)];
      if (!device) throw new Error('Generation returned no devices.');

      const composed = await api<{
        spec: Record<string, unknown> & {
          narration?: { script?: string; durationSec?: number };
          verified?: boolean;
        };
        verification?: string;
      }>(origin, '/api/compose', {
        passage,
        device,
        style: args.style,
        theme: args.theme,
        visualMode: args.visualMode,
        languageCode: args.languageCode,
      });

      let exportResult: unknown = 'not requested';
      if (args.export) {
        exportResult = await api(origin, '/api/export', {
          spec: composed.spec,
          backend: args.backend,
        });
      }

      return asText({
        reference: passage.reference,
        device,
        narrationScript: composed.spec.narration?.script,
        durationSec: composed.spec.narration?.durationSec,
        verified: composed.spec.verified,
        verification: composed.verification,
        export: exportResult,
      });
    },
  );

  server.registerTool(
    'gallery',
    {
      description: 'List the pre-rendered shorts in the public gallery.',
      inputSchema: {},
    },
    async () => {
      const response = await fetch(`${origin}/gallery/manifest.json`);
      return asText(response.ok ? await response.json() : []);
    },
  );

  return server;
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const server = buildServer(origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: no session ids, plain JSON responses, nothing retained.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export function GET() {
  return Response.json(
    {
      name: 'scriptorium',
      transport: 'streamable-http (stateless)',
      endpoint: 'POST /api/mcp',
      tools: [
        'list_options', 'list_versions', 'resolve_passage', 'generate_devices',
        'extract_teachings', 'plan_series', 'create_short', 'gallery',
      ],
    },
    { status: 200 },
  );
}
