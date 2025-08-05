import { simpleGit } from 'simple-git';
import { mkdir, rm, readdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getConfig } from '../utils/config.js';
import { GitStore } from './git-store.js';

export class RemoteGitStore extends GitStore {
  private config = getConfig();

  constructor(storePath?: string) {
    super(storePath);
  }

  async initialize(): Promise<void> {
    // Check if remote URL has changed or is newly configured
    if (this.config.remoteUrl && await this.shouldReplaceWithRemote()) {
      await this.replaceWithRemote(this.config.remoteUrl);
    } else {
      // Standard initialization
      await super.initialize();
    }

    // Set up remote if configured and not already set
    if (this.config.remoteUrl) {
      await this.configureRemote();
    }

    // Remote URL tracking handled by shouldReplaceWithRemote check
  }

  private async shouldReplaceWithRemote(): Promise<boolean> {
    const currentRemote = await this.getCurrentRemoteUrl();
    return this.config.remoteUrl !== currentRemote;
  }

  private async getCurrentRemoteUrl(): Promise<string | null> {
    try {
      await this.ensureInitialized();
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      return origin?.refs?.fetch || null;
    } catch (error) {
      return null;
    }
  }

  private async replaceWithRemote(remoteUrl: string): Promise<void> {
    console.warn(`🔄 Remote URL changed/configured: ${remoteUrl}`);
    console.warn('📦 Backing up current state and replacing with remote content...');

    // 1. Backup current state if it exists
    if (existsSync(this.getStorePath())) {
      await this.backupCurrentState();
    }

    // 2. Wipe local content (preserve .llmem directory)
    await this.wipeLocalContent();

    // 3. Clone from remote
    await this.cloneFromRemote(remoteUrl);

    // 4. Ensure required directory structure exists
    await this.ensureDirectoryStructure();

    console.warn('✅ Successfully replaced local content with remote repository');
  }

  private async backupCurrentState(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(this.getStorePath(), '.llmem', 'backups', timestamp);
    
    await mkdir(backupPath, { recursive: true });

    // Copy all content except .llmem directory
    const entries = await readdir(this.getStorePath(), { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name === '.llmem') continue;
      
      const sourcePath = join(this.getStorePath(), entry.name);
      const destPath = join(backupPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        const { copyFile } = await import('fs/promises');
        await mkdir(join(destPath, '..'), { recursive: true });
        await copyFile(sourcePath, destPath);
      }
    }

    console.warn(`📁 Backed up previous state to: ${backupPath}`);
  }

  private async copyDirectory(source: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = join(source, entry.name);
      const destPath = join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        const { copyFile } = await import('fs/promises');
        await copyFile(sourcePath, destPath);
      }
    }
  }

  private async wipeLocalContent(): Promise<void> {
    const entries = await readdir(this.getStorePath(), { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name === '.llmem') continue; // Preserve .llmem directory
      
      const entryPath = join(this.getStorePath(), entry.name);
      await rm(entryPath, { recursive: true, force: true });
    }
  }

  private async cloneFromRemote(remoteUrl: string): Promise<void> {
    // Clone into a temporary directory first
    const tempDir = join(this.getStorePath(), '.tmp-clone');
    
    try {
      // Clone the repository
      const git = simpleGit();
      await git.clone(remoteUrl, tempDir, {
        '--depth': 1, // Shallow clone for faster operation
      });

      // Move contents from temp directory to store path
      const tempEntries = await readdir(tempDir, { withFileTypes: true });
      
      for (const entry of tempEntries) {
        if (entry.name === '.git') {
          // Move .git directory
          const sourcePath = join(tempDir, entry.name);
          const destPath = join(this.getStorePath(), entry.name);
          await this.moveDirectory(sourcePath, destPath);
        } else {
          // Move other files/directories
          const sourcePath = join(tempDir, entry.name);
          const destPath = join(this.getStorePath(), entry.name);
          
          if (entry.isDirectory()) {
            await this.moveDirectory(sourcePath, destPath);
          } else {
            const { rename } = await import('fs/promises');
            await rename(sourcePath, destPath);
          }
        }
      }

      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true });

      // Initialize git in the new location
      this.git = simpleGit(this.getStorePath());
      
    } catch (error) {
      // Clean up temp directory on error
      if (existsSync(tempDir)) {
        await rm(tempDir, { recursive: true, force: true });
      }
      throw new Error(`Failed to clone from remote: ${error}`);
    }
  }

  private async moveDirectory(source: string, dest: string): Promise<void> {
    const { rename } = await import('fs/promises');
    await mkdir(join(dest, '..'), { recursive: true });
    await rename(source, dest);
  }

  private async configureRemote(): Promise<void> {
    try {
      const remotes = await this.git.getRemotes();
      const hasOrigin = remotes.some(r => r.name === 'origin');
      
      if (!hasOrigin) {
        await this.git.addRemote('origin', this.config.remoteUrl!);
      }
    } catch (error) {
      console.warn('Failed to configure remote:', error);
    }
  }

  // Enhanced commit with auto-push
  async commit(message: string): Promise<void> {
    await super.commit(message);
    
    // Auto-push if remote is configured and auto-sync is enabled
    if (this.config.remoteUrl && this.config.autoSync) {
      await this.push();
    }
  }

  async push(): Promise<void> {
    if (!this.config.remoteUrl) {
      console.warn('No remote URL configured, skipping push');
      return;
    }

    try {
      await this.ensureInitialized();
      await this.git.push('origin', 'main');
      console.warn('📤 Pushed changes to remote repository');
    } catch (error) {
      console.warn('Failed to push to remote:', error);
      // Don't throw - allow operation to continue even if push fails
    }
  }

  async pull(): Promise<void> {
    if (!this.config.remoteUrl) {
      return;
    }

    try {
      await this.ensureInitialized();
      
      // Fetch first to see if there are changes
      await this.git.fetch('origin', 'main');
      
      // Check if we're behind
      const status = await this.git.status();
      if (status.behind > 0) {
        console.warn('📥 Pulling changes from remote repository');
        
        // Try to merge
        try {
          await this.git.pull('origin', 'main');
          console.warn('✅ Successfully merged remote changes');
        } catch (error) {
          // Handle conflicts automatically
          await this.resolveConflictsAutomatically();
          console.warn('🔧 Automatically resolved conflicts');
        }
      }
    } catch (error) {
      console.warn('Failed to pull from remote:', error);
      // Don't throw - allow operation to continue
    }
  }

  private async resolveConflictsAutomatically(): Promise<void> {
    try {
      // Get list of conflicted files
      const status = await this.git.status();
      const conflicted = status.conflicted;

      if (conflicted.length === 0) {
        return;
      }

      console.warn(`🔧 Resolving ${conflicted.length} conflicted files automatically`);

      for (const file of conflicted) {
        await this.resolveFileConflict(file);
      }

      // Add resolved files and commit
      await this.git.add('.');
      await this.git.commit('Auto-resolve conflicts: prefer remote version');
      
    } catch (error) {
      console.warn('Failed to auto-resolve conflicts:', error);
      // As last resort, reset to remote version
      await this.git.reset(['--hard', 'origin/main']);
      console.warn('🚨 Reset to remote version due to unresolvable conflicts');
    }
  }

  private async resolveFileConflict(filepath: string): Promise<void> {
    try {
      // Back up the conflicted file
      await this.backupConflictedFile(filepath);
      
      // Use remote version (prefer remote as source of truth)
      await this.git.checkout(['--theirs', filepath]);
      
    } catch (error) {
      console.warn(`Failed to resolve conflict for ${filepath}:`, error);
    }
  }

  private async backupConflictedFile(filepath: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const conflictsDir = join(this.getStorePath(), '.llmem', 'conflicts', timestamp);
    await mkdir(conflictsDir, { recursive: true });
    
    const sourceFile = join(this.getStorePath(), filepath);
    const backupFile = join(conflictsDir, filepath.replace(/\//g, '_'));
    
    try {
      const { copyFile } = await import('fs/promises');
      await copyFile(sourceFile, backupFile);
      console.warn(`💾 Backed up conflicted file: ${filepath} -> ${backupFile}`);
    } catch (error) {
      console.warn(`Failed to backup conflicted file ${filepath}:`, error);
    }
  }

  async sync(): Promise<void> {
    if (!this.config.remoteUrl) {
      console.warn('No remote URL configured, skipping sync');
      return;
    }

    console.warn('🔄 Starting manual sync with remote repository');
    
    // Pull first, then push any local changes
    await this.pull();
    
    // Check if we have any local changes to push
    const status = await this.git.status();
    if (status.ahead > 0) {
      await this.push();
    }
    
    console.warn('✅ Sync completed');
  }

  private async ensureDirectoryStructure(): Promise<void> {
    // Only create the contexts directory if it doesn't exist
    // Individual type subdirectories will be created on-demand when saving memories
    const contextsDir = join(this.getStorePath(), 'contexts');
    
    if (!existsSync(contextsDir)) {
      await mkdir(contextsDir, { recursive: true });
      console.warn('📁 Created contexts directory');
    }

    // Ensure .gitignore exists
    const gitignorePath = join(this.getStorePath(), '.gitignore');
    if (!existsSync(gitignorePath)) {
      const gitignoreContent = `.llmem/vectors.db
.llmem/cache/
*.tmp
*.swp
.DS_Store`;
      
      await writeFile(gitignorePath, gitignoreContent);
      console.warn('📝 Created .gitignore file');
    }

    // Ensure README exists
    const readmePath = join(this.getStorePath(), 'README.md');
    if (!existsSync(readmePath)) {
      const simpleReadme = `# Memory Store

This repository contains your personal memories managed by LLMem.

Memories are organized in the \`contexts/\` directory.

You can organize memories in subdirectories however makes sense to you
(e.g., by year, topic, project, etc.).

Each memory is a Markdown file with YAML frontmatter containing metadata.

This repository was cloned from a remote source and is managed by LLMem.`;
      
      await writeFile(readmePath, simpleReadme);
      console.warn('📄 Created README.md file');
    }
  }
}