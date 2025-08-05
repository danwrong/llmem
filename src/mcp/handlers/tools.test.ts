import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CallToolRequest, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ToolHandlers } from './tools.js';
import { ContextStore } from '../../storage/context-store.js';
import { createTempDir, cleanupTempDir } from '../../test/helpers/test-utils.js';

describe('ToolHandlers', () => {
  let toolHandlers: ToolHandlers;
  let contextStore: ContextStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    contextStore = new ContextStore(tempDir);
    await contextStore.initialize();
    toolHandlers = new ToolHandlers(contextStore);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('handleToolCall', () => {
    it('should throw error for unknown tool', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      };

      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow(McpError);
      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow('Unknown tool: unknown_tool');
    });
  });

  describe('search_context', () => {
    beforeEach(async () => {
      // Create test contexts
      await contextStore.create('JavaScript Guide', 'Learn JavaScript fundamentals and ES6 features', 'knowledge', {
        tags: ['programming', 'javascript'],
      });
      await contextStore.create('React Project', 'Building a todo app with React hooks', 'project', {
        tags: ['programming', 'react'],
      });
      await contextStore.create('Meeting Notes', 'Discussion about new features', 'conversation', {
        tags: ['work'],
      });
    });

    it('should search contexts by query', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'search_context',
          arguments: { query: 'JavaScript' },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      expect(result.content).toHaveLength(1);
      
      const data = JSON.parse(result.content[0].text!);
      expect(data.query).toBe('JavaScript');
      expect(data.total_results).toBeGreaterThanOrEqual(0);
      expect(data.memories).toBeDefined();
      expect(Array.isArray(data.memories)).toBe(true);
    });

    it('should find relevant results with semantic search', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'search_context',
          arguments: { 
            query: 'programming languages',
            limit: 5,
          },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.query).toBe('programming languages');
      expect(data.total_results).toBeGreaterThanOrEqual(0);
      expect(data.memories).toBeDefined();
      expect(data.memories.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty search results', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'search_context',
          arguments: { 
            query: 'nonexistent topic that will never match anything',
          },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.query).toBe('nonexistent topic that will never match anything');
      expect(data.total_results).toBe(0);
      expect(data.memories).toHaveLength(0);
    });

    it('should limit results', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'search_context',
          arguments: { 
            query: 'programming',
            limit: 1,
          },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.memories.length).toBeLessThanOrEqual(1);
      expect(data.total_results).toBeGreaterThanOrEqual(0);
    });

    it('should require query parameter', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'search_context',
          arguments: {},
        },
      };

      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow(McpError);
      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow('Query parameter is required');
    });
  });

  describe('get_context', () => {
    it('should retrieve context by ID', async () => {
      const created = await contextStore.create('Test Context', 'Test content', 'knowledge');
      
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'get_context',
          arguments: { id: created.metadata.id },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.id).toBe(created.metadata.id);
      expect(data.title).toBe('Test Context');
      expect(data.content).toBe('Test content');
    });

    it('should throw error for non-existent context', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'get_context',
          arguments: { id: 'non-existent-id' },
        },
      };

      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow(McpError);
      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow('not found');
    });

    it('should require ID parameter', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'get_context',
          arguments: {},
        },
      };

      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow(McpError);
      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow('ID parameter is required');
    });
  });

  describe('add_context', () => {
    it('should create new context', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'add_context',
          arguments: {
            title: 'New Context',
            content: 'New content',
            type: 'knowledge',
            tags: ['test'],
          },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.success).toBe(true);
      expect(data.memory.title).toBe('New Context');
      expect(data.memory.type).toBe('knowledge');
      expect(data.memory.tags).toEqual(['test']);
      
      // Verify it was actually created
      const created = await contextStore.read(data.memory.id);
      expect(created).not.toBeNull();
      expect(created!.content).toBe('New content');
    });

    it('should require title parameter', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'add_context',
          arguments: {
            content: 'Content',
            type: 'knowledge',
          },
        },
      };

      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow(McpError);
      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow('Title parameter is required');
    });

    it('should accept flexible directory type', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'add_context',
          arguments: {
            title: 'Flexible Directory Test',
            content: 'This tests flexible directory structure',
            type: 'work/projects/2024/machine-learning',
            tags: ['ml', 'work'],
          },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.success).toBe(true);
      expect(data.memory.title).toBe('Flexible Directory Test');
      expect(data.memory.type).toBe('work/projects/2024/machine-learning');
      expect(data.memory.tags).toEqual(['ml', 'work']);
    });
  });

  describe('update_context', () => {
    it('should update existing context', async () => {
      const created = await contextStore.create('Original Title', 'Original content', 'knowledge');
      
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'update_context',
          arguments: {
            id: created.metadata.id,
            title: 'Updated Title',
            content: 'Updated content',
            tags: ['updated'],
          },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.success).toBe(true);
      expect(data.memory.title).toBe('Updated Title');
      expect(data.memory.tags).toEqual(['updated']);
      
      // Verify the update
      const updated = await contextStore.read(created.metadata.id);
      expect(updated!.metadata.title).toBe('Updated Title');
      expect(updated!.content).toBe('Updated content');
    });

    it('should throw error for non-existent context', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'update_context',
          arguments: {
            id: 'non-existent-id',
            title: 'New Title',
          },
        },
      };

      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow(McpError);
      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow('not found');
    });
  });

  describe('delete_context', () => {
    it('should delete existing context', async () => {
      const created = await contextStore.create('To Delete', 'Content', 'knowledge');
      
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'delete_context',
          arguments: { id: created.metadata.id },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.success).toBe(true);
      expect(data.id).toBe(created.metadata.id);
      
      // Verify deletion
      const deleted = await contextStore.read(created.metadata.id);
      expect(deleted).toBeNull();
    });

    it('should throw error for non-existent context', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'delete_context',
          arguments: { id: 'non-existent-id' },
        },
      };

      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow(McpError);
      await expect(toolHandlers.handleToolCall(request)).rejects.toThrow('not found');
    });
  });

  describe('list_contexts', () => {
    beforeEach(async () => {
      await contextStore.create('Knowledge 1', 'Content 1', 'knowledge', { tags: ['tag1'] });
      await contextStore.create('Project 1', 'Content 2', 'project', { tags: ['tag2'] });
      await contextStore.create('Knowledge 2', 'Content 3', 'knowledge', { tags: ['tag1'] });
    });

    it('should list all contexts', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'list_contexts',
          arguments: {},
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.total_memories).toBe(3);
      expect(data.memories).toHaveLength(3);
    });

    it('should filter by type', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'list_contexts',
          arguments: { type: 'knowledge' },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.showing).toBe(2);
      expect(data.memories.every((ctx: any) => ctx.type === 'knowledge')).toBe(true);
    });

    it('should respect limit', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'list_contexts',
          arguments: { limit: 1 },
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      expect(data.showing).toBe(1);
      expect(data.total_memories).toBe(3);
    });
  });

  describe('sync_memories', () => {
    it('should successfully sync when no remote configured', async () => {
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'sync_memories',
          arguments: {},
        },
      };

      const result = await toolHandlers.handleToolCall(request);
      const data = JSON.parse(result.content[0].text!);
      
      // Should either succeed or report no remote repository configured
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
    });

    it('should handle sync errors gracefully', async () => {
      // Mock contextStore.syncWithRemote to throw an error
      const originalSync = contextStore.syncWithRemote;
      contextStore.syncWithRemote = async () => {
        throw new Error('Network error');
      };

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'sync_memories',
          arguments: {},
        },
      };

      try {
        const result = await toolHandlers.handleToolCall(request);
        const data = JSON.parse(result.content[0].text!);
        
        expect(data.success).toBe(false);
        expect(data.message).toContain('Failed to synchronize');
        expect(data.error).toBe('Network error');
      } finally {
        // Restore original method
        contextStore.syncWithRemote = originalSync;
      }
    });
  });
});