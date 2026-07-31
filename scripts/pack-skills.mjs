/**
 * Pack the Agent Skills into a downloadable zip.
 *
 *   npm run skills:pack
 *
 * Writes `public/downloads/scriptorium-skills.zip`, which is committed. That
 * one file then serves both places a developer might look for it: GitHub,
 * where it sits in the tree, and the deployed site, where the "For developers"
 * panel links it directly. A release asset would cover only the first, and a
 * build-time artifact only the second.
 *
 * Zipped here rather than by hand so the download can never drift from
 * `skills/`. Committing a binary nobody can regenerate is how a download ends
 * up describing a version of the product that no longer exists.
 *
 * Deterministic on purpose: entries are sorted, and every timestamp is pinned.
 * A zip that re-compresses to different bytes for identical input turns every
 * unrelated commit into a binary diff.
 */

import { createWriteStream } from 'node:fs';
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const ROOT = process.cwd();
const SRC = join(ROOT, 'skills');
const OUT = join(ROOT, 'public', 'downloads', 'scriptorium-skills.zip');

/**
 * A fixed DOS timestamp (1 Jan 2020, 00:00). The zip format stores local time
 * with no zone, so "now" would make the bytes depend on when and where the
 * pack ran.
 */
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

function walk(dir) {
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

/** CRC-32, the one checksum the zip format insists on. */
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function main() {
  const files = walk(SRC);
  if (!files.length) throw new Error('skills/ is empty');

  mkdirSync(join(ROOT, 'public', 'downloads'), { recursive: true });

  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    // Forward slashes: the zip spec says so, and Windows back-slashes here
    // produce an archive that unpacks into one long filename on macOS.
    const name = relative(SRC, file).split(sep).join('/');
    const body = readFileSync(file);
    const deflated = deflateRawSync(body, { level: 9 });
    const crc = crc32(body);
    const nameBytes = Buffer.from(name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBytes, deflated);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(deflated.length, 20);
    entry.writeUInt32LE(body.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(0, 38); // external attrs
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += local.length + nameBytes.length + deflated.length;
    console.log(`  ${name.padEnd(46)} ${(body.length / 1024).toFixed(1)} KB`);
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  const zip = Buffer.concat([...chunks, centralBuffer, end]);
  const stream = createWriteStream(OUT);
  stream.end(zip);
  stream.on('finish', () => {
    console.log(
      `\n${files.length} files -> public/downloads/scriptorium-skills.zip ` +
        `(${(zip.length / 1024).toFixed(0)} KB)`,
    );
  });
}

main();
