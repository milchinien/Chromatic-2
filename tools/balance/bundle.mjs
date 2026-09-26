// Bündelt ein TS-Einstiegsskript für Node (rolldown liegt als Vite-Abhängigkeit bereit).
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pnpm = join(root, 'node_modules', '.pnpm');
const dir = readdirSync(pnpm).find((d) => d.startsWith('rolldown@'));
const { build } = await import(pathToFileURL(join(pnpm, dir, 'node_modules', 'rolldown', 'dist', 'index.mjs')).href);

export async function bundle(entry, out) {
  await build({ input: entry, platform: 'node', logLevel: 'silent', output: { file: out, format: 'esm', codeSplitting: false } });
}
