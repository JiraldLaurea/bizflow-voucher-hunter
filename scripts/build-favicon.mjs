/**
 * Builds src/app/icon.png — the browser-tab favicon — from the app logo.
 *
 * The logo ships as a square RGB tile and the app rounds it with CSS
 * (`.logo-tile { border-radius }`). A browser tab has no stylesheet, so the
 * favicon has to arrive with its corners already cut: this reads the source
 * PNG, adds an alpha channel masked to a rounded rectangle, and writes the
 * result back out as PNG.
 *
 * Only zlib is used, so there is no image dependency to install. That means
 * handling the PNG format directly, which is fine for the one shape the source
 * actually is — 8-bit, non-interlaced — and asserted rather than assumed below.
 *
 * `apple-icon.png` is deliberately NOT rounded: iOS applies its own squircle
 * mask to a home-screen icon, and pre-rounding it corners the image twice.
 *
 * Run: node scripts/build-favicon.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const SOURCE = "public/images/voucher-hunt-app-logo.png";
const OUTPUT = "src/app/icon.png";

// Matches the app's own tile: 14px radius on a 66px tile, so ~21%. Close to the
// iOS squircle ratio, which is what reads as "rounded" at 16px in a tab.
const RADIUS_RATIO = 0.21;

// Subsamples per axis when measuring a pixel's coverage. At 16px on screen the
// corners are two or three pixels wide, so unantialiased edges look ragged.
const SUBSAMPLES = 4;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readChunks(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${SOURCE} is not a PNG`);
  }
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    chunks.push({
      type: buffer.subarray(offset + 4, offset + 8).toString("latin1"),
      data: buffer.subarray(offset + 8, offset + 8 + length),
    });
    offset += 12 + length;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Reverses the per-scanline filters PNG applies before compression. */
function unfilter(raw, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const target = y * stride;
    const above = (y - 1) * stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bytesPerPixel ? out[target + i - bytesPerPixel] : 0;
      const up = y > 0 ? out[above + i] : 0;
      const upLeft =
        y > 0 && i >= bytesPerPixel ? out[above + i - bytesPerPixel] : 0;
      let value = line[i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      out[target + i] = value & 0xff;
    }
  }
  return out;
}

/** Fraction of a pixel that falls inside the rounded rectangle, 0 to 1. */
function coverage(px, py, size, radius) {
  let inside = 0;
  for (let sy = 0; sy < SUBSAMPLES; sy += 1) {
    for (let sx = 0; sx < SUBSAMPLES; sx += 1) {
      const x = px + (sx + 0.5) / SUBSAMPLES;
      const y = py + (sy + 0.5) / SUBSAMPLES;
      // Distance from the nearest corner's centre of curvature. Outside the
      // corner boxes both terms are zero, so the pixel is simply inside.
      const dx = x < radius ? radius - x : x > size - radius ? x - (size - radius) : 0;
      const dy = y < radius ? radius - y : y > size - radius ? y - (size - radius) : 0;
      if (dx * dx + dy * dy <= radius * radius) inside += 1;
    }
  }
  return inside / (SUBSAMPLES * SUBSAMPLES);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
}

const source = readFileSync(SOURCE);
const chunks = readChunks(source);
const header = chunks.find((item) => item.type === "IHDR").data;

const width = header.readUInt32BE(0);
const height = header.readUInt32BE(4);
const bitDepth = header[8];
const colorType = header[9];
const interlace = header[12];

if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
  throw new Error(
    `Unsupported source PNG (bitDepth ${bitDepth}, colorType ${colorType}, interlace ${interlace}). ` +
      "This script handles 8-bit non-interlaced RGB or RGBA only.",
  );
}
if (width !== height) {
  throw new Error(`Expected a square logo, got ${width}x${height}`);
}

const sourceBytesPerPixel = colorType === 6 ? 4 : 3;
const pixels = unfilter(
  inflateSync(
    Buffer.concat(
      chunks.filter((item) => item.type === "IDAT").map((item) => item.data),
    ),
  ),
  width,
  height,
  sourceBytesPerPixel,
);

const radius = width * RADIUS_RATIO;
const stride = width * 4;
// One filter byte per scanline, all zero (None): the image is tiny and deflate
// does the compressing, so choosing a filter per line would buy nothing.
const out = Buffer.alloc(height * (stride + 1));

for (let y = 0; y < height; y += 1) {
  const rowStart = y * (stride + 1) + 1;
  for (let x = 0; x < width; x += 1) {
    const from = (y * width + x) * sourceBytesPerPixel;
    const to = rowStart + x * 4;
    out[to] = pixels[from];
    out[to + 1] = pixels[from + 1];
    out[to + 2] = pixels[from + 2];
    const alpha = coverage(x, y, width, radius);
    // Honour any alpha the source already had, so a logo that gains one later
    // does not come back fully opaque.
    const existing = colorType === 6 ? pixels[from + 3] : 255;
    out[to + 3] = Math.round(existing * alpha);
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6; // RGBA — the source had no alpha channel to mask into.
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

writeFileSync(
  OUTPUT,
  Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(out, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);

console.log(
  `Wrote ${OUTPUT} — ${width}x${height}, ${Math.round(radius)}px corner radius`,
);
