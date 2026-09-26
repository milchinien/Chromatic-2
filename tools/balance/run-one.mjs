// Aufruf: node tools/balance/run-one.mjs <skript.ts> [args…] – bündelt und startet ein Skript.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bundle } from './bundle.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [entry] = process.argv.slice(2);
mkdirSync(join(here, '.out'), { recursive: true });
const out = join(here, '.out', entry.replace(/\.ts$/, '.mjs'));
await bundle(join(here, entry), out);
await import(pathToFileURL(out).href);
