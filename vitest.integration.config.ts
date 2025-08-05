import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    env: {
      NODE_ENV: 'test'
    },
    testTimeout: 45000, // Longer timeout for integration tests
    hookTimeout: 45000,
    // No setupFiles - we want to avoid mocking for integration tests
    globalSetup: ['tests/setup/global-setup.ts'],
  },
});