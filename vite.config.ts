import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths: the build works under any sub-path (e.g. GitHub Pages /<repo>/).
  base: './',
  build: {
    // three.js alone is ~550 kB minified; a single chunk is fine for this app.
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
