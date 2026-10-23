// Pulls the near-black studio background of the drink photos down to pure black, so that
// `mix-blend-mode: screen` in the UI makes it disappear completely (no grey rectangle around the glass).
// Soft knee: pixels darker than LOW become black, brighter than HIGH stay untouched, smooth in between.
// Usage: node scripts/clean-drink-blacks.mjs [name ...]   (default: every file in public/img/drinks)
// Run it once per new image (right after process-drink-images.mjs); every run darkens the shadows a bit more.
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

sharp.cache(false);
const LOW = 14;
const HIGH = 58;
const dir = fileURLToPath(new URL('../public/img/drinks/', import.meta.url));
const only = process.argv.slice(2);

const smooth = x => {
  const t = Math.min(1, Math.max(0, (x - LOW) / (HIGH - LOW)));
  return t * t * (3 - 2 * t);
};

for (const f of readdirSync(dir).filter(f => f.endsWith('.webp') && (!only.length || only.some(n => f.startsWith(`${n}-`))))) {
  const path = join(dir, f);
  const { data, info } = await sharp(readFileSync(path)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    const k = smooth(Math.max(data[i], data[i + 1], data[i + 2]));
    data[i] *= k;
    data[i + 1] *= k;
    data[i + 2] *= k;
  }
  const buf = await sharp(data, { raw: info }).webp({ quality: 86 }).toBuffer();
  writeFileSync(path, buf);
  console.log(f);
}
