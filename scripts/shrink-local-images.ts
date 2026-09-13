/**
 * Re-encode the images that ship with the storefront.
 *
 * This runtime has no image optimiser: `/_next/image` 302s straight back to
 * the original file, so a 2 MB PNG in `public/images` is 2 MB on somebody's
 * phone. Product photography goes through Supabase, which resizes on request —
 * these few do not, so they are encoded properly once, here.
 *
 * The originals are left exactly where they are. Nothing is deleted and no
 * image is cropped or re-framed: each one keeps its aspect ratio and is capped
 * at a width beyond which no screen can show the difference, then written as
 * WebP beside the original. Only the reference in the code moves.
 *
 *   npx tsx scripts/shrink-local-images.ts
 */

import { readdir, stat } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import sharp from 'sharp';

const ROOT = 'apps/storefront/public/images';

/**
 * The widest any of these is ever drawn, doubled for a dense screen. A hero
 * spans the viewport; an emblem is a few dozen pixels across and asking for
 * more of it is pure waste.
 */
const MAX_WIDTH: Record<string, number> = {
  'saree-homepage-hero.png': 1800,
  'artisan-loom-story.png': 1600,
  'saree-catalog-four-panel.png': 1600,
  'drape-1.png': 1400,
  'drape-2.png': 1400,
  'drape-3.png': 1400,
  'drape-4.png': 1400,
  'mridul-wordmark.png': 800,
  'mridul-emblem.png': 320,
  'mridul-logo.jpg': 900,
};

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

let before = 0;
let after = 0;

for await (const file of walk(ROOT)) {
  const ext = extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;

  const name = basename(file);
  const width = MAX_WIDTH[name];
  if (!width) {
    console.log(`skipped (no width set) ${name}`);
    continue;
  }

  const original = (await stat(file)).size;
  const target = join(dirname(file), `${basename(file, ext)}.webp`);

  const image = sharp(file);
  const meta = await image.metadata();
  // `withoutEnlargement` so a file already smaller than the cap is re-encoded
  // rather than stretched.
  await image
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(target);

  const size = (await stat(target)).size;
  before += original;
  after += size;
  console.log(
    `${name.padEnd(30)} ${String(meta.width).padStart(5)}px ${kb(original).padStart(9)}` +
      ` ->  ${kb(size).padStart(8)}  ${basename(target)}`,
  );
}

console.log(`\ntotal ${kb(before)} -> ${kb(after)}`);
