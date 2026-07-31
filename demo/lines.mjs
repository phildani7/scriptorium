/**
 * The narration script.
 *
 * Written to three rules the brief set, in this order:
 *
 *   Credit BOTH partners. YouVersion supplies the Scripture; Gloo supplies the
 *   teaching and the values alignment around it. Naming only one of them
 *   misdescribes the architecture, not just the courtesy.
 *
 *   No boasting. Every sentence here is either a fact that can be checked
 *   against the running app, or a plain description of what is on screen.
 *   Nothing is "revolutionary", "seamless" or "powerful". Numbers are the
 *   audited ones.
 *
 *   Joyful, not breathless. The tone is a person glad to show you something
 *   they made, explaining it carefully, taking their time.
 */

export const LINES = [
  {
    id: 'open',
    text:
      'YouVersion serves Scripture as text in more than a thousand languages. ' +
      'The world is watching vertical video. And in most of those languages, ' +
      'there is almost none of it. Scriptorium is a small attempt to close ' +
      'that gap.',
  },
  {
    id: 'partners',
    text:
      'It rests on two partners. YouVersion provides the Scripture, through ' +
      'their Platform API. Gloo provides the teaching that surrounds it, and ' +
      'the values alignment that lets a short be written for the tradition and ' +
      'the audience it is actually for. The line between those two things is ' +
      'the whole design.',
  },
  {
    id: 'ask',
    text:
      'You start by saying what the short is about. A reference, or a topic, or ' +
      'a situation. Then you choose a lens. There are six, and each approaches ' +
      'the passage differently. A hook opens with a question; an analogy reaches ' +
      'for a picture from ordinary life.',
  },
  {
    id: 'retrieve',
    text:
      'When you ask for the passage, Scriptorium asks YouVersion. It never asks ' +
      'a model to write Scripture. The candidates come back word for word, ' +
      'exactly as the API returned them, in whichever of the forty licensed ' +
      'languages you chose.',
  },
  {
    id: 'teach',
    text:
      'Choose one, and Gloo writes the teaching around it. An opening line, then ' +
      'five sentences, one to a page, so nothing overlaps on screen. ' +
      'Speechmatics narrates it and measures every word, which is what lets the ' +
      'captions ride the voice.',
  },
  {
    id: 'style',
    text:
      'Then it becomes yours. There are three motion styles. Warm Minimal is ' +
      'editorial and calm. Kinetic Type lands poster words on the measured ' +
      'voice. Neon Night has glow, drifting particles, and a flare at the turn.',
  },
  {
    id: 'colour',
    text:
      'Eight palettes, four type pairs, and three sizes. The type is fitted by ' +
      'measurement, so a long sentence steps down until it genuinely fits ' +
      'rather than spilling off the frame.',
  },
  {
    id: 'more',
    text:
      'Captions can be on or off. There are eight ways for the text to enter, ' +
      'and nine music beds, all licensed so that nothing you post carries an ' +
      'attribution obligation with it.',
  },
  {
    id: 'background',
    text:
      'And sixty-nine backgrounds. Eight generated in CSS, ten hand-drawn ' +
      'frames, seventeen photographs, and thirty-four animated loops, each ' +
      'cross-faded so it repeats without a visible cut.',
  },
  {
    id: 'edit',
    text:
      'Every authored word stays editable, right up to export. The verse does ' +
      'not. There is deliberately no field anywhere in this studio that can ' +
      'change it.',
  },
  {
    id: 'result',
    text:
      'And this is what comes out. Ten eighty by nineteen twenty, narrated, ' +
      'captioned word by word, ready to post.',
  },
  {
    id: 'gate',
    text:
      'Before a single frame is captured, the verse on screen is fetched from ' +
      'YouVersion again and compared against that fresh response. If they differ, ' +
      'the render stops. Here it is refusing a spec whose verse was altered on ' +
      'purpose. Altered Scripture cannot reach a frame.',
  },
  {
    id: 'wall',
    text:
      'Forty languages are licensed against this deployment. Thirty three have ' +
      'a neural voice and word timing measured from the audio. Each short is ' +
      'written in its own language, rather than translated into it afterwards.',
  },
  {
    id: 'headless',
    text:
      'All of it works without the screen. One stateless M C P server exposes ' +
      'the pipeline as eight tools, so an agent or a cron job can drive it. And ' +
      'because a tool list cannot tell an agent which lens suits a passage, ' +
      'there is a skill pack to download beside it.',
  },
  {
    id: 'close',
    text:
      'Scripture from YouVersion. Teaching from Gloo. Rendered with HyperFrames, ' +
      'and verified before every single frame. Thank you for watching.',
  },
];
