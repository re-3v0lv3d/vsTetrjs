import { defineConfig } from 'vite';

/** Relative base works on GitHub Pages project sites and local preview */
export default defineConfig({
  base: process.env.VITE_BASE || './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
});
