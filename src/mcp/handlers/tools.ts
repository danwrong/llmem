import { CallToolRequest, CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ContextStore } from '../../storage/context-store.js';
import { ContextType } from '../../models/context.js';

export class ToolHandlers {
  constructor(private contextStore: ContextStore) {}

  async handleToolCall(request: CallToolRequest): Promise<CallToolResult> {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'search_context':
          return await this.handleSearchContext(args);
        case 'get_context':
          return await this.handleGetContext(args);
        case 'add_context':
          return await this.handleAddContext(args);
        case 'update_context':
          return await this.handleUpdateContext(args);
        case 'delete_context':
          return await this.handleDeleteContext(args);
        case 'list_contexts':
          return await this.handleListContexts(args);
        case 'sync_memories':
          return await this.handleSyncMemories(args);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleSearchContext(args: any): Promise<CallToolResult> {
    const { query, type, tags, limit = 10 } = args;

    if (!query || typeof query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required and must be a string');
    }

    const results = await this.contextStore.search(query);
    
    // Apply additional filters if provided
    let filteredResults = results;
    
    if (type) {
      filteredResults = filteredResults.filter(ctx => ctx.metadata.type === type);
    }
    
    if (tags && Array.isArray(tags)) {
      filteredResults = filteredResults.filter(ctx =>
        tags.every(tag => ctx.metadata.tags.includes(tag))
      );
    }

    const limitedResults = filteredResults.slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query,
            total_results: filteredResults.length,
            results: limitedResults.map(ctx => ({
              id: ctx.metadata.id,
              title: ctx.metadata.title,
              type: ctx.metadata.type,
              tags: ctx.metadata.tags,
              created: ctx.metadata.created,
              updated: ctx.metadata.updated,
              content: ctx.content.substring(0, 300) + (ctx.content.length > 300 ? '...' : ''),
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetContext(args: any): Promise<CallToolResult> {
    const { id } = args;

    if (!id || typeof id !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'ID parameter is required and must be a string');
    }

    const context = await this.contextStore.read(id);
    
    if (!context) {
      throw new McpError(ErrorCode.InvalidParams, `Memory with ID ${id} not found`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            id: context.metadata.id,
            title: context.metadata.title,
            type: context.metadata.type,
            tags: context.metadata.tags,
            created: context.metadata.created,
            updated: context.metadata.updated,
            relations: context.metadata.relations,
            content: context.content,
          }, null, 2),
        },
      ],
    };
  }

  private async handleAddContext(args: any): Promise<CallToolResult> {
    const { title, content, type, tags = [] } = args;

    if (!title || typeof title !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Title parameter is required and must be a string');
    }

    if (!content || typeof content !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Content parameter is required and must be a string');
    }

    if (!type || !['personal', 'project', 'knowledge', 'conversation'].includes(type)) {
      throw new McpError(ErrorCode.InvalidParams, 'Type parameter is required and must be one of: personal, project, knowledge, conversation');
    }

    if (!Array.isArray(tags)) {
      throw new McpError(ErrorCode.InvalidParams, 'Tags parameter must be an array');
    }

    const newContext = await this.contextStore.create(title, content, type as ContextType, {
      tags,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Memory created successfully',
            memory: {
              id: newContext.metadata.id,
              title: newContext.metadata.title,
              type: newContext.metadata.type,
              tags: newContext.metadata.tags,
              created: newContext.metadata.created,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleUpdateContext(args: any): Promise<CallToolResult> {
    const { id, title, content, tags } = args;

    if (!id || typeof id !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'ID parameter is required and must be a string');
    }

    const updates: any = {};
    if (title !== undefined) updates.metadata = { title };
    if (content !== undefined) updates.content = content;
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        throw new McpError(ErrorCode.InvalidParams, 'Tags parameter must be an array');
      }
      updates.metadata = { ...updates.metadata, tags };
    }

    const updatedContext = await this.contextStore.update(id, updates);
    
    if (!updatedContext) {
      throw new McpError(ErrorCode.InvalidParams, `Memory with ID ${id} not found`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Memory updated successfully',
            memory: {
              id: updatedContext.metadata.id,
              title: updatedContext.metadata.title,
              type: updatedContext.metadata.type,
              tags: updatedContext.metadata.tags,
              updated: updatedContext.metadata.updated,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleDeleteContext(args: any): Promise<CallToolResult> {
    const { id } = args;

    if (!id || typeof id !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'ID parameter is required and must be a string');
    }

    const deleted = await this.contextStore.delete(id);
    
    if (!deleted) {
      throw new McpError(ErrorCode.InvalidParams, `Memory with ID ${id} not found`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Memory deleted successfully',
            id,
          }, null, 2),
        },
      ],
    };
  }

  private async handleListContexts(args: any): Promise<CallToolResult> {
    const { type, tags, limit = 20 } = args;

    const filter: any = {};
    if (type) filter.type = type;
    if (tags) filter.tags = tags;

    const contexts = await this.contextStore.list(filter);
    const limitedContexts = contexts.slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total_memories: contexts.length,
            showing: limitedContexts.length,
            memories: limitedContexts.map(ctx => ({
              id: ctx.metadata.id,
              title: ctx.metadata.title,
              type: ctx.metadata.type,
              tags: ctx.metadata.tags,
              created: ctx.metadata.created,
              updated: ctx.metadata.updated,
              content_preview: ctx.content.substring(0, 150) + (ctx.content.length > 150 ? '...' : ''),
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async handleSyncMemories(_args: any): Promise<CallToolResult> {
    try {
      await this.contextStore.syncWithRemote();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Successfully synchronized memories with remote repository',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: 'Failed to synchronize memories with remote repository',
              error: errorMessage,
            }, null, 2),
          },
        ],
      };
    }
  }
}