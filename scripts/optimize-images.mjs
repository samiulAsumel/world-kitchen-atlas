// Resizes/recompresses recipe hero images in place, format-preserving (no
// `heroImage` path changes needed in the data repo). Static export
// (next.config.ts: images.unoptimized) means there's no on-the-fly
// optimization at request time, so this is the only place image weight gets
// controlled. Safe to re-run on new photos as they're added — already-small
// files are skipped, and a file is only overwritten if the result is smaller.
//
// Usage: npm run optimize-images

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const IMAGES_DIR = path.join(import.meta.dirname, "..", "public", "images");
const MAX_DIMENSION = 2000; // covers the dish-detail hero's 1100px-CSS @2x retina ceiling
const SKIP_UNDER_BYTES = 300 * 1024;

async function findHeroImages(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findHeroImages(full)));
    } else if (/^hero\.(jpe?g|webp|avif|png)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function encoderFor(ext, pipeline) {
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return pipeline.jpeg({ quality: 82, mozjpeg: true });
    case ".webp":
      return pipeline.webp({ quality: 82 });
    case ".avif":
      // AVIF's perceptual quality scale runs lower than JPEG/WebP's for
      // equivalent visual fidelity — 55 here is roughly quality-82 JPEG.
      return pipeline.avif({ quality: 55 });
    case ".png":
      return pipeline.png({ quality: 82, compressionLevel: 9 });
    default:
      throw new Error(`Unhandled extension: ${ext}`);
  }
}

async function optimizeOne(filePath) {
  const before = (await stat(filePath)).size;
  const image = sharp(filePath);
  const meta = await image.metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);

  if (longEdge <= MAX_DIMENSION && before <= SKIP_UNDER_BYTES) {
    return { filePath, skipped: true, before, after: before };
  }

  const ext = path.extname(filePath).toLowerCase();
  let pipeline = sharp(filePath);
  if (longEdge > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const buffer = await encoderFor(ext, pipeline).toBuffer();

  if (buffer.length >= before) {
    return { filePath, skipped: true, before, after: before, reason: "no gain" };
  }

  await sharp(buffer).toFile(filePath);
  return { filePath, skipped: false, before, after: buffer.length };
}

async function main() {
  const files = await findHeroImages(IMAGES_DIR);
  console.log(`Found ${files.length} hero images.\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let touched = 0;

  for (const filePath of files) {
    const result = await optimizeOne(filePath);
    totalBefore += result.before;
    totalAfter += result.after;
    const rel = path.relative(IMAGES_DIR, result.filePath);
    if (result.skipped) {
      continue;
    }
    touched += 1;
    const savedPct = (100 * (1 - result.after / result.before)).toFixed(0);
    console.log(
      `${rel}: ${(result.before / 1024).toFixed(0)}KB -> ${(result.after / 1024).toFixed(0)}KB (-${savedPct}%)`,
    );
  }

  console.log(
    `\n${touched}/${files.length} files re-encoded. ` +
      `Total: ${(totalBefore / 1024 / 1024).toFixed(1)}MB -> ${(totalAfter / 1024 / 1024).toFixed(1)}MB ` +
      `(saved ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(1)}MB).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
