import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
