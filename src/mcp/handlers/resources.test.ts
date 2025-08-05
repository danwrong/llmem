import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReadResourceRequest, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandlers } from './resources.js';
import { ContextStore } from '../../storage/context-store.js';
import { createTempDir, cleanupTempDir } from '../../test/helpers/test-utils.js';

describe('ResourceHandlers', () => {
  let resourceHandlers: ResourceHandlers;
  let contextStore: ContextStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    contextStore = new ContextStore(tempDir);
    await contextStore.initialize();
    resourceHandlers = new ResourceHandlers(contextStore);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('handleResourceRead', () => {
    it('should throw error for unknown resource URI', async () => {
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'context://unknown',
        },
      };

      await expect(resourceHandlers.handleResourceRead(request)).rejects.toThrow(McpError);
      await expect(resourceHandlers.handleResourceRead(request)).rejects.toThrow('Unknown resource URI');
    });
  });

  describe('recent contexts resource', () => {
    beforeEach(async () => {
      // Create contexts with slight delays to ensure different timestamps
      await contextStore.create('Old Context', 'Old content', 'knowledge');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await contextStore.create('Recent Context', 'Recent content', 'project', { tags: ['recent'] });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await contextStore.create('Newest Context', 'Newest content', 'personal');
    });

    it('should return recent contexts', async () => {
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'context://recent',
        },
      };

      const result = await resourceHandlers.handleResourceRead(request);
      expect(result.contents).toHaveLength(1);
      
      const data = JSON.parse(result.contents[0].text!);
      expect(data.recent_memories).toHaveLength(3);
      expect(data.total_memories).toBe(3);
      expect(data.last_updated).toBeTruthy();
      
      // Should be sorted by most recent first
      expect(data.recent_memories[0].title).toBe('Newest Context');
      expect(data.recent_memories[0].content_preview).toBe('Newest content');
    });

    it('should limit to 10 recent contexts', async () => {
      // Create 15 contexts
      for (let i = 0; i < 12; i++) {
        await contextStore.create(`Context ${i}`, `Content ${i}`, 'knowledge');
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'context://recent',
        },
      };

      const result = await resourceHandlers.handleResourceRead(request);
      const data = JSON.parse(result.contents[0].text!);
      
      expect(data.recent_memories).toHaveLength(10);
      expect(data.total_memories).toBe(15); // 3 from beforeEach + 12 new
    });

    it('should include content preview', async () => {
      const longContent = 'This is a very long content that should be truncated to show only a preview of the actual content and not the full text. It contains many words and should definitely exceed the preview limit that we have set in the resource handler to ensure proper truncation behavior.';
      await contextStore.create('Long Content', longContent, 'knowledge');

      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'context://recent',
        },
      };

      const result = await resourceHandlers.handleResourceRead(request);
      const data = JSON.parse(result.contents[0].text!);
      
      const longContentItem = data.recent_memories.find((ctx: any) => ctx.title === 'Long Content');
      expect(longContentItem).toBeTruthy();
      expect(longContentItem.content_preview.length).toBeLessThan(longContent.length);
      expect(longContentItem.content_preview).toContain('...');
    });
  });

  describe('context types resource', () => {
    beforeEach(async () => {
      await contextStore.create('Knowledge 1', 'Content', 'knowledge', { tags: ['programming', 'javascript'] });
      await contextStore.create('Knowledge 2', 'Content', 'knowledge', { tags: ['programming', 'python'] });
      await contextStore.create('Project 1', 'Content', 'project', { tags: ['work', 'programming'] });
      await contextStore.create('Personal 1', 'Content', 'personal', { tags: ['life'] });
      await contextStore.create('Conversation 1', 'Content', 'conversation', { tags: ['meeting'] });
    });

    it('should return type counts and tag statistics', async () => {
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'context://types',
        },
      };

      const result = await resourceHandlers.handleResourceRead(request);
      expect(result.contents).toHaveLength(1);
      
      const data = JSON.parse(result.contents[0].text!);
      
      expect(data.total_memories).toBe(5);
      expect(data.types.knowledge).toBe(2);
      expect(data.types.project).toBe(1);
      expect(data.types.personal).toBe(1);
      expect(data.types.conversation).toBe(1);
      
      expect(data.available_types).toEqual(expect.arrayContaining(['personal', 'project', 'knowledge', 'conversation']));
      
      // Programming should be the most common tag (appears 3 times)
      expect(data.most_common_tags.programming).toBe(3);
      expect(data.most_common_tags.javascript).toBe(1);
      expect(data.most_common_tags.python).toBe(1);
    });

    it('should limit to top 20 tags', async () => {
      // Create contexts with many different tags
      for (let i = 0; i < 25; i++) {
        await contextStore.create(`Context ${i}`, 'Content', 'knowledge', { tags: [`tag${i}`] });
      }

      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'context://types',
        },
      };

      const result = await resourceHandlers.handleResourceRead(request);
      const data = JSON.parse(result.contents[0].text!);
      
      const tagCount = Object.keys(data.most_common_tags).length;
      expect(tagCount).toBeLessThanOrEqual(20);
    });

    it('should handle empty context store', async () => {
      // Create fresh temp directory and store
      const emptyTempDir = await createTempDir();
      const emptyStore = new ContextStore(emptyTempDir);
      await emptyStore.initialize();
      const emptyResourceHandlers = new ResourceHandlers(emptyStore);

      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'context://types',
        },
      };

      const result = await emptyResourceHandlers.handleResourceRead(request);
      const data = JSON.parse(result.contents[0].text!);
      
      expect(data.total_memories).toBe(0);
      expect(data.types).toEqual({});
      expect(data.most_common_tags).toEqual({});
      expect(data.available_types).toEqual([]);
      
      // Clean up
      await cleanupTempDir(emptyTempDir);
    });
  });

  describe('extractPreview', () => {
    it('should extract clean preview from markdown', async () => {
      const markdownContent = `# Header

This is a **bold** paragraph with [links](http://example.com) and *italic* text.

## Another section

More content here.`;

      // Create a context and check its preview in recent contexts
      await contextStore.create('Markdown Test', markdownContent, 'knowledge');

      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'context://recent',
        },
      };

      const result = await resourceHandlers.handleResourceRead(request);
      const data = JSON.parse(result.contents[0].text!);
      
      const testContext = data.recent_memories.find((ctx: any) => ctx.title === 'Markdown Test');
      expect(testContext.content_preview).not.toContain('**');
      expect(testContext.content_preview).not.toContain('[');
      expect(testContext.content_preview).not.toContain('#');
      expect(testContext.content_preview).toContain('Header');
      expect(testContext.content_preview).toContain('bold paragraph');
    });
  });
});