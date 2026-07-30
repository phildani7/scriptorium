/**
 * Live check on the link reader.
 *
 *   npm run smoke:link -- <url> [<url> ...]
 *
 * With no arguments it exercises the outcomes the reader has to produce: a
 * readable article, a PDF, a YouTube link (refused on sight), and failures
 * that must come back as a sentence rather than a stack trace.
 *
 * This path is best-effort by nature — it reads pages nobody promised would
 * stay readable — so what it proves is not "the internet works" but that each
 * outcome is one the studio can show a creator.
 */

import { fetchLinkSource, LinkError } from '@/lib/source/link';
import { isYouTubeUrl } from '@/lib/source/youtube';

const DEFAULTS = [
  'https://en.wikipedia.org/wiki/Parable_of_the_Prodigal_Son',
  'https://www.gutenberg.org/cache/epub/2800/pg2800.txt',
  // Must be refused on sight, with the transcript workaround.
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  'https://youtu.be/aqz-KE-bpKQ',
  // Must fail politely, not explode.
  'https://en.wikipedia.org/wiki/No_Such_Page_Exists_Here_12345',
  'not-a-url',
];

async function main() {
  const urls = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const targets = urls.length ? urls : DEFAULTS;

  for (const url of targets) {
    const kind = isYouTubeUrl(url) ? 'youtube' : 'article';
    process.stdout.write(`\n${url}\n  (${kind}) `);
    try {
      const source = await fetchLinkSource(url);
      const words = source.text.trim().split(/\s+/).length;
      console.log(`ok — ${words.toLocaleString()} words from ${source.origin}`);
      if (source.title) console.log(`  title: ${source.title.slice(0, 80)}`);
      console.log(`  head:  ${source.text.replace(/\s+/g, ' ').slice(0, 140)}…`);
      if (words < 40) console.log('  NOTE: thin — the extractor needs a paragraph or more.');
    } catch (error) {
      const polite = error instanceof LinkError;
      console.log(`${polite ? 'declined' : 'ERROR'} — ${(error as Error).message}`);
      if (!polite) {
        console.error('  ^ not a LinkError: the studio would show this raw.');
        process.exitCode = 1;
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
