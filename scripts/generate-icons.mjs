// Rasterizes the site's map-pin mark (app/icon.svg's glyph) into the PNG
// icons app/manifest.ts and the app/apple-icon.png special file need —
// browsers don't accept SVG for PWA manifest icons or apple-touch-icon.
//
// Usage: npm run generate-icons

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..");
const BACKGROUND = "#120e0a"; // --parchment (app/globals.css)
const PIN_FILL = "#d4a24c"; // --turmeric (app/globals.css)
const PIN_STROKE = "#241B14";

// Original glyph from app/icon.svg, viewBox 0 0 24 32 (center at 12,16).
const PIN_PATH =
  "M12 1C5.925 1 1 5.925 1 12c0 8.5 11 18.5 11 18.5S23 20.5 23 12c0-6.075-4.925-11-11-11z";

/** A square canvas of `size`px with the pin centered at `pinHeightRatio` of the canvas height. */
function squareIconSvg(size, pinHeightRatio) {
  const scale = (size * pinHeightRatio) / 32; // 32 = glyph viewBox height
  const tx = size / 2 - 12 * scale; // 12 = glyph viewBox center x
  const ty = size / 2 - 16 * scale; // 16 = glyph viewBox center y
  // stroke-width="1.5" (the original glyph's own value, not pre-multiplied by
  // scale) — it's inside the scale() transform below, which already scales
  // stroke width along with everything else in this local coordinate system.
  // Multiplying it here too was double-scaling (quadratically, since it grows
  // with scale²), which is why early output looked fine at small sizes and
  // badly bloated at large ones.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
    <path d="${PIN_PATH}" fill="${PIN_FILL}" stroke="${PIN_STROKE}" stroke-width="1.5"
      transform="translate(${tx} ${ty}) scale(${scale})"/>
  </svg>`;
}

async function render(svg, outPath) {
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log(`wrote ${path.relative(ROOT, outPath)}`);
}

async function main() {
  const publicDir = path.join(ROOT, "public");
  await mkdir(publicDir, { recursive: true });

  // "any" purpose: generous padding, safe for square or lightly-rounded display.
  await render(squareIconSvg(192, 0.65), path.join(publicDir, "icon-192.png"));
  await render(squareIconSvg(512, 0.65), path.join(publicDir, "icon-512.png"));

  // "maskable": OS may clip to a circle/squircle/rounded-square — glyph must
  // sit inside the ~80%-diameter safe-zone circle, hence the smaller ratio.
  await render(squareIconSvg(512, 0.45), path.join(publicDir, "icon-512-maskable.png"));

  // app/apple-icon.png — Next's special-file convention (sibling to
  // app/icon.svg) auto-injects <link rel="apple-touch-icon">, no manual
  // wiring needed. iOS applies its own corner rounding to a square opaque icon.
  await render(squareIconSvg(180, 0.65), path.join(ROOT, "app", "apple-icon.png"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
