import { readFile, writeFile, unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { GitStore } from './git-store.js';
import { MarkdownParser } from './markdown-parser.js';
import { VectorStore } from './vector-store.js';
import { HybridSearch, SearchResult } from './hybrid-search.js';
import { FileWatcher } from './file-watcher.js';
import { Context, ContextMetadata, ContextType } from '../models/context.js';
import { getConfig } from '../utils/config.js';

export class ContextStore {
  private gitStore: GitStore;
  private parser: MarkdownParser;
  private vectorStore: VectorStore;
  private hybridSearch: HybridSearch;
  private fileWatcher: FileWatcher;
  private config = getConfig();

  constructor(storePath?: string) {
    this.gitStore = new GitStore(storePath);
    this.parser = new MarkdownParser();
    this.vectorStore = new VectorStore();
    this.hybridSearch = new HybridSearch(this.vectorStore);
    this.fileWatcher = new FileWatcher(this);
  }

  async initialize(): Promise<void> {
    await this.gitStore.initialize();
    
    // Initialize vector store
    try {
      await this.vectorStore.initialize();
      
      // Check if we need to rebuild the index
      const contexts = await this.list();
      const stats = await this.vectorStore.getStats();
      
      if (stats.totalVectors === 0 && contexts.length > 0) {
        console.log('Rebuilding vector search index...');
        await this.hybridSearch.rebuildIndex(contexts);
        console.log(`Indexed ${contexts.length} contexts for vector search`);
      }

      // Start file watcher for auto-indexing
      if (this.config.autoIndex !== false) { // Default to true
        this.fileWatcher.start();
      }
    } catch (error) {
      console.warn('Vector search initialization failed, using text search only:', error);
    }
  }

  async create(
    title: string,
    content: string,
    type: ContextType,
    metadata?: Partial<ContextMetadata>
  ): Promise<Context> {
    const context = this.parser.createNewContext(title, content, type, metadata);
    const filepath = this.generateFilepath(context);
    
    await this.writeContext(filepath, context);
    
    // Add to vector index
    try {
      await this.hybridSearch.addContext({ ...context, filepath });
    } catch (error) {
      console.warn('Failed to add context to vector index:', error);
    }
    
    if (this.config.autoCommit) {
      await this.gitStore.add(filepath);
      await this.gitStore.commit(`Add context: ${title}`);
    }

    return { ...context, filepath };
  }

  async read(id: string): Promise<Context | null> {
    const filepath = await this.findContextFile(id);
    if (!filepath) return null;

    const content = await readFile(filepath, 'utf-8');
    return this.parser.parse(content, filepath);
  }

  async update(id: string, updates: Partial<Context>): Promise<Context | null> {
    const existing = await this.read(id);
    if (!existing || !existing.filepath) return null;

    const updated: Context = {
      ...existing,
      content: updates.content || existing.content,
      metadata: {
        ...existing.metadata,
        ...(updates.metadata || {}),
        updated: new Date().toISOString(),
      },
    };

    await this.writeContext(existing.filepath, updated);

    // Update vector index
    try {
      await this.hybridSearch.updateContext(updated);
    } catch (error) {
      console.warn('Failed to update context in vector index:', error);
    }

    if (this.config.autoCommit) {
      await this.gitStore.add(existing.filepath);
      await this.gitStore.commit(`Update context: ${updated.metadata.title}`);
    }

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const filepath = await this.findContextFile(id);
    if (!filepath) return false;

    const context = await this.read(id);
    await unlink(filepath);

    // Remove from vector index
    try {
      await this.hybridSearch.removeContext(id);
    } catch (error) {
      console.warn('Failed to remove context from vector index:', error);
    }

    if (this.config.autoCommit && context) {
      await this.gitStore.add(filepath);
      await this.gitStore.commit(`Delete context: ${context.metadata.title}`);
    }

    return true;
  }

  async list(filter?: {
    type?: ContextType;
    tags?: string[];
  }): Promise<Context[]> {
    const contextsDir = join(this.gitStore.getStorePath(), 'contexts');
    const contexts: Context[] = [];

    await this.walkDirectory(contextsDir, async (filepath) => {
      if (filepath.endsWith('.md')) {
        try {
          const content = await readFile(filepath, 'utf-8');
          const context = this.parser.parse(content, filepath);
          
          // Apply filters
          if (filter) {
            if (filter.type && context.metadata.type !== filter.type) return;
            if (filter.tags && filter.tags.length > 0) {
              const hasAllTags = filter.tags.every(tag => 
                context.metadata.tags.includes(tag)
              );
              if (!hasAllTags) return;
            }
          }
          
          contexts.push(context);
        } catch (error) {
          console.error(`Error parsing ${filepath}:`, error);
        }
      }
    });

    // Sort by updated date, newest first
    return contexts.sort((a, b) => 
      new Date(b.metadata.updated).getTime() - new Date(a.metadata.updated).getTime()
    );
  }

  async search(query: string, options?: {
    limit?: number;
    semanticWeight?: number;
    exactMatchBoost?: number;
  }): Promise<Context[]> {
    try {
      // Use hybrid search for better results
      const allContexts = await this.list();
      const searchResults = await this.hybridSearch.search(query, allContexts, options);
      
      // Return contexts sorted by relevance score
      return searchResults.map(result => result.context);
    } catch (error) {
      console.warn('Hybrid search failed, falling back to basic text search:', error);
      
      // Fallback to basic text search
      const allContexts = await this.list();
      const queryLower = query.toLowerCase();

      return allContexts.filter(context => {
        const titleMatch = context.metadata.title.toLowerCase().includes(queryLower);
        const contentMatch = context.content.toLowerCase().includes(queryLower);
        const tagMatch = context.metadata.tags.some(tag => 
          tag.toLowerCase().includes(queryLower)
        );
        
        return titleMatch || contentMatch || tagMatch;
      });
    }
  }

  async searchWithScores(query: string, options?: {
    limit?: number;
    semanticWeight?: number;
    exactMatchBoost?: number;
  }): Promise<SearchResult[]> {
    const allContexts = await this.list();
    return await this.hybridSearch.search(query, allContexts, options);
  }

  private async writeContext(filepath: string, context: Context): Promise<void> {
    const { dirname } = await import('path');
    const { mkdir } = await import('fs/promises');
    
    // Ensure directory exists
    const dir = dirname(filepath);
    await mkdir(dir, { recursive: true });
    
    const content = this.parser.stringify(context);
    await writeFile(filepath, content, 'utf-8');
  }

  private generateFilepath(context: Context): string {
    const { type, title, id } = context.metadata;
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    const filename = `${sanitizedTitle}-${id.substring(0, 8)}.md`;
    return join(this.gitStore.getStorePath(), 'contexts', type, filename);
  }

  private async findContextFile(id: string): Promise<string | null> {
    const contextsDir = join(this.gitStore.getStorePath(), 'contexts');
    let found: string | null = null;

    await this.walkDirectory(contextsDir, async (filepath) => {
      if (filepath.endsWith('.md') && filepath.includes(id.substring(0, 8))) {
        try {
          const content = await readFile(filepath, 'utf-8');
          const context = this.parser.parse(content);
          if (context.metadata.id === id) {
            found = filepath;
          }
        } catch (error) {
          // Skip invalid files
        }
      }
    });

    return found;
  }

  private async walkDirectory(
    dir: string, 
    callback: (filepath: string) => Promise<void>
  ): Promise<void> {
    if (!existsSync(dir)) return;

    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, callback);
      } else {
        await callback(fullPath);
      }
    }
  }

  // File watcher management
  startFileWatcher(): void {
    this.fileWatcher.start();
  }

  stopFileWatcher(): void {
    this.fileWatcher.stop();
  }

  isFileWatcherRunning(): boolean {
    return this.fileWatcher.isRunning();
  }

  // Vector search management
  async rebuildVectorIndex(): Promise<void> {
    const contexts = await this.list();
    await this.hybridSearch.rebuildIndex(contexts);
  }

  async getVectorStats(): Promise<{ totalVectors: number }> {
    return await this.hybridSearch.getStats();
  }
}