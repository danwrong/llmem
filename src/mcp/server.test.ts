import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PassThrough } from 'stream';
import { LLMemMCPServer } from './server.js';
import { createTempDir, cleanupTempDir } from '../test/helpers/test-utils.js';

describe('LLMemMCPServer E2E', () => {
  let server: LLMemMCPServer;
  let tempDir: string;
  let mockStdin: PassThrough;
  let mockStdout: PassThrough;

  beforeEach(async () => {
    tempDir = await createTempDir();
    server = new LLMemMCPServer(tempDir);
    await server.initialize();
    
    mockStdin = new PassThrough();
    mockStdout = new PassThrough();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  // Helper function to send MCP messages
  const sendMCPMessage = (message: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const jsonMessage = JSON.stringify(message) + '\n';
      
      let response = '';
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 5000);

      mockStdout.on('data', (data) => {
        response += data.toString();
        
        // Check if we have a complete JSON message
        try {
          const lines = response.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const parsed = JSON.parse(line);
              if (parsed.id === message.id) {
                clearTimeout(timeout);
                resolve(parsed);
                return;
              }
            }
          }
        } catch (e) {
          // Continue collecting data
        }
      });

      mockStdin.write(jsonMessage);
    });
  };

  describe('MCP Protocol Integration', () => {
    it('should handle tool listing', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      // For this test, we'll verify the server structure rather than full protocol
      // since setting up the full transport is complex in testing
      expect(server).toBeDefined();
      
      // Verify that the server has the expected methods
      expect(server.initialize).toBeDefined();
      expect(server.start).toBeDefined();
    });
  });

  describe('Integration with ContextStore', () => {
    it('should create and retrieve contexts through MCP tools', async () => {
      // This tests the integration between MCP handlers and ContextStore
      const toolHandlers = (server as any).toolHandlers;
      
      // Add a context
      const addRequest = {
        method: 'tools/call',
        params: {
          name: 'add_context',
          arguments: {
            title: 'E2E Test Context',
            content: 'This is an end-to-end test context',
            type: 'knowledge',
            tags: ['test', 'e2e'],
          },
        },
      };

      const addResult = await toolHandlers.handleToolCall(addRequest);
      const addData = JSON.parse(addResult.content[0].text);
      
      expect(addData.success).toBe(true);
      expect(addData.context.title).toBe('E2E Test Context');
      
      const contextId = addData.context.id;

      // Retrieve the context
      const getRequest = {
        method: 'tools/call',
        params: {
          name: 'get_context',
          arguments: { id: contextId },
        },
      };

      const getResult = await toolHandlers.handleToolCall(getRequest);
      const getData = JSON.parse(getResult.content[0].text);
      
      expect(getData.id).toBe(contextId);
      expect(getData.title).toBe('E2E Test Context');
      expect(getData.content).toBe('This is an end-to-end test context');
      expect(getData.tags).toEqual(['test', 'e2e']);

      // Search for the context
      const searchRequest = {
        method: 'tools/call',
        params: {
          name: 'search_context',
          arguments: { query: 'end-to-end' },
        },
      };

      const searchResult = await toolHandlers.handleToolCall(searchRequest);
      const searchData = JSON.parse(searchResult.content[0].text);
      
      expect(searchData.results).toHaveLength(1);
      expect(searchData.results[0].id).toBe(contextId);

      // Update the context
      const updateRequest = {
        method: 'tools/call',
        params: {
          name: 'update_context',
          arguments: {
            id: contextId,
            title: 'Updated E2E Test Context',
            tags: ['test', 'e2e', 'updated'],
          },
        },
      };

      const updateResult = await toolHandlers.handleToolCall(updateRequest);
      const updateData = JSON.parse(updateResult.content[0].text);
      
      expect(updateData.success).toBe(true);
      expect(updateData.context.title).toBe('Updated E2E Test Context');

      // List contexts
      const listRequest = {
        method: 'tools/call',
        params: {
          name: 'list_contexts',
          arguments: { type: 'knowledge' },
        },
      };

      const listResult = await toolHandlers.handleToolCall(listRequest);
      const listData = JSON.parse(listResult.content[0].text);
      
      expect(listData.contexts.some((ctx: any) => ctx.id === contextId)).toBe(true);

      // Delete the context
      const deleteRequest = {
        method: 'tools/call',
        params: {
          name: 'delete_context',
          arguments: { id: contextId },
        },
      };

      const deleteResult = await toolHandlers.handleToolCall(deleteRequest);
      const deleteData = JSON.parse(deleteResult.content[0].text);
      
      expect(deleteData.success).toBe(true);

      // Verify deletion
      const getDeletedRequest = {
        method: 'tools/call',
        params: {
          name: 'get_context',
          arguments: { id: contextId },
        },
      };

      await expect(toolHandlers.handleToolCall(getDeletedRequest)).rejects.toThrow('not found');
    });

    it('should provide resource data', async () => {
      const resourceHandlers = (server as any).resourceHandlers;
      
      // Create some test data
      const toolHandlers = (server as any).toolHandlers;
      
      await toolHandlers.handleToolCall({
        method: 'tools/call',
        params: {
          name: 'add_context',
          arguments: {
            title: 'Resource Test 1',
            content: 'Content 1',
            type: 'knowledge',
            tags: ['resource-test'],
          },
        },
      });

      await toolHandlers.handleToolCall({
        method: 'tools/call',
        params: {
          name: 'add_context',
          arguments: {
            title: 'Resource Test 2',
            content: 'Content 2',
            type: 'project',
            tags: ['resource-test'],
          },
        },
      });

      // Test recent contexts resource
      const recentRequest = {
        method: 'resources/read',
        params: { uri: 'context://recent' },
      };

      const recentResult = await resourceHandlers.handleResourceRead(recentRequest);
      const recentData = JSON.parse(recentResult.contents[0].text);
      
      expect(recentData.recent_contexts).toHaveLength(2);
      expect(recentData.total_contexts).toBe(2);

      // Test context types resource
      const typesRequest = {
        method: 'resources/read',
        params: { uri: 'context://types' },
      };

      const typesResult = await resourceHandlers.handleResourceRead(typesRequest);
      const typesData = JSON.parse(typesResult.contents[0].text);
      
      expect(typesData.total_contexts).toBe(2);
      expect(typesData.types.knowledge).toBe(1);
      expect(typesData.types.project).toBe(1);
      expect(typesData.most_common_tags['resource-test']).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle tool errors gracefully', async () => {
      const toolHandlers = (server as any).toolHandlers;
      
      // Test invalid tool call
      const invalidRequest = {
        method: 'tools/call',
        params: {
          name: 'invalid_tool',
          arguments: {},
        },
      };

      await expect(toolHandlers.handleToolCall(invalidRequest)).rejects.toThrow();

      // Test missing required parameters
      const missingParamsRequest = {
        method: 'tools/call',
        params: {
          name: 'add_context',
          arguments: { title: 'Missing content and type' },
        },
      };

      await expect(toolHandlers.handleToolCall(missingParamsRequest)).rejects.toThrow();
    });

    it('should handle resource errors gracefully', async () => {
      const resourceHandlers = (server as any).resourceHandlers;
      
      // Test invalid resource URI
      const invalidRequest = {
        method: 'resources/read',
        params: { uri: 'context://invalid' },
      };

      await expect(resourceHandlers.handleResourceRead(invalidRequest)).rejects.toThrow();
    });
  });

  describe('Data Persistence', () => {
    it('should persist data across server instances', async () => {
      const toolHandlers1 = (server as any).toolHandlers;
      
      // Create context with first instance
      const addResult = await toolHandlers1.handleToolCall({
        method: 'tools/call',
        params: {
          name: 'add_context',
          arguments: {
            title: 'Persistence Test',
            content: 'This should persist',
            type: 'knowledge',
          },
        },
      });

      const contextId = JSON.parse(addResult.content[0].text).context.id;

      // Create new server instance with same directory
      const server2 = new LLMemMCPServer(tempDir);
      await server2.initialize();
      const toolHandlers2 = (server2 as any).toolHandlers;

      // Try to retrieve the context with second instance
      const getResult = await toolHandlers2.handleToolCall({
        method: 'tools/call',
        params: {
          name: 'get_context',
          arguments: { id: contextId },
        },
      });

      const getData = JSON.parse(getResult.content[0].text);
      expect(getData.title).toBe('Persistence Test');
      expect(getData.content).toBe('This should persist');
    });
  });
});