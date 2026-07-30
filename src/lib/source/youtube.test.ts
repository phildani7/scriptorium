import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { isYouTubeUrl, youTubeId, YOUTUBE_NOT_SUPPORTED } from './youtube';
import { fetchLinkSource, LinkError } from './link';

/*
 * YouTube is refused, deliberately and everywhere. See lib/source/youtube for
 * why. What these guard is that the refusal is COMPLETE — every URL shape, in
 * the browser and in the API both — because a link that slips through does not
 * fail fast, it hangs for twenty seconds and then reports the video as
 * private, which is the exact confusion this replaced.
 */

test('every shape of YouTube link is recognised', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'http://youtube.com/watch?v=jNQXAC9IVRw&t=42',
    'https://m.youtube.com/watch?v=jNQXAC9IVRw',
    'https://music.youtube.com/watch?v=jNQXAC9IVRw',
    'https://youtu.be/jNQXAC9IVRw',
    'https://youtu.be/jNQXAC9IVRw?si=abc',
    'https://www.youtube.com/shorts/jNQXAC9IVRw',
    'https://www.youtube.com/embed/jNQXAC9IVRw',
    'https://www.youtube.com/live/jNQXAC9IVRw',
    '  https://www.youtube.com/watch?v=jNQXAC9IVRw  ',
  ]) {
    assert.equal(youTubeId(url), 'jNQXAC9IVRw', url);
    assert.equal(isYouTubeUrl(url), true, url);
  }
});

test('a YouTube URL with no usable video id is still YouTube', () => {
  // The creator's question is "can I use YouTube here", and the answer does
  // not depend on whether the link they pasted happened to be well formed.
  for (const url of [
    'https://www.youtube.com/',
    'https://www.youtube.com/@somechannel',
    'https://www.youtube.com/playlist?list=PL1234',
    'https://youtu.be/',
  ]) {
    assert.equal(youTubeId(url), null, url);
    assert.equal(isYouTubeUrl(url), true, url);
  }
});

test('other links are not mistaken for YouTube', () => {
  for (const url of [
    'https://en.wikipedia.org/wiki/Parable_of_the_Prodigal_Son',
    'https://vimeo.com/12345678',
    'https://notyoutube.com/watch?v=jNQXAC9IVRw',
    // The host must be YouTube, not merely mentioned in the path or query.
    'https://example.com/youtube.com/watch?v=jNQXAC9IVRw',
    'https://example.com/?ref=https://youtu.be/jNQXAC9IVRw',
    'not a url at all',
    '',
  ]) {
    assert.equal(isYouTubeUrl(url), false, url);
  }
});

test('the API refuses a YouTube link without fetching anything', async () => {
  // Callers that are not the studio (MCP clients, scripts) never see the
  // browser's warning, so the rule has to live on this side too.
  await assert.rejects(
    () => fetchLinkSource('https://www.youtube.com/watch?v=jNQXAC9IVRw'),
    (error: unknown) => {
      assert.ok(error instanceof LinkError, 'should be a polite decline, not a crash');
      assert.equal(error.message, YOUTUBE_NOT_SUPPORTED);
      return true;
    },
  );
});

test('the refusal says why and what to do instead', () => {
  // "Unsupported" on its own invites a retry with a different video.
  assert.match(YOUTUBE_NOT_SUPPORTED, /not supported/i);
  assert.match(YOUTUBE_NOT_SUPPORTED, /blocks/i);
  assert.match(YOUTUBE_NOT_SUPPORTED, /transcript/i);
  assert.match(YOUTUBE_NOT_SUPPORTED, /From your text/);
});
