import { createServer } from 'node:net';
import { defineConfig, type Plugin } from 'vite';

const PREFERRED_PORT = 3100;

// Windows lets separate sockets share a port across these addresses, so a
// port only counts as free if every one of them can be bound.
const HOSTS = ['0.0.0.0', '127.0.0.1', '::', '::1'];

function canBind(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    // Missing IPv6 support is not a conflict.
    srv.once('error', (e: { code?: string }) =>
      resolve(e.code === 'EADDRNOTAVAIL' || e.code === 'EAFNOSUPPORT'),
    );
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
}

async function isPortFree(port: number): Promise<boolean> {
  for (const host of HOSTS) {
    if (!(await canBind(port, host))) return false;
  }
  return true;
}

async function findFreePort(start: number): Promise<number> {
  for (let port = start; port < start + 100; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`Kein freier Port zwischen ${start} und ${start + 99}`);
}

/**
 * Offline-Version zum Weitergeben (`pnpm package`): läuft per Doppelklick
 * direkt von der Festplatte (file://). Browser blockieren dort Module,
 * Worker-Dateien und crossorigin-Anfragen, deshalb: ein klassisches Skript,
 * Schriften eingebettet, keine crossorigin-Attribute.
 */
function offlineHtml(): Plugin {
  return {
    name: 'offline-html',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin/g, '<script defer')
        .replace(/ crossorigin/g, '')
        .replace(/<link rel="modulepreload"[^>]*>/g, '');
    },
  };
}

export default defineConfig(async ({ command, mode }) => {
  const offline = mode === 'offline';
  return {
    base: './',
    server:
      command === 'serve'
        ? { port: await findFreePort(PREFERRED_PORT), strictPort: true }
        : undefined,
    plugins: offline ? [offlineHtml()] : [],
    build: offline
      ? {
          target: 'es2022',
          outDir: 'dist-offline',
          modulePreload: false,
          // Schriften einbetten, Bilder bleiben Dateien
          assetsInlineLimit: (file: string) => /\.woff2?$/.test(file),
          rollupOptions: {
            input: { main: 'index.html' },
            output: { format: 'iife', inlineDynamicImports: true },
          },
        }
      : {
          target: 'es2022',
          rollupOptions: { input: { main: 'index.html', lab: 'ui-lab.html', sandbox: 'sandbox.html', balance: 'balance.html' } },
        },
  };
});
