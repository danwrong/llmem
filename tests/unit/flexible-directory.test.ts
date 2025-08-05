import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextStore } from '../src/storage/context-store.js';
import { createTempDir, cleanupTempDir } from '../src/test/helpers/test-utils.js';

describe('Flexible Directory Structure', () => {
  let contextStore: ContextStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    contextStore = new ContextStore(tempDir);
    await contextStore.initialize();
  });

  afterEach(async () => {
    await contextStore.cleanup();
    await cleanupTempDir(tempDir);
  });

  describe('directory creation and organization', () => {
    it('should create nested directory structures', async () => {
      const context = await contextStore.create(
        'ML Research Notes',
        'Notes about machine learning research',
        'work/projects/2024/machine-learning/research'
      );

      expect(context.metadata.type).toBe('work/projects/2024/machine-learning/research');
      expect(context.filepath).toContain('work/projects/2024/machine-learning/research');
    });

    it('should handle simple directory types', async () => {
      const context = await contextStore.create(
        'Personal Note',
        'A simple personal note',
        'personal'
      );

      expect(context.metadata.type).toBe('personal');
      expect(context.filepath).toContain('personal');
    });

    it('should sanitize directory paths for security', async () => {
      const context = await contextStore.create(
        'Security Test',
        'Testing path sanitization',
        '../../../etc/passwd'
      );

      // Should sanitize out the parent directory references
      expect(context.metadata.type).toBe('../../../etc/passwd');
      expect(context.filepath).not.toContain('../');
      expect(context.filepath).toContain('etc/passwd');
    });

    it('should handle date-based organization', async () => {
      const context = await contextStore.create(
        'Daily Standup Notes',
        'Notes from today\'s standup',
        'daily/2024/january/15'
      );

      expect(context.metadata.type).toBe('daily/2024/january/15');
      expect(context.filepath).toContain('daily/2024/january/15');
    });

    it('should handle project-based organization', async () => {
      const context = await contextStore.create(
        'API Documentation',
        'REST API documentation for the user service',
        'projects/user-service/docs/api'
      );

      expect(context.metadata.type).toBe('projects/user-service/docs/api');
      expect(context.filepath).toContain('projects/user-service/docs/api');
    });
  });

  describe('listing by directory type', () => {
    beforeEach(async () => {
      // Create test memories with various directory structures
      await contextStore.create('Work Note 1', 'Content 1', 'work/projects/alpha');
      await contextStore.create('Work Note 2', 'Content 2', 'work/projects/beta');
      await contextStore.create('Personal Note', 'Content 3', 'personal/journal');
      await contextStore.create('Knowledge Base', 'Content 4', 'knowledge/programming/typescript');
      await contextStore.create('Daily Note', 'Content 5', 'daily/2024/january');
    });

    it('should list memories by exact directory type', async () => {
      const workProjectsAlpha = await contextStore.list({ type: 'work/projects/alpha' });
      expect(workProjectsAlpha).toHaveLength(1);
      expect(workProjectsAlpha[0].metadata.title).toBe('Work Note 1');
    });

    it('should not match partial directory paths', async () => {
      const workResults = await contextStore.list({ type: 'work' });
      expect(workResults).toHaveLength(0); // Should not match 'work/projects/alpha'
    });

    it('should list memories from nested directories independently', async () => {
      const knowledgeResults = await contextStore.list({ type: 'knowledge/programming/typescript' });
      expect(knowledgeResults).toHaveLength(1);
      expect(knowledgeResults[0].metadata.title).toBe('Knowledge Base');
    });

    it('should return empty list for non-existent directory types', async () => {
      const results = await contextStore.list({ type: 'non/existent/path' });
      expect(results).toHaveLength(0);
    });
  });

  describe('semantic search across directories', () => {
    beforeEach(async () => {
      // Create memories across different directories with similar content
      await contextStore.create(
        'TypeScript Basics',
        'TypeScript provides static typing for JavaScript',
        'knowledge/programming/languages'
      );
      await contextStore.create(
        'Project Setup',
        'Setting up TypeScript in a new project',
        'work/projects/frontend/setup'
      );
      await contextStore.create(
        'Learning Notes', 
        'My notes on learning TypeScript features',
        'personal/learning/2024'
      );
    });

    it('should find relevant memories regardless of directory structure', async () => {
      const results = await contextStore.search('TypeScript');
      
      // Should find memories from different directories
      expect(results.length).toBeGreaterThan(0);
      
      const titles = results.map(r => r.metadata.title);
      expect(titles).toContain('TypeScript Basics');
      expect(titles).toContain('Project Setup');
      expect(titles).toContain('Learning Notes');
    });

    it('should search content across all directory types', async () => {
      const results = await contextStore.search('static typing');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.type).toBe('knowledge/programming/languages');
    });
  });

  describe('directory structure evolution', () => {
    it('should handle updating memory to different directory type', async () => {
      const original = await contextStore.create(
        'Research Paper',
        'Important research findings',
        'temporary/unsorted'
      );

      const updated = await contextStore.update(original.metadata.id, {
        metadata: { type: 'knowledge/research/papers' }
      });

      expect(updated?.metadata.type).toBe('knowledge/research/papers');
    });

    it('should maintain memory accessibility after directory changes', async () => {
      const original = await contextStore.create(
        'Project Idea',
        'Idea for a new mobile app',
        'ideas/random'
      );

      // Update to a more organized structure
      await contextStore.update(original.metadata.id, {
        metadata: { type: 'projects/mobile-app/planning' }
      });

      // Should still be findable by ID
      const retrieved = await contextStore.read(original.metadata.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.metadata.type).toBe('projects/mobile-app/planning');
    });
  });

  describe('directory best practices validation', () => {
    it('should accept reasonable directory depths', async () => {
      const context = await contextStore.create(
        'Deep Organization',
        'Testing deep directory structure',
        'work/client/project/phase1/requirements/functional/user-stories'
      );

      expect(context.metadata.type).toBe('work/client/project/phase1/requirements/functional/user-stories');
    });

    it('should handle special characters in directory names', async () => {
      const context = await contextStore.create(
        'Special Characters Test',
        'Testing directory names with special characters',
        'projects/my-app_v2.0/docs & notes'
      );

      expect(context.metadata.type).toBe('projects/my-app_v2.0/docs & notes');
      // Filepath should be sanitized for filesystem safety
      expect(context.filepath).toMatch(/projects.my-app-v2-0.docs-notes/);
    });

    it('should handle empty directory type gracefully', async () => {
      const context = await contextStore.create(
        'Root Level Memory',
        'A memory without specific directory',
        ''
      );

      expect(context.metadata.type).toBe('');
      expect(context.filepath).toContain('contexts/'); // Should go to root contexts directory
    });
  });
});