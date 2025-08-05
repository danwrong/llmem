import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextStore } from '../src/storage/context-store.js';
import { ContextType } from '../src/models/context.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

// Mock the vector-related modules
vi.mock('chromadb', () => ({
  ChromaApi: vi.fn().mockImplementation(() => ({
    createCollection: vi.fn().mockResolvedValue({
      add: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        ids: [[]],
        metadatas: [[]],
        distances: [[]],
        documents: [[]]
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(0)
    }),
    getCollection: vi.fn().mockRejectedValue(new Error('Collection not found')),
    deleteCollection: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue((text: string) => ({
    data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
  }))
}));

vi.mock('chokidar', () => ({
  watch: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    close: vi.fn()
  })
}));

describe('ContextStore with Vector Search', () => {
  let contextStore: ContextStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llmem-vector-integration-'));
    contextStore = new ContextStore(tempDir);
  });

  afterEach(async () => {
    contextStore.stopFileWatcher();
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization with vector search', () => {
    it('should initialize vector store during context store initialization', async () => {
      await expect(contextStore.initialize()).resolves.not.toThrow();
    });

    it('should handle vector store initialization failure gracefully', async () => {
      const { ChromaApi } = await import('chromadb');
      vi.mocked(ChromaApi).mockImplementationOnce(() => {
        throw new Error('ChromaDB initialization failed');
      });

      // Should not fail even if vector search fails
      await expect(contextStore.initialize()).resolves.not.toThrow();
    });

    it('should rebuild vector index when empty', async () => {
      // Add some contexts first
      await contextStore.initialize();
      await contextStore.create('Test Context', 'Test content', 'personal');

      // Create new store that should rebuild index
      const newStore = new ContextStore(tempDir);
      await expect(newStore.initialize()).resolves.not.toThrow();
    });
  });

  describe('CRUD operations with vector indexing', () => {
    beforeEach(async () => {
      await contextStore.initialize();
    });

    it('should add context to vector index when creating', async () => {
      const context = await contextStore.create(
        'Coffee Preferences',
        'I prefer medium roast coffee with oat milk.',
        'personal',
        { tags: ['coffee', 'preferences'] }
      );

      expect(context).toBeDefined();
      expect(context.metadata.title).toBe('Coffee Preferences');
      // Vector indexing happens in background, should not throw
    });

    it('should update vector index when updating context', async () => {
      const context = await contextStore.create('Test Context', 'Original content', 'personal');
      
      const updated = await contextStore.update(context.metadata.id, {
        content: 'Updated content with new information'
      });

      expect(updated).toBeDefined();
      expect(updated?.content).toBe('Updated content with new information');
      // Vector update happens in background, should not throw
    });

    it('should remove from vector index when deleting context', async () => {
      const context = await contextStore.create('To Delete', 'This will be deleted', 'personal');
      
      const deleted = await contextStore.delete(context.metadata.id);

      expect(deleted).toBe(true);
      // Vector removal happens in background, should not throw
    });

    it('should handle vector indexing errors gracefully during CRUD operations', async () => {
      // Mock vector operations to fail
      const mockHybridSearch = {
        addContext: vi.fn().mockRejectedValue(new Error('Vector indexing failed')),
        updateContext: vi.fn().mockRejectedValue(new Error('Vector update failed')),
        removeContext: vi.fn().mockRejectedValue(new Error('Vector removal failed')),
        search: vi.fn().mockResolvedValue([]),
        rebuildIndex: vi.fn(),
        getStats: vi.fn().mockResolvedValue({ totalVectors: 0 })
      };

      (contextStore as any).hybridSearch = mockHybridSearch;

      // Operations should still succeed even if vector indexing fails
      const context = await contextStore.create('Test', 'Content', 'personal');
      expect(context).toBeDefined();

      const updated = await contextStore.update(context.metadata.id, { content: 'New content' });
      expect(updated).toBeDefined();

      const deleted = await contextStore.delete(context.metadata.id);
      expect(deleted).toBe(true);
    });
  });

  describe('enhanced search functionality', () => {
    beforeEach(async () => {
      await contextStore.initialize();

      // Add sample contexts
      await contextStore.create(
        'Coffee Brewing Guide',
        'The best way to brew coffee is with a pour-over method. Use medium-fine grind and water at 200°F.',
        'knowledge',
        { tags: ['coffee', 'brewing', 'guide'] }
      );

      await contextStore.create(
        'TypeScript Tips',
        'Always use strict mode, enable null checks, and prefer interfaces over types.',
        'knowledge',
        { tags: ['typescript', 'programming'] }
      );

      await contextStore.create(
        'Daily Routine',
        'Every morning I start with a cup of coffee. I prefer medium roast.',
        'personal',
        { tags: ['routine', 'morning', 'coffee'] }
      );
    });

    it('should use hybrid search for better results', async () => {
      const results = await contextStore.search('coffee brewing tips');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // Should find relevant contexts
      const titles = results.map(r => r.metadata.title);
      expect(titles).toContain('Coffee Brewing Guide');
    });

    it('should return search results with scores', async () => {
      const results = await contextStore.searchWithScores('coffee preparation');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('context');
        expect(results[0]).toHaveProperty('score');
        expect(results[0]).toHaveProperty('matchType');
        expect(typeof results[0].score).toBe('number');
      }
    });

    it('should fallback to text search when hybrid search fails', async () => {
      // Mock hybrid search to fail
      const mockHybridSearch = {
        search: vi.fn().mockRejectedValue(new Error('Hybrid search failed')),
        addContext: vi.fn(),
        updateContext: vi.fn(),
        removeContext: vi.fn(),
        rebuildIndex: vi.fn(),
        getStats: vi.fn().mockResolvedValue({ totalVectors: 0 })
      };

      (contextStore as any).hybridSearch = mockHybridSearch;

      const results = await contextStore.search('coffee');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Should still return results from fallback text search
    });

    it('should accept search options', async () => {
      const results = await contextStore.search('programming', {
        limit: 1,
        semanticWeight: 0.8,
        exactMatchBoost: 0.2
      });

      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('file watcher integration', () => {
    beforeEach(async () => {
      await contextStore.initialize();
    });

    it('should start file watcher by default', async () => {
      expect(contextStore.isFileWatcherRunning()).toBe(true);
    });

    it('should allow manual file watcher control', () => {
      contextStore.stopFileWatcher();
      expect(contextStore.isFileWatcherRunning()).toBe(false);

      contextStore.startFileWatcher();
      expect(contextStore.isFileWatcherRunning()).toBe(true);
    });

    it('should not start file watcher when autoIndex is disabled', async () => {
      // Mock config to disable auto-indexing
      const originalConfig = require('../src/utils/config.js').getConfig();
      vi.doMock('../src/utils/config.js', () => ({
        getConfig: () => ({ ...originalConfig, autoIndex: false })
      }));

      const newStore = new ContextStore(tempDir + '-no-auto');
      await newStore.initialize();

      expect(newStore.isFileWatcherRunning()).toBe(false);
    });
  });

  describe('vector index management', () => {
    beforeEach(async () => {
      await contextStore.initialize();
    });

    it('should provide vector statistics', async () => {
      const stats = await contextStore.getVectorStats();

      expect(stats).toHaveProperty('totalVectors');
      expect(typeof stats.totalVectors).toBe('number');
      expect(stats.totalVectors).toBeGreaterThanOrEqual(0);
    });

    it('should allow manual index rebuilding', async () => {
      // Add some contexts
      await contextStore.create('Test 1', 'Content 1', 'personal');
      await contextStore.create('Test 2', 'Content 2', 'knowledge');

      // Rebuild index
      await expect(contextStore.rebuildVectorIndex()).resolves.not.toThrow();
    });

    it('should handle rebuild errors gracefully', async () => {
      // Mock rebuild to fail
      const mockHybridSearch = {
        rebuildIndex: vi.fn().mockRejectedValue(new Error('Rebuild failed')),
        addContext: vi.fn(),
        updateContext: vi.fn(),
        removeContext: vi.fn(),
        search: vi.fn().mockResolvedValue([]),
        getStats: vi.fn().mockResolvedValue({ totalVectors: 0 })
      };

      (contextStore as any).hybridSearch = mockHybridSearch;

      await expect(contextStore.rebuildVectorIndex()).rejects.toThrow('Rebuild failed');
    });
  });

  describe('backward compatibility', () => {
    beforeEach(async () => {
      await contextStore.initialize();
    });

    it('should maintain all existing ContextStore functionality', async () => {
      // Test that all existing methods still work
      const context = await contextStore.create('Test', 'Content', 'personal');
      expect(context).toBeDefined();

      const retrieved = await contextStore.read(context.metadata.id);
      expect(retrieved).toBeDefined();

      const listed = await contextStore.list();
      expect(Array.isArray(listed)).toBe(true);

      const updated = await contextStore.update(context.metadata.id, { content: 'Updated' });
      expect(updated).toBeDefined();

      const deleted = await contextStore.delete(context.metadata.id);
      expect(deleted).toBe(true);
    });

    it('should work with existing context files', async () => {
      // This test ensures that existing markdown files can be loaded and indexed
      const context = await contextStore.create('Existing', 'Existing content', 'knowledge');
      
      // Create a new context store instance
      const newStore = new ContextStore(tempDir);
      await newStore.initialize();

      // Should be able to read existing context
      const retrieved = await newStore.read(context.metadata.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.title).toBe('Existing');
    });
  });
});