import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { GitStore } from './git-store.js';
import { createTempDir, cleanupTempDir } from '../test/helpers/test-utils.js';

describe('GitStore', () => {
  let gitStore: GitStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    gitStore = new GitStore(tempDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('initialize', () => {
    it('should create directory if it does not exist', async () => {
      expect(existsSync(tempDir)).toBe(true);
      
      await gitStore.initialize();
      
      expect(existsSync(join(tempDir, '.git'))).toBe(true);
    });

    it('should initialize git repository', async () => {
      await gitStore.initialize();
      
      const status = await gitStore.getStatus();
      expect(status).toBeDefined();
    });

    it('should create initial directory structure', async () => {
      await gitStore.initialize();
      
      // Should create minimal structure - flexible directories created on demand
      expect(existsSync(join(tempDir, 'contexts'))).toBe(true);
      expect(existsSync(join(tempDir, '.llmem/cache'))).toBe(true);
      expect(existsSync(join(tempDir, '.gitignore'))).toBe(true);
      expect(existsSync(join(tempDir, 'README.md'))).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await gitStore.initialize();
      const firstInitialized = existsSync(join(tempDir, '.git'));
      
      await gitStore.initialize();
      const secondInitialized = existsSync(join(tempDir, '.git'));
      
      expect(firstInitialized).toBe(true);
      expect(secondInitialized).toBe(true);
    });
  });

  describe('add and commit', () => {
    beforeEach(async () => {
      await gitStore.initialize();
    });

    it('should add and commit a file', async () => {
      const testFile = join(tempDir, 'test.md');
      await writeFile(testFile, '# Test content');
      
      await gitStore.add('test.md');
      await gitStore.commit('Add test file');
      
      const status = await gitStore.getStatus();
      expect(status.files.length).toBe(0); // No uncommitted files
    });

    it('should handle commit with no changes gracefully', async () => {
      await expect(gitStore.commit('Empty commit')).resolves.not.toThrow();
    });
  });

  describe('getHistory', () => {
    beforeEach(async () => {
      await gitStore.initialize();
    });

    it('should return commit history', async () => {
      const testFile = join(tempDir, 'test.md');
      await writeFile(testFile, '# Test 1');
      await gitStore.add('test.md');
      await gitStore.commit('First commit');
      
      await writeFile(testFile, '# Test 2');
      await gitStore.add('test.md');
      await gitStore.commit('Second commit');
      
      const history = await gitStore.getHistory();
      expect(history.all.length).toBeGreaterThanOrEqual(2);
      expect(history.latest.message).toContain('Second commit');
    });

    it('should return file-specific history', async () => {
      const testFile = join(tempDir, 'test.md');
      await writeFile(testFile, '# Test');
      await gitStore.add('test.md');
      await gitStore.commit('Add test.md');
      
      const history = await gitStore.getHistory('test.md', 5);
      expect(history.all.some(commit => 
        commit.message.includes('Add test.md')
      )).toBe(true);
    });
  });

  describe('branches', () => {
    beforeEach(async () => {
      await gitStore.initialize();
    });

    it('should create and checkout branches', async () => {
      await gitStore.createBranch('feature-test');
      
      const status = await gitStore.getStatus();
      expect(status.current).toBe('feature-test');
    });

    it('should checkout existing branch', async () => {
      await gitStore.createBranch('feature-1');
      await gitStore.checkout('main');
      await gitStore.checkout('feature-1');
      
      const status = await gitStore.getStatus();
      expect(status.current).toBe('feature-1');
    });
  });

  describe('getDiff', () => {
    beforeEach(async () => {
      await gitStore.initialize();
    });

    it('should return diff for modified files', async () => {
      const testFile = join(tempDir, 'test.md');
      await writeFile(testFile, '# Original');
      await gitStore.add('test.md');
      await gitStore.commit('Initial commit');
      
      await writeFile(testFile, '# Modified');
      
      const diff = await gitStore.getDiff();
      expect(diff).toContain('Original');
      expect(diff).toContain('Modified');
    });

    it('should return diff for specific file', async () => {
      const file1 = join(tempDir, 'file1.md');
      const file2 = join(tempDir, 'file2.md');
      
      await writeFile(file1, '# File 1');
      await writeFile(file2, '# File 2');
      await gitStore.add('.');
      await gitStore.commit('Add files');
      
      await writeFile(file1, '# File 1 Modified');
      
      const diff = await gitStore.getDiff('file1.md');
      expect(diff).toContain('File 1');
      expect(diff).not.toContain('File 2');
    });
  });
});