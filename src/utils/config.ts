import { homedir } from 'os';
import { join } from 'path';

export interface Config {
  storePath: string;
  vectorDbPath: string;
  embeddingModel: string;
  autoCommit: boolean;
  autoIndex?: boolean;
}

export const defaultConfig: Config = {
  storePath: join(homedir(), 'context-store'),
  vectorDbPath: join(homedir(), 'context-store', '.llmem', 'vectors.db'),
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  autoCommit: true,
  autoIndex: true,
};

export function getConfig(): Config {
  // TODO: Load from config.yaml if exists
  return defaultConfig;
}