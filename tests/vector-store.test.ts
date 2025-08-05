import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VectorStore } from '../src/storage/vector-store.js';
import { Context, ContextType } from '../src/models/context.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

// Mock ChromaDB and Transformers
vi.mock('chromadb', () => ({
  ChromaApi: vi.fn().mockImplementation(() => ({
    createCollection: vi.fn().mockResolvedValue({
      add: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        ids: [['test-id-1', 'test-id-2']],
        metadatas: [[
          { id: 'test-id-1', title: 'Test 1', type: 'personal', tags: 'coffee', created: '2025-01-01T00:00:00Z', updated: '2025-01-01T00:00:00Z', filepath: '/path/1' },
          { id: 'test-id-2', title: 'Test 2', type: 'knowledge', tags: 'typescript', created: '2025-01-01T00:00:00Z', updated: '2025-01-01T00:00:00Z', filepath: '/path/2' }
        ]],
        distances: [[0.1, 0.3]],
        documents: [['Test content about coffee preferences', 'TypeScript best practices']]
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(2)
    })),
    getCollection: vi.fn().mockRejectedValue(new Error('Collection not found')),
    deleteCollection: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue((text: string) => ({
    data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
  }))
}));

describe('VectorStore', () => {
  let vectorStore: VectorStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llmem-vector-test-'));
    vectorStore = new VectorStore();
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize ChromaDB and embeddings', async () => {
      await expect(vectorStore.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      const { ChromaApi } = await import('chromadb');
      vi.mocked(ChromaApi).mockImplementationOnce(() => {
        throw new Error('ChromaDB initialization failed');
      });

      await expect(vectorStore.initialize()).rejects.toThrow('ChromaDB initialization failed');
    });
  });

  describe('context management', () => {
    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should add context to vector store', async () => {
      const context: Context = {
        metadata: {
          id: 'test-id-123',
          title: 'Coffee Preferences',
          type: 'personal' as ContextType,
          tags: ['coffee', 'preferences'],
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T00:00:00Z',
          relations: []
        },
        content: 'I prefer medium roast coffee with oat milk.',
        filepath: '/test/path.md'
      };

      await expect(vectorStore.addContext(context)).resolves.not.toThrow();
    });

    it('should update context in vector store', async () => {
      const context: Context = {
        metadata: {
          id: 'test-id-456',
          title: 'TypeScript Tips',
          type: 'knowledge' as ContextType,
          tags: ['typescript', 'programming'],
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T01:00:00Z',
          relations: []
        },
        content: 'Use strict null checks and type guards.',
        filepath: '/test/typescript.md'
      };

      await expect(vectorStore.updateContext(context)).resolves.not.toThrow();
    });

    it('should remove context from vector store', async () => {
      await expect(vectorStore.removeContext('test-id-789')).resolves.not.toThrow();
    });

    it('should throw error when not initialized', async () => {
      const uninitializedStore = new VectorStore();
      const context: Context = {
        metadata: {
          id: 'test-id',
          title: 'Test',
          type: 'personal' as ContextType,
          tags: [],
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T00:00:00Z',
          relations: []
        },
        content: 'Test content',
        filepath: '/test.md'
      };

      await expect(uninitializedStore.addContext(context)).rejects.toThrow('VectorStore not initialized');
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should search for similar contexts', async () => {
      const results = await vectorStore.searchSimilar('coffee preferences', 5);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('context');
      expect(results[0]).toHaveProperty('score');
      expect(results[0].context.metadata.id).toBe('test-id-1');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should handle empty search results', async () => {
      const { ChromaApi } = await import('chromadb');
      const mockCollection = {
        query: vi.fn().mockResolvedValue({
          ids: [[]],
          metadatas: [[]],
          distances: [[]],
          documents: [[]]
        }),
        add: vi.fn(),
        delete: vi.fn(),
        count: vi.fn().mockResolvedValue(0)
      };

      vi.mocked(ChromaApi).mockImplementationOnce(() => ({
        createCollection: vi.fn().mockResolvedValue(mockCollection),
        getCollection: vi.fn().mockRejectedValue(new Error('Not found')),
        deleteCollection: vi.fn()
      } as any));

      const emptyStore = new VectorStore();
      await emptyStore.initialize();

      const results = await emptyStore.searchSimilar('no results query');
      expect(results).toHaveLength(0);
    });

    it('should limit search results', async () => {
      const results = await vectorStore.searchSimilar('programming', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('index management', () => {
    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should rebuild index with new contexts', async () => {
      const contexts: Context[] = [
        {
          metadata: {
            id: 'rebuild-1',
            title: 'First Context',
            type: 'personal' as ContextType,
            tags: ['tag1'],
            created: '2025-01-01T00:00:00Z',
            updated: '2025-01-01T00:00:00Z',
            relations: []
          },
          content: 'First content',
          filepath: '/first.md'
        },
        {
          metadata: {
            id: 'rebuild-2',
            title: 'Second Context',
            type: 'knowledge' as ContextType,
            tags: ['tag2'],
            created: '2025-01-01T00:00:00Z',
            updated: '2025-01-01T00:00:00Z',
            relations: []
          },
          content: 'Second content',
          filepath: '/second.md'
        }
      ];

      await expect(vectorStore.rebuildIndex(contexts)).resolves.not.toThrow();
    });

    it('should return stats', async () => {
      const stats = await vectorStore.getStats();
      expect(stats).toHaveProperty('totalVectors');
      expect(typeof stats.totalVectors).toBe('number');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await vectorStore.initialize();
    });

    it('should handle embedding generation errors', async () => {
      const { pipeline } = await import('@xenova/transformers');
      vi.mocked(pipeline).mockResolvedValueOnce({
        invalid: 'response'
      } as any);

      const context: Context = {
        metadata: {
          id: 'error-test',
          title: 'Error Test',
          type: 'personal' as ContextType,
          tags: [],
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T00:00:00Z',
          relations: []
        },
        content: 'This should cause an error',
        filepath: '/error.md'
      };

      await expect(vectorStore.addContext(context)).rejects.toThrow();
    });

    it('should handle ChromaDB errors', async () => {
      const mockCollection = {
        add: vi.fn().mockRejectedValue(new Error('ChromaDB error')),
        query: vi.fn(),
        delete: vi.fn(),
        count: vi.fn()
      };

      // Replace the collection with error-throwing mock
      (vectorStore as any).collection = mockCollection;

      const context: Context = {
        metadata: {
          id: 'error-test-2',
          title: 'Error Test 2',
          type: 'personal' as ContextType,
          tags: [],
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T00:00:00Z',
          relations: []
        },
        content: 'This should cause a ChromaDB error',
        filepath: '/error2.md'
      };

      await expect(vectorStore.addContext(context)).rejects.toThrow('ChromaDB error');
    });
  });
});