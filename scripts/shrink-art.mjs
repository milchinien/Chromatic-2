// Verkleinert die Bilder der Offline-/Web-Version (sharp, läuft ohne Python).
//   Kartenbilder: PNG 1536×1024 → WebP 768×512 (im Spiel werden sie viel kleiner gezeigt)
//   Raumbilder:   WebP neu kodiert (gleiche Größe, etwas stärkere Kompression)
// Aufruf: node scripts/shrink-art.mjs <ordner der offline-version>

import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = process.argv[2];
let saved = 0;

const cards = join(root, 'card-art', 'v2');
for (const f of readdirSync(cards).filter((n) => n.endsWith('.png'))) {
  const src = join(cards, f);
  const out = src.replace(/\.png$/, '.webp');
  const before = statSync(src).size;
  const img = sharp(src);
  const { width = 1536 } = await img.metadata();
  await img.resize({ width: Math.round(width / 2), kernel: 'lanczos3' }).webp({ quality: 86, effort: 6 }).toFile(out);
  rmSync(src);
  saved += before - statSync(out).size;
}

const rooms = join(root, 'room-art');
for (const f of readdirSync(rooms).filter((n) => n.endsWith('.webp'))) {
  const p = join(rooms, f);
  const before = statSync(p).size;
  const buf = await sharp(readFileSync(p)).webp({ quality: 82, effort: 6 }).toBuffer();
  if (buf.length < before) {
    writeFileSync(p, buf);
    saved += before - buf.length;
  }
}

console.log(`Bilder verkleinert, ${(saved / 1e6).toFixed(0)} MB gespart`);
