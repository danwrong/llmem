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

  private isIntegrationTest(): boolean {
    // Check if we're running from an integration test file
    const stack = new Error().stack;
    return stack ? stack.includes('/tests/integration/') : false;
  }

  async initialize(): Promise<void> {
    // Skip initialization for unit tests (integration tests run with separate config)
    if (process.env.NODE_ENV === 'test' && !this.isIntegrationTest()) {
      console.warn('Skipping ChromaDB initialization - using mocks for unit tests');
      return;
    }

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

      // Try to get existing collection first, create if it doesn't exist
      try {
        this.collection = await this.client.getCollection({ name: 'contexts' });
        console.warn('✅ Using existing ChromaDB collection');
      } catch (error) {
        // Collection doesn't exist, create it
        // We provide our own embeddings, so use a custom embedding function that does nothing
        // ChromaDB requires an embedding function, but we provide pre-computed embeddings
        const customEmbeddingFunction = {
          generate: async (_texts: string[]) => {
            // This should never be called since we provide embeddings directly
            throw new Error('Embedding function should not be called - we provide pre-computed embeddings');
          }
        };
        
        this.collection = await this.client.createCollection({
          name: 'contexts',
          metadata: { description: 'Personal context embeddings' },
          embeddingFunction: customEmbeddingFunction
        });
        console.warn('✅ Created new ChromaDB collection with proper embedding configuration');
      }
      
      console.warn('✅ ChromaDB vector store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  async addContext(context: Context): Promise<void> {
    // Skip for unit tests
    if (process.env.NODE_ENV === 'test' && !this.isIntegrationTest()) {
      return;
    }

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
    // Skip for unit tests
    if (process.env.NODE_ENV === 'test' && !this.isIntegrationTest()) {
      return;
    }

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
    // Skip for unit tests
    if (process.env.NODE_ENV === 'test' && !this.isIntegrationTest()) {
      return;
    }

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
    // Return empty results for unit tests
    if (process.env.NODE_ENV === 'test' && !this.isIntegrationTest()) {
      return [];
    }

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
    // Skip for unit tests
    if (process.env.NODE_ENV === 'test' && !this.isIntegrationTest()) {
      return;
    }

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
      
      // Generate embedding using feature extraction
      const output = await this.embedder(cleanText, { pooling: 'mean', normalize: true });
      
      // Extract embedding array from tensor
      let embedding: number[];
      
      // Handle the tensor properly - it should be a Tensor object
      if (output && typeof output === 'object' && 'data' in output) {
        // For feature extraction models, the output is usually 2D: [batch_size, embedding_dim]
        // We need the full embedding, not just the first 5 values
        const data = output.data as Float32Array;
        embedding = Array.from(data);
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
    // Return mock stats for unit tests
    if (process.env.NODE_ENV === 'test' && !this.isIntegrationTest()) {
      return { totalVectors: 0 };
    }

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