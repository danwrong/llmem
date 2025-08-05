import { beforeAll } from 'vitest';
import { setupTestMocks } from './test-environment.js';

beforeAll(async () => {
  // Setup mocks for unit tests (integration tests don't use this setup)
  setupTestMocks();
});