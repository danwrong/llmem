import { simpleGit, SimpleGit } from 'simple-git';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../utils/config.js';

export class GitStore {
  protected git: SimpleGit;
  protected storePath: string;
  protected initialized: boolean = false;

  constructor(storePath?: string) {
    this.storePath = storePath || getConfig().storePath;
    // Don't initialize git until we ensure the directory exists
    this.git = simpleGit();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create directory if it doesn't exist
    if (!existsSync(this.storePath)) {
      await mkdir(this.storePath, { recursive: true });
    }

    // Now set the git working directory
    this.git = simpleGit(this.storePath);

    // Initialize git repo if not already initialized
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      await this.git.init();
      await this.createInitialStructure();
      await this.commit('Initial commit: Created context store structure');
    }

    this.initialized = true;
  }

  private async createInitialStructure(): Promise<void> {
    const dirs = [
      'contexts/daily',
      'contexts/people',
      'contexts/projects',
      'contexts/knowledge',
      '.llmem/cache',
    ];

    for (const dir of dirs) {
      const fullPath = join(this.storePath, dir);
      await mkdir(fullPath, { recursive: true });
    }

    // Create .gitignore for the store
    const gitignoreContent = `.llmem/vectors.db
.llmem/cache/
*.tmp
*.swp
.DS_Store`;

    const { writeFile } = await import('fs/promises');
    await writeFile(join(this.storePath, '.gitignore'), gitignoreContent);
    await this.git.add('.gitignore');
  }

  async add(filepath: string): Promise<void> {
    await this.ensureInitialized();
    await this.git.add(filepath);
  }

  async commit(message: string): Promise<void> {
    await this.ensureInitialized();
    try {
      await this.git.commit(message);
    } catch (error) {
      // Handle case where there's nothing to commit
      if (error instanceof Error && error.message.includes('nothing to commit')) {
        console.log('Nothing to commit');
      } else {
        throw error;
      }
    }
  }

  async getStatus() {
    await this.ensureInitialized();
    return await this.git.status();
  }

  async getDiff(filepath?: string) {
    await this.ensureInitialized();
    if (filepath) {
      return await this.git.diff(['HEAD', '--', filepath]);
    }
    return await this.git.diff(['HEAD']);
  }

  async getHistory(filepath?: string, limit: number = 10) {
    await this.ensureInitialized();
    const options = filepath ? ['--', filepath] : [];
    return await this.git.log(['-n', limit.toString(), ...options]);
  }

  async checkout(branch: string): Promise<void> {
    await this.ensureInitialized();
    await this.git.checkout(branch);
  }

  async createBranch(name: string): Promise<void> {
    await this.ensureInitialized();
    await this.git.checkoutLocalBranch(name);
  }

  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  getStorePath(): string {
    return this.storePath;
  }
}