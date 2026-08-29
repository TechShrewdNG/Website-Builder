/**
 * Generates the templates' placeholder images.
 *
 * Written by hand rather than pulled from a stock library: these ship in the
 * repo, so they have to be licence-free, and they have to stay small — every
 * one of them becomes a base64 data URL on import, and D1 caps a row at 2 MB.
 * A soft vertical gradient in each template's own palette compresses to a
 * couple of KB and reads as a deliberate colour block rather than a broken
 * image, which matters when the whole point is showing the design off.
 *
 * Usage: node templates/make-images.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Minimal PNG encoder (signature + IHDR + IDAT + IEND, truecolour, 8-bit)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function encodePng(width, height, pixelAt) {
  // Each scanline is prefixed with filter byte 0 (None) — the raw bytes
  // compress well enough for flat gradients that filtering buys nothing.
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

/** Soft vertical gradient, with a barely-there diagonal sheen for depth. */
function gradient(from, to) {
  const a = hex(from);
  const b = hex(to);
  return (width, height) => (x, y) => {
    const t = y / Math.max(1, height - 1);
    const sheen = 1 + 0.05 * (x / Math.max(1, width - 1) - 0.5);
    return [
      Math.max(0, Math.min(255, Math.round((a[0] + (b[0] - a[0]) * t) * sheen))),
      Math.max(0, Math.min(255, Math.round((a[1] + (b[1] - a[1]) * t) * sheen))),
      Math.max(0, Math.min(255, Math.round((a[2] + (b[2] - a[2]) * t) * sheen))),
    ];
  };
}

// ---------------------------------------------------------------------------

const LANDSCAPE = [1200, 800];
const WIDE = [1600, 700];
const SQUARE = [900, 900];
const PORTRAIT = [800, 1000];

/** [template, filename, [w, h], fromColour, toColour] */
const IMAGES = [
  // Restaurant — warm olive and terracotta
  ['restaurant', 'hero.png', WIDE, '#3d4a2a', '#1f2716'],
  ['restaurant', 'dish-1.png', SQUARE, '#c1663f', '#8f4527'],
  ['restaurant', 'dish-2.png', SQUARE, '#7d8c5c', '#4c5836'],
  ['restaurant', 'dish-3.png', SQUARE, '#d8a05c', '#a8703a'],
  ['restaurant', 'room.png', LANDSCAPE, '#4a4036', '#2b2621'],

  // Law firm — navy and gold
  ['law-firm', 'hero.png', WIDE, '#12233d', '#0a1524'],
  ['law-firm', 'office.png', LANDSCAPE, '#2c3e57', '#16283f'],
  ['law-firm', 'partner-1.png', PORTRAIT, '#3f5068', '#26364a'],
  ['law-firm', 'partner-2.png', PORTRAIT, '#4a5a70', '#2e3d51'],
  ['law-firm', 'partner-3.png', PORTRAIT, '#55647a', '#36455a'],

  // Fitness — near-black and lime
  ['fitness-studio', 'hero.png', WIDE, '#1a1c14', '#0f0f11'],
  ['fitness-studio', 'floor.png', LANDSCAPE, '#26291c', '#131410'],
  ['fitness-studio', 'coach-1.png', PORTRAIT, '#2f3324', '#17190f'],
  ['fitness-studio', 'coach-2.png', PORTRAIT, '#383d2b', '#1d2013'],

  // Salon — blush and plum
  ['salon-spa', 'hero.png', WIDE, '#e6cfc9', '#c98f8a'],
  ['salon-spa', 'room.png', LANDSCAPE, '#f0e2de', '#d8bdb6'],
  ['salon-spa', 'work-1.png', SQUARE, '#dcc0bb', '#b8908c'],
  ['salon-spa', 'work-2.png', SQUARE, '#e8d5cf', '#c4a29c'],
  ['salon-spa', 'work-3.png', SQUARE, '#d3b3ae', '#a9827e'],

  // Home services — blue and orange
  ['home-services', 'hero.png', WIDE, '#0b4f8a', '#06335c'],
  ['home-services', 'van.png', LANDSCAPE, '#1c6aa8', '#0d4675'],
  ['home-services', 'work-1.png', SQUARE, '#2b7ab8', '#155286'],
  ['home-services', 'work-2.png', SQUARE, '#f47b20', '#c25a10'],

  // Photography — monochrome
  ['photography', 'hero.png', WIDE, '#3a3a3a', '#141414'],
  ['photography', 'shot-1.png', PORTRAIT, '#5c5c5c', '#2e2e2e'],
  ['photography', 'shot-2.png', LANDSCAPE, '#4a4a4a', '#212121'],
  ['photography', 'shot-3.png', SQUARE, '#6b6b6b', '#3a3a3a'],
  ['photography', 'shot-4.png', PORTRAIT, '#2c2c2c', '#0d0d0d'],
  ['photography', 'shot-5.png', LANDSCAPE, '#787878', '#454545'],
  ['photography', 'portrait.png', PORTRAIT, '#535353', '#282828'],
];

let total = 0;
for (const [template, name, [width, height], from, to] of IMAGES) {
  const dir = join(HERE, template, 'img');
  mkdirSync(dir, { recursive: true });
  const png = encodePng(width, height, gradient(from, to)(width, height));
  writeFileSync(join(dir, name), png);
  total += png.length;
  console.log(`${template}/img/${name}  ${width}x${height}  ${(png.length / 1024).toFixed(1)} KB`);
}
console.log(`\n${IMAGES.length} images, ${(total / 1024).toFixed(1)} KB total`);
