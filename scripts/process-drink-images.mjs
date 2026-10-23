// Rohbilder (PNG, schwarzer Hintergrund) -> public/img/drinks/{name}-512.webp / -1024.webp
// Aufruf: node scripts/process-drink-images.mjs <rohordner> [name ...]
// Das Motiv wird auf dem Schwarz zugeschnitten und in ein einheitliches Quadrat (80 % Füllung) gesetzt,
// damit alle Karten gleich groß wirken. Freistellung im UI: mix-blend-mode: screen auf dunkler Karte.
import sharp from 'sharp';
import { mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const [dir, ...only] = process.argv.slice(2);
if (!dir) throw new Error('Rohordner fehlt');
const out = new URL('../public/img/drinks/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(out, { recursive: true });

const files = readdirSync(dir).filter((f) => f.endsWith('.png') && (!only.length || only.includes(basename(f, '.png'))));
for (const f of files) {
  const name = basename(f, '.png');
  // Schwarz abschneiden: Pixel > 60 zählen als Motiv
  const { data, info } = await sharp(join(dir, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3;
    if (Math.max(data[i], data[i + 1], data[i + 2]) > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const crop = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  for (const size of [512, 1024]) {
    const inner = Math.round(size * 0.82);
    const motif = await sharp(join(dir, f)).extract(crop).resize(inner, inner, { fit: 'inside' }).toBuffer();
    await sharp({ create: { width: size, height: size, channels: 3, background: '#000' } })
      .composite([{ input: motif, gravity: 'centre' }])
      .webp({ quality: 86 })
      .toFile(join(out, `${name}-${size}.webp`));
  }
  console.log(name, crop.width + 'x' + crop.height);
}
