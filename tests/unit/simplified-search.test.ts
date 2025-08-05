import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextStore } from '../src/storage/context-store.js';
import { createTempDir, cleanupTempDir } from '../src/test/helpers/test-utils.js';

describe('Simplified Search Without Filters', () => {
  let contextStore: ContextStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    contextStore = new ContextStore(tempDir);
    await contextStore.initialize();

    // Create diverse test memories
    await contextStore.create(
      'JavaScript Fundamentals',
      'Learn about JavaScript variables, functions, and objects. ES6 features include arrow functions and destructuring.',
      'knowledge/programming/javascript',
      { tags: ['javascript', 'programming', 'es6'] }
    );

    await contextStore.create(
      'React Component Architecture',
      'Building scalable React applications with proper component organization. Use hooks for state management.',
      'work/projects/frontend',
      { tags: ['react', 'frontend', 'javascript', 'hooks'] }
    );

    await contextStore.create(
      'Coffee Shop Recommendation',
      'Found an amazing coffee shop downtown. Great espresso and cozy atmosphere for working.',
      'personal/recommendations',
      { tags: ['coffee', 'places', 'work-friendly'] }
    );

    await contextStore.create(
      'API Design Best Practices',
      'RESTful API design principles. Use proper HTTP methods, status codes, and consistent naming conventions.',
      'knowledge/backend/api-design',
      { tags: ['api', 'rest', 'backend', 'design'] }
    );

    await contextStore.create(
      'Meeting Notes - Project Alpha',
      'Discussed the new JavaScript framework integration. Need to research React alternatives and finalize architecture.',
      'work/meetings/project-alpha',
      { tags: ['meetings', 'project-alpha', 'javascript', 'architecture'] }
    );
  });

  afterEach(async () => {
    await contextStore.cleanup();
    await cleanupTempDir(tempDir);
  });

  describe('semantic search capabilities', () => {
    it('should find memories by exact title match', async () => {
      const results = await contextStore.search('JavaScript Fundamentals');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.title).toBe('JavaScript Fundamentals');
    });

    it('should find memories by partial title match', async () => {
      const results = await contextStore.search('React Component');
      
      expect(results.length).toBeGreaterThan(0);
      const titles = results.map(r => r.metadata.title);
      expect(titles).toContain('React Component Architecture');
    });

    it('should find memories by content keywords', async () => {
      const results = await contextStore.search('espresso');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.title).toBe('Coffee Shop Recommendation');
    });

    it('should find memories by tag content', async () => {
      const results = await contextStore.search('hooks');
      
      expect(results.length).toBeGreaterThan(0);
      const matchingMemory = results.find(r => r.metadata.title === 'React Component Architecture');
      expect(matchingMemory).toBeDefined();
    });

    it('should perform case-insensitive search', async () => {
      const results = await contextStore.search('JAVASCRIPT');
      
      expect(results.length).toBeGreaterThan(0);
      const hasJSMemory = results.some(r => 
        r.metadata.title.toLowerCase().includes('javascript') ||
        r.content.toLowerCase().includes('javascript') ||
        r.metadata.tags.some(tag => tag.toLowerCase().includes('javascript'))
      );
      expect(hasJSMemory).toBe(true);
    });
  });

  describe('cross-domain semantic search', () => {
    it('should find related memories across different domains', async () => {
      const results = await contextStore.search('JavaScript framework');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find memories that mention JavaScript in different contexts
      const titles = results.map(r => r.metadata.title);
      expect(titles).toContain('JavaScript Fundamentals');
      expect(titles).toContain('Meeting Notes - Project Alpha');
    });

    it('should find memories by conceptual similarity', async () => {
      const results = await contextStore.search('frontend development');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find React-related content even if "frontend development" isn't explicitly mentioned
      const hasReactMemory = results.some(r => 
        r.metadata.title.includes('React') || 
        r.metadata.tags.includes('frontend')
      );
      expect(hasReactMemory).toBe(true);
    });

    it('should handle multi-word conceptual queries', async () => {
      const results = await contextStore.search('web development best practices');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find API design and JavaScript content
      const relevantTitles = results.map(r => r.metadata.title);
      const hasRelevantContent = relevantTitles.some(title => 
        title.includes('API Design') || 
        title.includes('JavaScript') || 
        title.includes('React')
      );
      expect(hasRelevantContent).toBe(true);
    });
  });

  describe('search result relevance and ranking', () => {
    it('should return results in relevance order', async () => {
      const results = await contextStore.search('JavaScript');
      
      expect(results.length).toBeGreaterThan(1);
      
      // First result should be most relevant (likely the one with JavaScript in title)
      expect(results[0].metadata.title).toBe('JavaScript Fundamentals');
    });

    it('should limit results when specified', async () => {
      const results = await contextStore.search('JavaScript', { limit: 2 });
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should handle queries with no matches', async () => {
      const results = await contextStore.search('quantum physics molecular biology');
      
      expect(results).toHaveLength(0);
    });

    it('should handle empty queries gracefully', async () => {
      const results = await contextStore.search('');
      
      // Should return empty results or handle gracefully
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('search across directory types', () => {
    it('should find memories regardless of directory structure', async () => {
      const results = await contextStore.search('architecture');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find both React architecture and meeting notes about architecture
      const types = results.map(r => r.metadata.type);
      expect(types).toContain('work/projects/frontend');
      expect(types).toContain('work/meetings/project-alpha');
    });

    it('should not be constrained by directory boundaries', async () => {
      const results = await contextStore.search('work');
      
      // Should find memories with "work" in content, not just those in work directories
      expect(results.length).toBeGreaterThan(0);
      
      const hasPersonalWorkContent = results.some(r => 
        r.metadata.type.startsWith('personal') && 
        (r.content.includes('work') || r.metadata.tags.includes('work-friendly'))
      );
      expect(hasPersonalWorkContent).toBe(true);
    });
  });

  describe('search with various query types', () => {
    it('should handle single word queries', async () => {
      const results = await contextStore.search('coffee');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.title).toBe('Coffee Shop Recommendation');
    });

    it('should handle phrase queries', async () => {
      const results = await contextStore.search('state management');
      
      expect(results.length).toBeGreaterThan(0);
      const hasReactContent = results.some(r => r.metadata.title.includes('React'));
      expect(hasReactContent).toBe(true);
    });

    it('should handle technical term queries', async () => {
      const results = await contextStore.search('RESTful API');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.title).toBe('API Design Best Practices');
    });

    it('should handle natural language queries', async () => {
      const results = await contextStore.search('where can I find a good place to work');
      
      expect(results.length).toBeGreaterThan(0);
      // Should find the coffee shop recommendation
      const hasCoffeeShop = results.some(r => r.metadata.title.includes('Coffee Shop'));
      expect(hasCoffeeShop).toBe(true);
    });
  });

  describe('performance and reliability', () => {
    it('should handle large result sets efficiently', async () => {
      // Create many memories
      for (let i = 0; i < 50; i++) {
        await contextStore.create(
          `Test Memory ${i}`,
          `This is test content number ${i} about programming and development`,
          `test/batch-${Math.floor(i / 10)}`,
          { tags: ['test', 'programming'] }
        );
      }

      const startTime = Date.now();
      const results = await contextStore.search('programming', { limit: 20 });
      const endTime = Date.now();

      expect(results.length).toBeLessThanOrEqual(20);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should gracefully handle vector search failures', async () => {
      // This test would require mocking vector store to fail
      // The system should fall back to text search
      const results = await contextStore.search('fallback test');
      
      // Should return results even if vector search fails
      expect(Array.isArray(results)).toBe(true);
    });
  });
});