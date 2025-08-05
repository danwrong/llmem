import matter from 'gray-matter';
import { Context, ContextMetadata, ContextMetadataSchema } from '../models/context.js';
import { v4 as uuidv4 } from 'uuid';

export class MarkdownParser {
  constructor() {
    // Unified processor for markdown parsing initialized
  }

  parse(markdownContent: string, filepath?: string): Context {
    const { data, content } = matter(markdownContent);
    
    // Validate and parse metadata
    const metadata = ContextMetadataSchema.parse(data);
    
    return {
      metadata,
      content: content.trim(),
      filepath,
    };
  }

  stringify(context: Context): string {
    const { metadata, content } = context;
    
    // Convert metadata to frontmatter format
    const frontmatter = {
      ...metadata,
      // Ensure dates are in ISO format
      created: new Date(metadata.created).toISOString(),
      updated: new Date(metadata.updated).toISOString(),
      expires: metadata.expires ? new Date(metadata.expires).toISOString() : null,
    };

    return matter.stringify(content, frontmatter);
  }

  createNewContext(
    title: string,
    content: string,
    type: ContextMetadata['type'],
    additionalMetadata?: Partial<ContextMetadata>
  ): Context {
    const now = new Date().toISOString();
    
    const metadata: ContextMetadata = {
      id: uuidv4(),
      title,
      type,
      tags: [],
      created: now,
      updated: now,
      relations: [],
      ...additionalMetadata,
    };

    return {
      metadata,
      content,
    };
  }

  updateMetadata(context: Context, updates: Partial<ContextMetadata>): Context {
    return {
      ...context,
      metadata: {
        ...context.metadata,
        ...updates,
        updated: new Date().toISOString(),
      },
    };
  }

  extractSummary(content: string, maxLength: number = 200): string {
    // Remove markdown formatting for summary
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
    
    // Fallback if no space found
    return truncated + '...';
  }

  validateMetadata(data: unknown): ContextMetadata {
    return ContextMetadataSchema.parse(data);
  }
}