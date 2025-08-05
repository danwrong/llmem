import { beforeAll } from 'vitest';
import { setupTestMocks } from './test-environment.js';

beforeAll(() => {
  // Setup conditional mocks based on test environment
  setupTestMocks();
});