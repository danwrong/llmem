import { vi } from 'vitest';
import { isUsingRealChromaDB } from './chromadb-setup.js';

export function createMockConfig(overrides: Record<string, any> = {}) {
  return {
    chromaDbPort: isUsingRealChromaDB() ? 8766 : 8765,
    remoteUrl: null,
    authType: null,
    authToken: null,
    autoSync: false,
    syncInterval: 30,
    autoCommit: true,
    autoIndex: true,
    ...overrides
  };
}

// Conditional mocking based on test environment
export function setupTestMocks() {
  // Mock config module
  vi.mock('../src/utils/config.js', () => ({
    getConfig: () => createMockConfig()
  }));

  // Always mock for unit tests, only use real ChromaDB for integration tests
  const shouldMockChromaDB = !isUsingRealChromaDB();
  
  if (shouldMockChromaDB) {
    // Mock ChromaDB when not using real instance
    vi.mock('chromadb', () => ({
      ChromaClient: vi.fn().mockImplementation(() => ({
        createCollection: vi.fn().mockResolvedValue({
          add: vi.fn().mockResolvedValue(undefined),
          query: vi.fn().mockResolvedValue({
            ids: [[]],  // Empty results by default for unit tests
            metadatas: [[]],
            distances: [[]],
            documents: [[]]
          }),
          delete: vi.fn().mockResolvedValue(undefined),
          count: vi.fn().mockResolvedValue(0)
        }),
        getCollection: vi.fn().mockRejectedValue(new Error('Collection not found')),
        deleteCollection: vi.fn().mockResolvedValue(undefined)
      }))
    }));

    // Mock Transformers
    vi.mock('@xenova/transformers', () => ({
      pipeline: vi.fn().mockResolvedValue((text: string) => ({
        data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
      }))
    }));

    // Mock file watcher
    vi.mock('chokidar', () => ({
      watch: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        close: vi.fn()
      })
    }));
  }
}