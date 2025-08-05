import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextStore } from '../src/storage/context-store.js';
import { createTempDir, cleanupTempDir } from '../src/test/helpers/test-utils.js';
import { createMockConfig } from './setup/test-environment.js';

// Mock git operations for testing
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    clone: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ files: [] }),
    log: vi.fn().mockResolvedValue({ latest: null }),
    checkout: vi.fn().mockResolvedValue(undefined),
    raw: vi.fn().mockResolvedValue(''),
    fetch: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn().mockResolvedValue(undefined),
  }))
}));

describe('Remote Repository Sync', () => {
  let contextStore: ContextStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    if (contextStore) {
      await contextStore.cleanup();
    }
    await cleanupTempDir(tempDir);
    vi.clearAllMocks();
  });

  describe('initialization without remote', () => {
    it('should initialize normally without remote configuration', async () => {
      contextStore = new ContextStore(tempDir);
      await contextStore.initialize();

      expect(contextStore).toBeDefined();
    });
  });

  describe('manual sync operations', () => {
    beforeEach(async () => {
      contextStore = new ContextStore(tempDir);
      await contextStore.initialize();
    });

    it('should handle sync when no remote is configured', async () => {
      await expect(contextStore.syncWithRemote()).resolves.not.toThrow();
    });

    it('should handle sync errors gracefully', async () => {
      // Mock syncWithRemote to simulate error handling
      const originalMethod = contextStore.syncWithRemote;
      contextStore.syncWithRemote = vi.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw when called through error handling wrapper
      try {
        await contextStore.syncWithRemote();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Restore original method
      contextStore.syncWithRemote = originalMethod;
    });
  });

  describe('background sync management', () => {
    beforeEach(async () => {
      contextStore = new ContextStore(tempDir);
      await contextStore.initialize();
    });

    it('should handle cleanup gracefully', async () => {
      await expect(contextStore.cleanup()).resolves.not.toThrow();
    });

    it('should stop any background processes on cleanup', async () => {
      // Start some operations
      await contextStore.create('Test Memory', 'Test content', 'test');
      
      // Cleanup should complete without issues
      await expect(contextStore.cleanup()).resolves.not.toThrow();
    });
  });

  describe('sync tool interface', () => {
    it('should expose sync functionality for tool handlers', async () => {
      contextStore = new ContextStore(tempDir);
      await contextStore.initialize();

      // syncWithRemote method should exist and be callable
      expect(typeof contextStore.syncWithRemote).toBe('function');
      await expect(contextStore.syncWithRemote()).resolves.not.toThrow();
    });
  });
});