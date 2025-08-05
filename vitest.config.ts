import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts',
        'src/scripts/**',
        'tests/setup/**',
      ],
    },
    testTimeout: 30000, // Increased for ChromaDB startup
    hookTimeout: 30000,
    setupFiles: ['tests/setup/test-setup.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],
  },
});