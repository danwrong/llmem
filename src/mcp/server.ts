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
          description: 'Search through personal contexts using natural language or keywords',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (keywords or natural language)',
              },
              type: {
                type: 'string',
                enum: ['personal', 'project', 'knowledge', 'conversation'],
                description: 'Filter by context type (optional)',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags (optional)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 10)',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_context',
          description: 'Retrieve a specific context by its ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The UUID of the context to retrieve',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'add_context',
          description: 'Create a new context entry',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the context',
              },
              content: {
                type: 'string',
                description: 'Markdown content of the context',
              },
              type: {
                type: 'string',
                enum: ['personal', 'project', 'knowledge', 'conversation'],
                description: 'Type of context',
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
          description: 'Update an existing context',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The UUID of the context to update',
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
          description: 'Delete a context by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The UUID of the context to delete',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'list_contexts',
          description: 'List contexts with optional filtering',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['personal', 'project', 'knowledge', 'conversation'],
                description: 'Filter by context type (optional)',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags (optional)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 20)',
                default: 20,
              },
            },
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
          name: 'Recent Contexts',
          description: 'Recently modified contexts',
        },
        {
          uri: 'context://types',
          mimeType: 'application/json',
          name: 'Context Types',
          description: 'Available context types and their counts',
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
    
    // Override the request handlers to detect when a command is processed
    const originalCallTool = this.server.setRequestHandler;
    
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
    
    // Stop file watcher
    this.contextStore.stopFileWatcher();
    
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