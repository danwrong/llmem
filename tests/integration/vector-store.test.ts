import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VectorStore } from '../../src/storage/vector-store.js';
import { Context } from '../../src/models/context.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

// NO MOCKS - This is an integration test that requires real ChromaDB

describe('VectorStore Integration Tests', () => {
  let vectorStore: VectorStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llmem-vector-integration-'));
    vectorStore = new VectorStore();
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('real ChromaDB integration', () => {
    it('should initialize with real ChromaDB server', async () => {
      await expect(vectorStore.initialize()).resolves.not.toThrow();
    }, 30000); // 30 second timeout for ChromaDB startup

    it('should perform real vector operations', async () => {
      await vectorStore.initialize();

      const context: Context = {
        metadata: {
          id: 'test-real-vector-123',
          title: 'Coffee Brewing Guide',
          type: 'knowledge/food',
          tags: ['coffee', 'brewing', 'guide'],
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T00:00:00Z',
          relations: []
        },
        content: 'Pour-over coffee requires a medium grind and water temperature between 195-205°F. Start with a 1:16 coffee to water ratio.',
        filepath: '/test/coffee-guide.md'
      };

      // Add context - this should use real embeddings
      await expect(vectorStore.addContext(context)).resolves.not.toThrow();

      // Search for it - this should use real vector similarity
      const results = await vectorStore.searchSimilar('coffee brewing techniques', 5);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context.metadata.id).toBe('test-real-vector-123');
      expect(results[0].score).toBeGreaterThan(0);
    }, 30000);

    it('should handle real embedding generation', async () => {
      await vectorStore.initialize();

      const context1: Context = {
        metadata: {
          id: 'embedding-test-1',
          title: 'JavaScript Programming',
          type: 'knowledge/programming',
          tags: ['javascript', 'programming'],
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T00:00:00Z',
          relations: []
        },
        content: 'JavaScript is a dynamic programming language. It supports object-oriented programming with prototype-based inheritance.',
        filepath: '/test/js.md'
      };

      const context2: Context = {
        metadata: {
          id: 'embedding-test-2',
          title: 'Cooking Pasta',
          type: 'knowledge/cooking',
          tags: ['cooking', 'pasta'],
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T00:00:00Z',
          relations: []
        },
        content: 'To cook pasta perfectly, bring water to a rolling boil, add salt, then add pasta. Cook according to package directions.',
        filepath: '/test/pasta.md'
      };

      await vectorStore.addContext(context1);
      await vectorStore.addContext(context2);

      // Search for programming - should find JavaScript, not pasta
      const programmingResults = await vectorStore.searchSimilar('programming languages', 5);
      expect(programmingResults.length).toBeGreaterThan(0);
      expect(programmingResults[0].context.metadata.id).toBe('embedding-test-1');

      // Search for cooking - should find pasta, not JavaScript
      const cookingResults = await vectorStore.searchSimilar('cooking food preparation', 5);
      expect(cookingResults.length).toBeGreaterThan(0);
      expect(cookingResults[0].context.metadata.id).toBe('embedding-test-2');
    }, 45000);

    it('should maintain vector index statistics', async () => {
      await vectorStore.initialize();

      const initialStats = await vectorStore.getStats();
      expect(initialStats.totalVectors).toBeGreaterThanOrEqual(0);

      // Add a context
      const context: Context = {
        metadata: {
          id: 'stats-test',
          title: 'Stats Test',
          type: 'test',
          tags: [],
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T00:00:00Z',
          relations: []
        },
        content: 'This is for testing vector statistics.',
        filepath: '/test/stats.md'
      };

      await vectorStore.addContext(context);

      const updatedStats = await vectorStore.getStats();
      expect(updatedStats.totalVectors).toBe(initialStats.totalVectors + 1);
    }, 30000);
  });
});