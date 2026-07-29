/**
 * Renders the Voucher Hunt launcher/splash assets from the approved app logo.
 *
 * Full-color assets use `voucher-hunt-app-logo.png`: a purple 3D voucher ticket
 * carrying a white percent symbol. Android's themed icon remains alpha-only, so
 * the monochrome layer is generated from geometry and tinted by the OS.
 *
 *   node scripts/generate-brand-assets.js
 */
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const SS = 4;

function inPercentGlyph(x, y) {
  const ringOuter = 0.165;
  const ringInner = 0.08;
  const rings = [
    [0.27, 0.235],
    [0.73, 0.765],
  ];

  for (const [cx, cy] of rings) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= ringOuter && d >= ringInner) return true;
  }

  const ax = 0.19;
  const ay = 0.85;
  const bx = 0.81;
  const by = 0.15;
  const half = 0.062;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = ((x - ax) * dx + (y - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.hypot(x - px, y - py) <= half;
}

function glyphCoverage(px, py, size, scale, offset) {
  let hits = 0;
  for (let sy = 0; sy < SS; sy += 1) {
    for (let sx = 0; sx < SS; sx += 1) {
      const x = (px + (sx + 0.5) / SS) / size;
      const y = (py + (sy + 0.5) / SS) / size;
      const gx = (x - offset) / scale;
      const gy = (y - offset) / scale;
      if (gx >= 0 && gx <= 1 && gy >= 0 && gy <= 1 && inPercentGlyph(gx, gy)) {
        hits += 1;
      }
    }
  }
  return hits / (SS * SS);
}

function renderMonochromePercent({ size, scale }) {
  const png = new PNG({ width: size, height: size });
  const offset = (1 - scale) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (size * y + x) << 2;
      const coverage = glyphCoverage(x, y, size, scale, offset);
      png.data[idx] = 255;
      png.data[idx + 1] = 255;
      png.data[idx + 2] = 255;
      png.data[idx + 3] = Math.round(coverage * 255);
    }
  }

  return png;
}

function readArtwork() {
  const source = path.join(
    __dirname,
    "..",
    "assets",
    "images",
    "voucher-hunt-app-logo.png",
  );
  return PNG.sync.read(fs.readFileSync(source));
}

function sampleNearest(png, x, y) {
  const sx = Math.max(0, Math.min(png.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(png.height - 1, Math.round(y)));
  const idx = (png.width * sy + sx) << 2;
  return [
    png.data[idx],
    png.data[idx + 1],
    png.data[idx + 2],
    png.data[idx + 3],
  ];
}

function resizeArtwork(source, size) {
  const png = new PNG({ width: size, height: size });
  const scale = Math.min(size / source.width, size / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (size * y + x) << 2;
      const srcX = (x - offsetX) / scale;
      const srcY = (y - offsetY) / scale;
      const color = sampleNearest(source, srcX, srcY);
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }

  return png;
}

function write(name, png) {
  const target = path.join(__dirname, "..", "assets", "images", name);
  fs.writeFileSync(target, PNG.sync.write(png));
  console.log(`wrote ${name} (${png.width}x${png.height})`);
}

const artwork = readArtwork();

write("icon.png", resizeArtwork(artwork, 1024));
write("android-icon-foreground.png", resizeArtwork(artwork, 512));
write("android-icon-background.png", resizeArtwork(artwork, 512));
write("android-icon-monochrome.png", renderMonochromePercent({ size: 512, scale: 0.42 }));
write("splash-icon.png", resizeArtwork(artwork, 512));
write("favicon.png", resizeArtwork(artwork, 48));
