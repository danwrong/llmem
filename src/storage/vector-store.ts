import { ChromaClient } from 'chromadb';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { Context } from '../models/context.js';
import { getConfig } from '../utils/config.js';

export interface VectorSearchResult {
  context: Context;
  score: number;
}

export class VectorStore {
  private client: ChromaClient | null = null;
  private embedder: FeatureExtractionPipeline | null = null;
  private collection: any = null;
  private config = getConfig();
  
  constructor() {}

  async initialize(): Promise<void> {
    try {
      console.warn('Initializing ChromaDB vector store...');
      
      // Initialize ChromaDB client with modern configuration
      const { ChromaClient } = await import('chromadb');
      this.client = new ChromaClient({
        host: 'localhost',
        port: this.config.chromaDbPort
      });

      // Initialize local embeddings with Transformers.js
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: false }
      );

      // Always recreate collection to ensure proper embedding function configuration
      try {
        // Delete existing collection if it exists
        await this.client.deleteCollection({ name: 'contexts' });
        console.warn('🗑️ Deleted existing ChromaDB collection');
      } catch (error) {
        // Collection might not exist, that's fine
      }

      // Create new collection
      this.collection = await this.client.createCollection({
        name: 'contexts',
        metadata: { description: 'Personal context embeddings' }
      });
      console.warn('✅ Created new ChromaDB collection with proper embedding configuration');
      
      console.warn('✅ ChromaDB vector store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  async addContext(context: Context): Promise<void> {
    if (!this.collection || !this.embedder) {
      throw new Error('VectorStore not initialized');
    }

    try {
      // Create text for embedding (title + content + tags)
      const textForEmbedding = [
        context.metadata.title,
        context.content,
        context.metadata.tags.join(' ')
      ].join(' ');

      // Generate embedding
      const embedding = await this.generateEmbedding(textForEmbedding);

      // Add to ChromaDB
      await this.collection.add({
        ids: [context.metadata.id],
        embeddings: [embedding],
        documents: [textForEmbedding],
        metadatas: [{
          id: context.metadata.id,
          title: context.metadata.title,
          type: context.metadata.type,
          tags: context.metadata.tags.join(','),
          created: context.metadata.created,
          updated: context.metadata.updated,
          filepath: context.filepath || ''
        }]
      });
    } catch (error) {
      console.error(`Failed to add context ${context.metadata.id} to vector store:`, error);
      throw error;
    }
  }

  async updateContext(context: Context): Promise<void> {
    if (!this.collection || !this.embedder) {
      throw new Error('VectorStore not initialized');
    }

    try {
      // Remove existing entry
      await this.removeContext(context.metadata.id);
      
      // Add updated entry
      await this.addContext(context);
    } catch (error) {
      console.error(`Failed to update context ${context.metadata.id} in vector store:`, error);
      throw error;
    }
  }

  async removeContext(id: string): Promise<void> {
    if (!this.collection) {
      throw new Error('VectorStore not initialized');
    }

    try {
      await this.collection.delete({
        ids: [id]
      });
    } catch (error) {
      console.error(`Failed to remove context ${id} from vector store:`, error);
      throw error;
    }
  }

  async searchSimilar(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
    if (!this.collection || !this.embedder) {
      throw new Error('VectorStore not initialized');
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Search for similar contexts
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: ['documents', 'metadatas', 'distances']
      });

      // Convert results to VectorSearchResult format
      const searchResults: VectorSearchResult[] = [];
      
      if (results.ids && results.ids[0] && results.metadatas && results.metadatas[0] && results.distances && results.distances[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const metadata = results.metadatas[0][i] as any;
          const distance = results.distances[0][i];
          
          // Convert distance to similarity score (1 - normalized distance)
          const score = Math.max(0, 1 - distance);
          
          // Create Context object from metadata
          const context: Context = {
            metadata: {
              id: metadata.id,
              title: metadata.title,
              type: metadata.type,
              tags: metadata.tags ? metadata.tags.split(',').filter(Boolean) : [],
              created: metadata.created,
              updated: metadata.updated,
              relations: []
            },
            content: results.documents?.[0]?.[i]?.split(' ').slice(0, -metadata.tags?.split(',').length || 0).join(' ') || '',
            filepath: metadata.filepath
          };

          searchResults.push({
            context,
            score
          });
        }
      }

      return searchResults;
    } catch (error) {
      console.error('Failed to search vector store:', error);
      throw error;
    }
  }

  async rebuildIndex(contexts: Context[]): Promise<void> {
    if (!this.client) {
      throw new Error('VectorStore not initialized');
    }

    try {
      // Delete existing collection
      try {
        await this.client.deleteCollection({ name: 'contexts' });
      } catch (error) {
        // Collection might not exist, that's fine
      }

      // Create new collection
      this.collection = await this.client.createCollection({
        name: 'contexts',
        metadata: { description: 'Personal context embeddings' }
      });

      // Add all contexts
      for (const context of contexts) {
        await this.addContext(context);
      }
    } catch (error) {
      console.error('Failed to rebuild vector index:', error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    try {
      // Clean and truncate text for embedding
      const cleanText = text.trim().substring(0, 512); // Limit to 512 chars
      
      // Generate embedding
      const output = await this.embedder(cleanText, { pooling: 'mean', normalize: true });
      
      // Extract embedding array from tensor
      let embedding: number[];
      if (output && typeof output === 'object' && 'data' in output) {
        embedding = Array.from(output.data as Float32Array);
      } else {
        throw new Error('Unexpected embedding output format');
      }

      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  async getStats(): Promise<{ totalVectors: number }> {
    if (!this.collection) {
      return { totalVectors: 0 };
    }

    try {
      const count = await this.collection.count();
      return { totalVectors: count };
    } catch (error) {
      console.error('Failed to get vector store stats:', error);
      return { totalVectors: 0 };
    }
  }
}