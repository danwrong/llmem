import { ReadResourceRequest, ReadResourceResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ContextStore } from '../../storage/context-store.js';
import { ContextType } from '../../models/context.js';

export class ResourceHandlers {
  constructor(private contextStore: ContextStore) {}

  async handleResourceRead(request: ReadResourceRequest): Promise<ReadResourceResult> {
    const { uri } = request.params;

    try {
      switch (uri) {
        case 'context://recent':
          return await this.handleRecentContexts();
        case 'context://types':
          return await this.handleContextTypes();
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown resource URI: ${uri}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Resource read failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleRecentContexts(): Promise<ReadResourceResult> {
    // Get all contexts and sort by updated date (already sorted by ContextStore.list())
    const contexts = await this.contextStore.list();
    const recentContexts = contexts.slice(0, 10); // Last 10 modified

    const result = {
      recent_contexts: recentContexts.map(ctx => ({
        id: ctx.metadata.id,
        title: ctx.metadata.title,
        type: ctx.metadata.type,
        tags: ctx.metadata.tags,
        updated: ctx.metadata.updated,
        content_preview: this.extractPreview(ctx.content),
      })),
      total_contexts: contexts.length,
      last_updated: recentContexts.length > 0 ? recentContexts[0].metadata.updated : null,
    };

    return {
      contents: [
        {
          uri: 'context://recent',
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleContextTypes(): Promise<ReadResourceResult> {
    const contexts = await this.contextStore.list();
    
    // Count contexts by type
    const typeCounts: Record<ContextType, number> = {
      personal: 0,
      project: 0,
      knowledge: 0,
      conversation: 0,
    };

    const tagCounts: Record<string, number> = {};

    contexts.forEach(ctx => {
      typeCounts[ctx.metadata.type]++;
      
      ctx.metadata.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Get most common tags (top 20)
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .reduce((obj, [tag, count]) => {
        obj[tag] = count;
        return obj;
      }, {} as Record<string, number>);

    const result = {
      total_contexts: contexts.length,
      types: typeCounts,
      most_common_tags: topTags,
      available_types: Object.keys(typeCounts),
    };

    return {
      contents: [
        {
          uri: 'context://types',
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private extractPreview(content: string, maxLength: number = 200): string {
    // Remove markdown formatting for preview
    const plainText = content
      .replace(/^#+\s+/gm, '') // Remove headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/[*_~`]/g, '') // Remove formatting
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();

    if (plainText.length <= maxLength) {
      return plainText;
    }

    // Truncate at word boundary
    const truncated = plainText.substring(0, maxLength - 3);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > 0) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }
}