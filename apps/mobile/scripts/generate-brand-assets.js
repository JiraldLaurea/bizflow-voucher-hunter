/**
 * Renders the Voucher Hunt launcher/splash assets from code so they stay in step
 * with the brand tokens instead of drifting as hand-exported PNGs.
 *
 * The mark is the same one `BrandMark` draws in the app and `.logo-tile` draws on
 * the web: a purple gradient tile carrying a white "%". It is built from geometry
 * (two rings and a slash) rather than a font, so there is no typeface dependency.
 *
 *   node scripts/generate-brand-assets.js
 *
 * Re-run after changing the purple in `src/theme.ts`.
 */
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

/** `--purple` and `--purple-2` from the web's globals.css. */
const PURPLE = [0x5c, 0x3d, 0xff];
const PURPLE_2 = [0x7c, 0x4d, 0xff];

/** Samples per axis. 4x4 per pixel is enough to keep the ring edges smooth. */
const SS = 4;

/**
 * Signed coverage of the "%" mark at a point in the normalised glyph box, where
 * 0,0 is top-left and 1,1 bottom-right. Returns true when the point is inked.
 */
function inGlyph(x, y) {
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

  // Diagonal slash, as a capsule between two points.
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

/** Coverage in [0,1] for one pixel, by supersampling the glyph test. */
function glyphCoverage(px, py, size, scale, offset) {
  let hits = 0;
  for (let sy = 0; sy < SS; sy += 1) {
    for (let sx = 0; sx < SS; sx += 1) {
      const x = (px + (sx + 0.5) / SS) / size;
      const y = (py + (sy + 0.5) / SS) / size;
      // Map the canvas point into the glyph box.
      const gx = (x - offset) / scale;
      const gy = (y - offset) / scale;
      if (gx >= 0 && gx <= 1 && gy >= 0 && gy <= 1 && inGlyph(gx, gy)) hits += 1;
    }
  }
  return hits / (SS * SS);
}

/** 135° gradient between the two brand purples, matching `.logo-tile`. */
function gradientAt(x, y) {
  const t = Math.max(0, Math.min(1, (x + y) / 2));
  return [
    Math.round(PURPLE[0] + (PURPLE_2[0] - PURPLE[0]) * t),
    Math.round(PURPLE[1] + (PURPLE_2[1] - PURPLE[1]) * t),
    Math.round(PURPLE[2] + (PURPLE_2[2] - PURPLE[2]) * t),
  ];
}

/**
 * @param {object} options
 * @param {number} options.size          canvas edge in px
 * @param {"gradient"|"none"} options.background
 * @param {boolean} options.mark         draw the "%" glyph
 * @param {number} options.scale         glyph edge as a fraction of the canvas
 */
function render({ size, background, mark, scale }) {
  const png = new PNG({ width: size, height: size });
  const offset = (1 - scale) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (size * y + x) << 2;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      if (background === "gradient") {
        const [gr, gg, gb] = gradientAt(x / size, y / size);
        r = gr;
        g = gg;
        b = gb;
        a = 255;
      }

      if (mark) {
        const coverage = glyphCoverage(x, y, size, scale, offset);
        if (coverage > 0) {
          // White mark composited over whatever the background left behind.
          const outA = coverage + (a / 255) * (1 - coverage);
          r = Math.round((255 * coverage + r * (a / 255) * (1 - coverage)) / outA);
          g = Math.round((255 * coverage + g * (a / 255) * (1 - coverage)) / outA);
          b = Math.round((255 * coverage + b * (a / 255) * (1 - coverage)) / outA);
          a = Math.round(outA * 255);
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return png;
}

function write(name, png) {
  const target = path.join(__dirname, "..", "assets", "images", name);
  fs.writeFileSync(target, PNG.sync.write(png));
  console.log(`wrote ${name} (${png.width}x${png.height})`);
}

// Store icon / iOS: full-bleed, no transparency, no rounding — the OS masks it.
write("icon.png", render({ size: 1024, background: "gradient", mark: true, scale: 0.56 }));

// Adaptive icon: Android crops to a shape and can parallax the layers, so the
// mark has to sit inside the central 66% safe zone.
write(
  "android-icon-foreground.png",
  render({ size: 512, background: "none", mark: true, scale: 0.42 }),
);
write(
  "android-icon-background.png",
  render({ size: 512, background: "gradient", mark: false, scale: 1 }),
);
// Themed icons are tinted by the system from the alpha channel alone.
write(
  "android-icon-monochrome.png",
  render({ size: 512, background: "none", mark: true, scale: 0.42 }),
);

// Splash: the mark alone, on the purple the splash config paints behind it.
write("splash-icon.png", render({ size: 512, background: "none", mark: true, scale: 0.72 }));

write("favicon.png", render({ size: 48, background: "gradient", mark: true, scale: 0.6 }));
