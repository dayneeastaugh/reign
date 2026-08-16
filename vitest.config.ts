import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Hard boards are the slowest thing the engine does — several seconds for a
    // sweep of seeds. The default 5s timeout sits close enough to that to flake.
    testTimeout: 60_000,
  },
});
