// Baut die Version zum Weitergeben: `pnpm package`
//   1. Offline-Build (läuft per Doppelklick von der Festplatte, siehe vite.config.ts)
//   2. Nur die Dateien behalten, die das Spiel braucht
//   3. Bilder verkleinern (sharp)
//   4. Anleitung dazu und alles als release/Chromatic-2.zip packen
// Mit `--web` (pnpm build:web) endet es nach Schritt 3: dist-offline/ ist dann
// die schlanke Web-Version für GitHub Pages.

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-offline');
const name = 'Chromatic 2';
const release = join(root, 'release');
const stage = join(release, name);
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const webOnly = process.argv.includes('--web');

console.log('› Offline-Build …');
run('pnpm exec tsc --noEmit');
run('pnpm exec vite build --mode offline');

// Unbenutztes entfernen: alte Kartenbilder (v1), Arbeitsdateien der Bildgenerierung
console.log('› Aufräumen …');
const cardArt = join(out, 'card-art');
for (const f of readdirSync(cardArt)) if (f !== 'v2') rmSync(join(cardArt, f), { recursive: true, force: true });
for (const f of readdirSync(join(cardArt, 'v2'))) if (!f.endsWith('.png')) rmSync(join(cardArt, 'v2', f));

// Prüfen, dass kein Modul-Skript übrig ist (würde von file:// blockiert)
const html = readFileSync(join(out, 'index.html'), 'utf8');
if (/type="module"|crossorigin/.test(html)) throw new Error('index.html enthält noch Modul-Skripte');
for (const f of readdirSync(join(out, 'assets'))) {
  if (f.endsWith('.js') && /import\.meta|^import |\bexport \{/m.test(readFileSync(join(out, 'assets', f), 'utf8'))) throw new Error(`${f} ist kein klassisches Skript`);
}

console.log('› Bilder verkleinern …');
run(`node "${join(root, 'scripts', 'shrink-art.mjs')}" "${out}"`);

if (webOnly) {
  console.log('\n✓ Web-Version fertig: dist-offline/');
  process.exit(0);
}

// Paket zusammenstellen
rmSync(release, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(out, join(stage, 'game'), { recursive: true });
renameSync(join(stage, 'game', 'index.html'), join(stage, 'game', 'Chromatic 2.html'));
// Startdatei direkt im Hauptordner: leitet in den Spielordner weiter
writeFileSync(
  join(stage, 'Chromatic 2 spielen.html'),
  `<!doctype html><meta charset="utf-8"><title>Chromatic 2</title><meta http-equiv="refresh" content="0; url=game/Chromatic%202.html"><a href="game/Chromatic%202.html">Chromatic 2 starten</a>`,
);
writeFileSync(
  join(stage, 'LIESMICH.txt'),
  [
    'CHROMATIC 2',
    '===========',
    '',
    'So startest du das Spiel:',
    '  1. Die ZIP-Datei komplett entpacken (Rechtsklick → "Alle extrahieren").',
    '     Wichtig: nicht direkt aus der ZIP heraus öffnen.',
    '  2. Im entpackten Ordner "Chromatic 2 spielen.html" doppelklicken.',
    '     Das Spiel öffnet sich im Browser (Chrome, Edge oder Firefox).',
    '',
    'Hinweise:',
    '  - Keine Installation und kein Internet nötig.',
    '  - Der Spielstand wird im Browser gespeichert ("Continue" im Hauptmenü).',
    '  - Ton an/aus: Taste M oder im Menü unter Settings.',
    '  - Vollbild: startet beim ersten Klick automatisch, ESC verlässt es.',
    '',
    'Viel Spaß!',
    '',
  ].join('\r\n'),
);

console.log('› ZIP packen …');
const zip = join(release, 'Chromatic-2.zip');
// Windows: das eingebaute bsdtar kann ZIP (das tar aus Git Bash nicht); sonst zip
const winTar = join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'tar.exe');
if (process.platform === 'win32' && existsSync(winTar)) execSync(`"${winTar}" -a -c -f Chromatic-2.zip "${name}"`, { cwd: release, stdio: 'inherit' });
else execSync(`zip -r -q Chromatic-2.zip "${name}"`, { cwd: release, stdio: 'inherit' });

const size = (p) => {
  let n = 0;
  for (const f of readdirSync(p)) {
    const q = join(p, f);
    n += statSync(q).isDirectory() ? size(q) : statSync(q).size;
  }
  return n;
};
console.log(`\n✓ Fertig: release/Chromatic-2.zip (${(statSync(zip).size / 1e6).toFixed(1)} MB, entpackt ${(size(stage) / 1e6).toFixed(1)} MB)`);
if (!existsSync(zip)) process.exit(1);
