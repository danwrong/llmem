import { watch, FSWatcher } from 'chokidar';
import { join } from 'path';
import { ContextStore } from './context-store.js';
import { getConfig } from '../utils/config.js';

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private contextStore: ContextStore;
  private config = getConfig();

  constructor(contextStore: ContextStore) {
    this.contextStore = contextStore;
  }

  start(): void {
    if (this.watcher) {
      console.warn('File watcher is already running');
      return;
    }

    const contextsPath = join(this.config.storePath, 'contexts');
    
    // Watch for changes in the contexts directory
    this.watcher = watch(contextsPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true, // Don't trigger for existing files
      depth: 10 // Watch subdirectories
    });

    this.watcher
      .on('add', (path) => this.handleFileAdd(path))
      .on('change', (path) => this.handleFileChange(path))
      .on('unlink', (path) => this.handleFileDelete(path))
      .on('error', (error) => {
        console.error('File watcher error:', error);
      });

    console.log(`File watcher started monitoring: ${contextsPath}`);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped');
    }
  }

  private async handleFileAdd(filepath: string): Promise<void> {
    if (!filepath.endsWith('.md')) return;

    try {
      console.log(`File added: ${filepath}`);
      
      // Read and parse the new file
      const context = await this.parseContextFile(filepath);
      if (context) {
        // Add to vector index (the file is already on disk)
        await this.contextStore['hybridSearch'].addContext(context);
        console.log(`Indexed new context: ${context.metadata.title}`);
      }
    } catch (error) {
      console.error(`Failed to index new file ${filepath}:`, error);
    }
  }

  private async handleFileChange(filepath: string): Promise<void> {
    if (!filepath.endsWith('.md')) return;

    try {
      console.log(`File changed: ${filepath}`);
      
      // Read and parse the updated file
      const context = await this.parseContextFile(filepath);
      if (context) {
        // Update vector index
        await this.contextStore['hybridSearch'].updateContext(context);
        console.log(`Updated index for context: ${context.metadata.title}`);
      }
    } catch (error) {
      console.error(`Failed to update index for file ${filepath}:`, error);
    }
  }

  private async handleFileDelete(filepath: string): Promise<void> {
    if (!filepath.endsWith('.md')) return;

    try {
      console.log(`File deleted: ${filepath}`);
      
      // Extract ID from filename (format: title-{id}.md)
      const filename = filepath.split('/').pop() || '';
      const idMatch = filename.match(/-([a-f0-9]{8})\.md$/);
      
      if (idMatch) {
        const shortId = idMatch[1];
        
        // We need to find the full ID from the vector store
        // This is a limitation - we could store a mapping or use the full ID in filename
        console.log(`Attempting to remove context with short ID: ${shortId}`);
        
        // For now, we'll skip automatic removal on file delete to avoid removing wrong contexts
        // The vector index will be cleaned up during rebuild operations
        console.warn('Auto-removal from vector index not implemented for file deletion');
      }
    } catch (error) {
      console.error(`Failed to handle file deletion ${filepath}:`, error);
    }
  }

  private async parseContextFile(filepath: string): Promise<any> {
    try {
      const { readFile } = await import('fs/promises');
      const content = await readFile(filepath, 'utf-8');
      
      // Use the context store's parser
      const parser = this.contextStore['parser'];
      return parser.parse(content, filepath);
    } catch (error) {
      console.error(`Failed to parse context file ${filepath}:`, error);
      return null;
    }
  }

  isRunning(): boolean {
    return this.watcher !== null;
  }
}