import { createServer } from 'node:net';
import { defineConfig } from 'vite';

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

export default defineConfig(async ({ command }) => ({
  base: './',
  server:
    command === 'serve'
      ? { port: await findFreePort(PREFERRED_PORT), strictPort: true }
      : undefined,
  build: { target: 'es2022' },
}));
