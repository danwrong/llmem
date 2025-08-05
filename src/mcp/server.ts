import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ContextStore } from '../storage/context-store.js';
import { ToolHandlers } from './handlers/tools.js';
import { ResourceHandlers } from './handlers/resources.js';

export class LLMemMCPServer {
  private server: Server;
  private contextStore: ContextStore;
  private toolHandlers: ToolHandlers;
  private resourceHandlers: ResourceHandlers;

  constructor(storePath?: string) {
    this.contextStore = new ContextStore(storePath);
    this.toolHandlers = new ToolHandlers(this.contextStore);
    this.resourceHandlers = new ResourceHandlers(this.contextStore);
    
    this.server = new Server(
      {
        name: 'llmem',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_context',
          description: 'Search through personal memories and knowledge using natural language queries. Use this when the user asks about remembering, recalling, or finding information about specific topics, people, projects, or experiences.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language search query. Can include any context like "my travel memories from Japan", "work projects from last year", "recipes with chocolate", etc. The semantic search will find relevant memories based on meaning.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of memories to return (default: 10)',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_context',
          description: 'Retrieve a specific memory by its ID. Use when you need to get the full details of a particular memory.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The UUID of the memory to retrieve',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'add_context',
          description: 'Store a new memory or piece of information for future recall. Use when the user wants to remember or save something. The tool intelligently organizes memories in subdirectories based on content (e.g., "travel/2024/paris" for a trip memory). You can override the default organization by specifying a custom directory path.',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title or summary of the memory',
              },
              content: {
                type: 'string',
                description: 'Detailed content of the memory in markdown format',
              },
              type: {
                type: 'string',
                description: 'Directory path for organizing this memory (e.g., "personal", "work/2024", "travel/japan", "recipes/desserts", "projects/llmem"). Use forward slashes for nested directories. The LLM should intelligently choose directories based on the content - for example, a memory about a trip to Tokyo could go in "travel/japan/2024" or "2024/travel/tokyo". Common patterns: personal, work/[project], travel/[location], knowledge/[topic], daily/[date].',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags for categorization (optional)',
                default: [],
              },
            },
            required: ['title', 'content', 'type'],
          },
        },
        {
          name: 'update_context',
          description: 'Update or modify an existing memory. Use when information needs to be corrected or expanded.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The UUID of the memory to update',
              },
              title: {
                type: 'string',
                description: 'New title (optional)',
              },
              content: {
                type: 'string',
                description: 'New content (optional)',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'New tags (optional)',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'delete_context',
          description: 'Delete a memory permanently. Use when information is no longer needed or should be forgotten.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The UUID of the memory to delete',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'list_contexts',
          description: 'List memories with optional filtering by exact type/directory path. Use for browsing by organization structure (e.g., all memories in "work/2024") rather than semantic search.',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Filter by memory type/directory path (e.g., "personal", "work/2024", "travel/japan") - optional',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by specific tags or topics - optional',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of memories to return (default: 20)',
                default: 20,
              },
            },
            required: [],
          },
        },
        {
          name: 'sync_memories',
          description: 'Manually synchronize memories with remote repository. Pulls latest changes and pushes any local changes.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.toolHandlers.handleToolCall(request)
    );

    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'context://recent',
          mimeType: 'application/json',
          name: 'Recent Memories',
          description: 'Recently stored or modified memories',
        },
        {
          uri: 'context://types',
          mimeType: 'application/json',
          name: 'Memory Types',
          description: 'Available memory types and their counts',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
      this.resourceHandlers.handleResourceRead(request)
    );
  }

  async initialize(): Promise<void> {
    await this.contextStore.initialize();
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('LLMem MCP Server started');
  }

  async startTestMode(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('LLMem MCP Server started in test mode');

    // Set up a timeout to exit after processing one command
    let commandProcessed = false;
    
    // Set up test mode behavior
    
    // Add a small delay and then exit after the first response is sent
    setTimeout(async () => {
      if (!commandProcessed) {
        console.error('🧪 Test mode: No command received, exiting...');
        await this.stop();
        process.exit(0);
      }
    }, 5000); // Wait 5 seconds for a command

    // Listen for any message to indicate a command was processed
    process.stdin.once('data', () => {
      setTimeout(async () => {
        console.error('🧪 Test mode: Command processed, exiting...');
        await this.stop();
        process.exit(0);
      }, 1000); // Give time for response to be sent
    });
  }

  async stop(): Promise<void> {
    console.error('Stopping LLMem MCP Server...');
    
    // Cleanup context store (stops file watcher and background sync)
    await this.contextStore.cleanup();
    
    // Note: The MCP SDK doesn't provide a clean disconnect method
    // The server will be closed when the process exits
    console.error('LLMem MCP Server stopped');
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new LLMemMCPServer();
  
  server.initialize()
    .then(() => server.start())
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
}