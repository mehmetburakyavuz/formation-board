import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // three.js alone is ~550 kB minified; a single chunk is fine for this app.
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
