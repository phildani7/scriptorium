/**
 * The narration script — one line per on-screen step.
 *
 * Earlier cuts wrote paragraph-length lines and split their time across steps
 * by percentage, and every timing complaint traced back to that: Gloo's
 * sentence played over YouVersion's spotlight, the lens line played before
 * the lenses were framed. A percentage is a guess about where a sentence
 * falls inside a paragraph. So there are no paragraphs any more: each step
 * speaks exactly one line, each line's measured duration IS the step's
 * length, and the two cannot drift because neither exists without the other.
 *
 * Voice rules, unchanged: credit both partners, state facts, no boasting.
 * `step: true` lines belong to the studio walkthrough; the rest each own a
 * whole segment of the film.
 */

export const LINES = [
  // ---- opening card --------------------------------------------------------
  {
    id: 'open',
    text:
      'YouVersion serves Scripture as text in more than a thousand languages. ' +
      'The world is watching vertical video. And in most of those languages, ' +
      'there is almost none of it. Scriptorium is a small attempt to close ' +
      'that gap.',
  },

  // ---- the walkthrough, one line per numbered step -------------------------
  { id: 'hero', step: true, text:
      'Scriptorium rests on two partners, and the line between them is the whole design.' },
  { id: 'received', step: true, text:
      'YouVersion provides the Scripture, through their Platform API. Every word arrives exactly as published.' },
  { id: 'written', step: true, text:
      'Gloo provides the teaching around it, with the values alignment to write for the tradition and the audience it is actually for.' },
  { id: 'topic', step: true, text:
      'You start by saying what the short is about. A reference, a topic, or a situation.' },
  { id: 'lens', step: true, text:
      'Then choose a lens. There are six. A hook opens with a question; an analogy reaches for a picture from ordinary life.' },
  { id: 'find', step: true, text:
      'Ask for the passage, and Scriptorium asks YouVersion. It never asks a model to write Scripture.' },
  { id: 'passages', step: true, text:
      'The candidates come back word for word, in whichever of the forty licensed languages you chose.' },
  { id: 'devices', step: true, text:
      'Choose one, and Gloo writes the teaching. An opening line, then five sentences, one to a page. Speechmatics narrates the script and measures every word, so the captions ride the voice.' },
  { id: 'style', step: true, text:
      'Then it becomes yours. Three motion styles: Warm Minimal, Kinetic Type, and Neon Night.' },
  { id: 'colors', step: true, text: 'Eight palettes.' },
  { id: 'font', step: true, text: 'Four type pairs.' },
  { id: 'size', step: true, text: 'Three text sizes.' },
  { id: 'captions', step: true, text: 'Captions, on or off.' },
  { id: 'motion', step: true, text: 'Eight ways for the text to enter.' },
  { id: 'music', step: true, text:
      'Nine licensed music beds. Nothing you post carries an attribution obligation.' },
  { id: 'background', step: true, text:
      'And sixty-nine backgrounds. CSS textures, hand-drawn frames, photographs, and thirty-four animated loops, each one repeating without a visible cut.' },
  { id: 'narration', step: true, text:
      'Every authored word stays editable, right up to export. The verse does not. There is deliberately no field that can change it.' },
  { id: 'mcp', step: true, text:
      'All of this also works without the screen. One stateless M C P server exposes the pipeline as eight tools.' },
  { id: 'skills', step: true, text:
      'And a downloadable skill pack teaches an agent how to drive them.' },

  // ---- the result: three finished shorts, heard in turn --------------------
  {
    id: 'result',
    text:
      'And this is what comes out. The same pipeline, in Hindi, in Arabic, ' +
      'and in English. Listen.',
  },

  // ---- the gate -------------------------------------------------------------
  {
    id: 'gate',
    text:
      'Before a single frame is captured, the verse on screen is fetched from ' +
      'YouVersion again and compared against that fresh response. If they differ, ' +
      'the render stops. Here it is refusing a spec whose verse was altered on ' +
      'purpose. Altered Scripture cannot reach a frame.',
  },

  // ---- the language wall ----------------------------------------------------
  {
    id: 'wall',
    text:
      'Forty languages are licensed against this deployment. Thirty three have ' +
      'a neural voice and word timing measured from the audio. Each short is ' +
      'written in its own language, rather than translated into it afterwards.',
  },

  // ---- close -----------------------------------------------------------------
  {
    id: 'close',
    text:
      'Scripture from YouVersion. Teaching from Gloo. Rendered with HyperFrames, ' +
      'and verified before every single frame. Thank you for watching.',
  },
];

/** Walkthrough step order — the film and the capture both follow this. */
export const STEP_ORDER = LINES.filter((l) => l.step).map((l) => l.id);
