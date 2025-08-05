import { Context } from '../models/context.js';
import { VectorStore, VectorSearchResult } from './vector-store.js';

export interface SearchResult {
  context: Context;
  score: number;
  matchType: 'exact' | 'semantic' | 'hybrid';
}

export class HybridSearch {
  private vectorStore: VectorStore;

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }

  async search(
    query: string, 
    allContexts: Context[], 
    options: {
      limit?: number;
      semanticWeight?: number;
      exactMatchBoost?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 10,
      semanticWeight = 0.7,
      exactMatchBoost = 0.3
    } = options;

    try {
      // Perform both searches in parallel
      const [vectorResults, textResults] = await Promise.all([
        this.vectorStore.searchSimilar(query, limit * 2), // Get more results for better hybrid scoring
        this.performTextSearch(query, allContexts)
      ]);

      // Combine and score results
      const hybridResults = this.combineResults(
        vectorResults,
        textResults,
        semanticWeight,
        exactMatchBoost
      );

      // Sort by combined score and limit results
      return hybridResults
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      console.error('Hybrid search failed, falling back to text search:', error);
      
      // Fallback to text search only
      const textResults = this.performTextSearch(query, allContexts);
      return textResults.slice(0, limit);
    }
  }

  private performTextSearch(query: string, allContexts: Context[]): SearchResult[] {
    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const context of allContexts) {
      let score = 0;
      let hasMatch = false;

      // Title matching (highest weight)
      const titleMatch = context.metadata.title.toLowerCase().includes(queryLower);
      if (titleMatch) {
        score += 1.0;
        hasMatch = true;
      }

      // Exact phrase matching in content
      const contentMatch = context.content.toLowerCase().includes(queryLower);
      if (contentMatch) {
        score += 0.8;
        hasMatch = true;
      }

      // Tag matching
      const tagMatch = context.metadata.tags.some(tag => 
        tag.toLowerCase().includes(queryLower)
      );
      if (tagMatch) {
        score += 0.6;
        hasMatch = true;
      }

      // Word-level matching for partial matches
      const queryWords = query.toLowerCase().split(/\s+/);
      const contextText = (
        context.metadata.title + ' ' + 
        context.content + ' ' + 
        context.metadata.tags.join(' ')
      ).toLowerCase();

      const wordMatches = queryWords.filter(word => 
        word.length > 2 && contextText.includes(word)
      );

      if (wordMatches.length > 0) {
        const wordScore = (wordMatches.length / queryWords.length) * 0.4;
        score += wordScore;
        hasMatch = true;
      }

      if (hasMatch) {
        results.push({
          context,
          score,
          matchType: 'exact'
        });
      }
    }

    return results;
  }

  private combineResults(
    vectorResults: VectorSearchResult[],
    textResults: SearchResult[],
    semanticWeight: number,
    exactMatchBoost: number
  ): SearchResult[] {
    const combinedMap = new Map<string, SearchResult>();

    // Add vector search results
    for (const result of vectorResults) {
      const id = result.context.metadata.id;
      combinedMap.set(id, {
        context: result.context,
        score: result.score * semanticWeight,
        matchType: 'semantic'
      });
    }

    // Add or boost text search results
    for (const result of textResults) {
      const id = result.context.metadata.id;
      const existing = combinedMap.get(id);

      if (existing) {
        // Combine scores for hybrid result
        const combinedScore = existing.score + (result.score * exactMatchBoost);
        combinedMap.set(id, {
          context: result.context, // Use the full context from text search
          score: combinedScore,
          matchType: 'hybrid'
        });
      } else {
        // Text-only result
        combinedMap.set(id, {
          context: result.context,
          score: result.score * exactMatchBoost,
          matchType: 'exact'
        });
      }
    }

    return Array.from(combinedMap.values());
  }

  async addContext(context: Context): Promise<void> {
    await this.vectorStore.addContext(context);
  }

  async updateContext(context: Context): Promise<void> {
    await this.vectorStore.updateContext(context);
  }

  async removeContext(id: string): Promise<void> {
    await this.vectorStore.removeContext(id);
  }

  async rebuildIndex(contexts: Context[]): Promise<void> {
    await this.vectorStore.rebuildIndex(contexts);
  }

  async getStats(): Promise<{ totalVectors: number }> {
    return await this.vectorStore.getStats();
  }
}