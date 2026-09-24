import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 3100, strictPort: false },
  build: { target: 'es2022' },
});
