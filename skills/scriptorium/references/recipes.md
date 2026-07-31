# Recipes

Worked sequences. Each is a real tool-call chain against
`POST https://scriptorium-gamma-wheat.vercel.app/api/mcp`.

## One short, chosen rather than accepted

```jsonc
// 1. what is available for this language
{ "name": "list_versions", "arguments": { "languageCode": "te" } }

// 2. the passage, verbatim
{ "name": "resolve_passage",
  "arguments": { "input": "Psalm 23", "languageCode": "te" } }

// 3. read every device before choosing
{ "name": "generate_devices",
  "arguments": { "input": "Psalm 23", "lens": "analogy",
                 "languageCode": "te", "tone": "liturgical" } }

// 4. compose the one that is actually good, and queue the MP4
{ "name": "create_short",
  "arguments": { "input": "Psalm 23", "lens": "analogy",
                 "languageCode": "te", "deviceIndex": 2,
                 "style": "warm-minimal", "visualMode": "ai",
                 "theme": { "paletteId": "parchment", "musicId": "deeper-still" } } }
```

## A week from a sermon

The sermon is yours; the passages under it are still fetched.

```jsonc
{ "name": "extract_teachings",
  "arguments": { "text": "<paste the sermon, 120 chars minimum>",
                 "languageCode": "en" } }
```

Each teaching comes back anchored to a **reference**. Feed those references
back through `create_short` one at a time — that second call is what turns a
reference into verse text.

## A planned arc

```jsonc
{ "name": "plan_series",
  "arguments": { "theme": "courage", "days": 7, "languageCode": "en" } }
```

Returns one passage and one lens per day, planned as an arc rather than seven
unrelated shorts. Each day is then one `create_short` away from a finished
video. Vary `style` across the week if you want the series to read as a series
rather than a template.

## The same teaching, many languages

Resolve and generate **per language** rather than translating one English
teaching. The teaching is written in the target language, which is not the same
thing as an English idea rendered into it.

```jsonc
{ "name": "create_short",
  "arguments": { "input": "John 3:16", "languageCode": "hi", "lens": "hook" } }
{ "name": "create_short",
  "arguments": { "input": "John 3:16", "languageCode": "te", "lens": "hook" } }
{ "name": "create_short",
  "arguments": { "input": "John 3:16", "languageCode": "ta", "lens": "hook" } }
```

Check `timingSource` on each. Where it is `estimated`, the language has no
measured word timing and the captions ride an estimated clock.

## Dry run without spending a render

```jsonc
{ "name": "create_short",
  "arguments": { "input": "Hebrews 12:2", "export": false } }
```

Composes and verifies, returns the script and the verification, queues nothing.
Useful for reviewing narration before committing render minutes.

## Check a deployment before wiring a client

```bash
curl https://scriptorium-gamma-wheat.vercel.app/api/mcp
```

Returns the server descriptor and the tool list. If that answers, the transport
is up; if a tool then fails, the fault is downstream of MCP.

## Reading a refusal correctly

Two responses look like failures and are not:

- **A declined topic.** Off-topic input is answered with a polite decline and
  `declined: true`. That is the tool working.
- **A YouTube link.** `extract_teachings` refuses it and names the workaround.
  YouTube declines caption requests from datacenter IPs, so no retry will
  succeed. Paste the transcript.

An unknown tool name comes back as a result carrying `isError`, not as a
JSON-RPC error. Handle both shapes.
