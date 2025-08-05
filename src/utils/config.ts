import { homedir } from 'os';
import { join } from 'path';
import { config as loadDotenv } from 'dotenv';

export interface Config {
  storePath: string;
  vectorDbPath: string;
  chromaDbPort: number;
  embeddingModel: string;
  autoCommit: boolean;
  autoIndex?: boolean;
  remoteUrl?: string;
  authType?: 'ssh' | 'token';
  authToken?: string;
  autoSync: boolean;
  syncInterval: number;
}

export const defaultConfig: Config = {
  storePath: join(homedir(), 'context-store'),
  vectorDbPath: join(homedir(), 'context-store', '.llmem', 'vectors.db'),
  chromaDbPort: 8765,
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  autoCommit: true,
  autoIndex: true,
  autoSync: true,
  syncInterval: 5,
};

// Load environment variables from .env file
loadDotenv();

export function getConfig(): Config {
  return {
    storePath: process.env.LLMEM_STORE_PATH || defaultConfig.storePath,
    vectorDbPath: process.env.LLMEM_VECTOR_DB_PATH || defaultConfig.vectorDbPath,
    chromaDbPort: parseInt(process.env.LLMEM_CHROMA_PORT || '') || defaultConfig.chromaDbPort,
    embeddingModel: process.env.LLMEM_EMBEDDING_MODEL || defaultConfig.embeddingModel,
    autoCommit: process.env.LLMEM_AUTO_COMMIT === 'false' ? false : defaultConfig.autoCommit,
    autoIndex: process.env.LLMEM_AUTO_INDEX === 'false' ? false : defaultConfig.autoIndex,
    remoteUrl: process.env.LLMEM_REMOTE_URL || undefined,
    authType: (process.env.LLMEM_AUTH_TYPE as 'ssh' | 'token') || undefined,
    authToken: process.env.LLMEM_AUTH_TOKEN || undefined,
    autoSync: process.env.LLMEM_AUTO_SYNC === 'false' ? false : defaultConfig.autoSync,
    syncInterval: parseInt(process.env.LLMEM_SYNC_INTERVAL || '') || defaultConfig.syncInterval,
  };
}