#!/usr/bin/env node
/**
 * Generates Even Steven app icons as PNG files using pngjs.
 * Design: dark #0b0b0b background + the "=" monogram in #00C896 (accent green).
 * The "=" is the visual identity of "Even Steven" — equal, balanced, fair.
 *
 * Run: node scripts/generate-icons.js
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;

// Brand colours
const BG    = { r: 11,  g: 11,  b: 11,  a: 255 };   // #0b0b0b
const GREEN = { r: 0,   g: 200, b: 150, a: 255 };   // #00C896
const TRANS = { r: 0,   g: 0,   b: 0,   a: 0   };   // transparent

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Signed distance from point (px, py) to a rounded rectangle centred at (cx, cy). */
function sdfRoundedRect(px, py, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(px - cx) - halfW + r;
  const qy = Math.abs(py - cy) - halfH + r;
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - r;
}

/** Anti-aliased fill: returns alpha in [0, 1] based on SDF. */
function coverage(sdf, aa = 1.5) {
  return clamp(0.5 - sdf / aa, 0, 1);
}

/** Blend src over dst. */
function blend(dst, src, alpha) {
  return {
    r: Math.round(dst.r * (1 - alpha) + src.r * alpha),
    g: Math.round(dst.g * (1 - alpha) + src.g * alpha),
    b: Math.round(dst.b * (1 - alpha) + src.b * alpha),
    a: Math.round(dst.a + (255 - dst.a) * alpha),
  };
}

/** Set pixel (x, y) in a PNG buffer. */
function setPixel(data, x, y, c) {
  const idx = (SIZE * y + x) * 4;
  data[idx]     = c.r;
  data[idx + 1] = c.g;
  data[idx + 2] = c.b;
  data[idx + 3] = c.a;
}

/** Paint a rounded rectangle onto a pixel buffer with anti-aliasing. */
function paintRoundedRect(data, bg, fg, cx, cy, halfW, halfH, radius) {
  const x0 = Math.max(0, Math.floor(cx - halfW - 4));
  const x1 = Math.min(SIZE - 1, Math.ceil(cx + halfW + 4));
  const y0 = Math.max(0, Math.floor(cy - halfH - 4));
  const y1 = Math.min(SIZE - 1, Math.ceil(cy + halfH + 4));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const sdf = sdfRoundedRect(x, y, cx, cy, halfW, halfH, radius);
      const a = coverage(sdf);
      if (a <= 0) continue;
      const idx = (SIZE * y + x) * 4;
      const dst = {
        r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3],
      };
      const out = blend(dst, fg, a);
      data[idx]     = out.r;
      data[idx + 1] = out.g;
      data[idx + 2] = out.b;
      data[idx + 3] = out.a;
    }
  }
}

// ---------------------------------------------------------------------------
// Icon composition
// ---------------------------------------------------------------------------

/**
 * Draw the "=" bars centred in a SIZE×SIZE buffer.
 * barW   – width of each bar
 * barH   – height of each bar
 * gap    – vertical gap between the two bars
 * radius – corner radius
 */
function drawEquals(data, barW, barH, gap, radius, fg) {
  const totalH = barH * 2 + gap;
  const cx = SIZE / 2;
  const topBarCY    = SIZE / 2 - gap / 2 - barH / 2;
  const bottomBarCY = SIZE / 2 + gap / 2 + barH / 2;

  paintRoundedRect(data, null, fg, cx, topBarCY,    barW / 2, barH / 2, radius);
  paintRoundedRect(data, null, fg, cx, bottomBarCY, barW / 2, barH / 2, radius);
}

// ---------------------------------------------------------------------------
// Generate a full icon (opaque background + "=")
// ---------------------------------------------------------------------------

function generateIcon(bgColour, fgColour) {
  const png  = new PNG({ width: SIZE, height: SIZE, filterType: -1 });
  const data = png.data;

  // Fill background
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4]     = bgColour.r;
    data[i * 4 + 1] = bgColour.g;
    data[i * 4 + 2] = bgColour.b;
    data[i * 4 + 3] = bgColour.a;
  }

  // Draw "=" — proportions tuned for legibility at small sizes
  const barW  = 480;
  const barH  = 88;
  const gap   = 100;
  const radius = 44;
  drawEquals(data, barW, barH, gap, radius, fgColour);

  return png;
}

// ---------------------------------------------------------------------------
// Generate adaptive icon foreground (transparent bg + "=")
// ---------------------------------------------------------------------------

function generateAdaptiveIcon(fgColour) {
  const png  = new PNG({ width: SIZE, height: SIZE, filterType: -1 });
  const data = png.data;

  // Transparent background
  data.fill(0);

  // Draw "=" slightly smaller to account for Android's safe zone (66% of canvas)
  const barW  = 380;
  const barH  = 70;
  const gap   = 80;
  const radius = 35;
  drawEquals(data, barW, barH, gap, radius, fgColour);

  return png;
}

// ---------------------------------------------------------------------------
// Generate splash icon (wordmark-style: large "=" on dark bg)
// ---------------------------------------------------------------------------

function generateSplash(bgColour, fgColour) {
  const png  = new PNG({ width: SIZE, height: SIZE, filterType: -1 });
  const data = png.data;

  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4]     = bgColour.r;
    data[i * 4 + 1] = bgColour.g;
    data[i * 4 + 2] = bgColour.b;
    data[i * 4 + 3] = bgColour.a;
  }

  // Larger "=" for splash
  const barW  = 560;
  const barH  = 80;
  const gap   = 110;
  const radius = 40;
  drawEquals(data, barW, barH, gap, radius, fgColour);

  return png;
}

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------

function writePng(png, filePath) {
  const buf = PNG.sync.write(png);
  fs.writeFileSync(filePath, buf);
  const kb = (buf.byteLength / 1024).toFixed(1);
  console.log(`✓ ${path.basename(filePath)}  (${kb} KB)`);
}

const assetsDir = path.join(__dirname, '..', 'assets');

console.log('Generating Even Steven icons...\n');

writePng(generateIcon(BG, GREEN),          path.join(assetsDir, 'icon.png'));
writePng(generateAdaptiveIcon(GREEN),      path.join(assetsDir, 'adaptive-icon.png'));
writePng(generateSplash(BG, GREEN),        path.join(assetsDir, 'splash-icon.png'));
// favicon – a small version for web
writePng(generateIcon(BG, GREEN),          path.join(assetsDir, 'favicon.png'));

console.log('\nDone. Run `eas update --branch preview` to push to device.');
