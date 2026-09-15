import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    allowOnly: false,
    passWithNoTests: false,
    dangerouslyIgnoreUnhandledErrors: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
