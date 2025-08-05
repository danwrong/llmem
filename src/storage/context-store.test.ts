import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { ContextStore } from './context-store.js';
import { createTempDir, cleanupTempDir, createMockContext } from '../test/helpers/test-utils.js';

describe('ContextStore', () => {
  let contextStore: ContextStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    contextStore = new ContextStore(tempDir);
    await contextStore.initialize();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('create', () => {
    it('should create a new context', async () => {
      const context = await contextStore.create(
        'Test Context',
        'This is test content',
        'knowledge'
      );

      expect(context.metadata.title).toBe('Test Context');
      expect(context.metadata.type).toBe('knowledge');
      expect(context.content).toBe('This is test content');
      expect(context.filepath).toBeDefined();
      expect(existsSync(context.filepath!)).toBe(true);
    });

    it('should create context with additional metadata', async () => {
      const context = await contextStore.create(
        'Tagged Context',
        'Content with tags',
        'project',
        {
          tags: ['important', 'work'],
        }
      );

      expect(context.metadata.tags).toEqual(['important', 'work']);
    });

    it('should generate appropriate filepath', async () => {
      const context = await contextStore.create(
        'My Test Project!!!',
        'Content',
        'project'
      );

      expect(context.filepath).toContain('contexts/project/');
      expect(context.filepath).toContain('my-test-project');
      expect(context.filepath).toMatch(/\.md$/);
    });
  });

  describe('read', () => {
    it('should read existing context by ID', async () => {
      const created = await contextStore.create(
        'Read Test',
        'Content to read',
        'knowledge'
      );

      const read = await contextStore.read(created.metadata.id);

      expect(read).not.toBeNull();
      expect(read!.metadata.title).toBe('Read Test');
      expect(read!.content).toBe('Content to read');
    });

    it('should return null for non-existent context', async () => {
      const result = await contextStore.read('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing context content', async () => {
      const created = await contextStore.create(
        'Update Test',
        'Original content',
        'knowledge'
      );

      const updated = await contextStore.update(created.metadata.id, {
        content: 'Updated content',
      });

      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('Updated content');
      expect(updated!.metadata.updated).not.toBe(created.metadata.updated);
    });

    it('should update context metadata', async () => {
      const created = await contextStore.create(
        'Metadata Test',
        'Content',
        'knowledge'
      );

      const updated = await contextStore.update(created.metadata.id, {
        metadata: {
          tags: ['new-tag'],
        },
      });

      expect(updated!.metadata.tags).toEqual(['new-tag']);
    });

    it('should return null for non-existent context', async () => {
      const result = await contextStore.update('non-existent-id', {
        content: 'New content',
      });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing context', async () => {
      const created = await contextStore.create(
        'Delete Test',
        'To be deleted',
        'knowledge'
      );

      const deleted = await contextStore.delete(created.metadata.id);
      expect(deleted).toBe(true);

      const read = await contextStore.read(created.metadata.id);
      expect(read).toBeNull();
      expect(existsSync(created.filepath!)).toBe(false);
    });

    it('should return false for non-existent context', async () => {
      const result = await contextStore.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create test contexts
      await contextStore.create('Knowledge 1', 'Content 1', 'knowledge', {
        tags: ['tag1'],
      });
      await contextStore.create('Project 1', 'Content 2', 'project', {
        tags: ['tag2'],
      });
      await contextStore.create('Knowledge 2', 'Content 3', 'knowledge', {
        tags: ['tag1', 'tag2'],
      });
    });

    it('should list all contexts', async () => {
      const contexts = await contextStore.list();
      expect(contexts.length).toBe(3);
    });

    it('should filter by type', async () => {
      const contexts = await contextStore.list({ type: 'knowledge' });
      expect(contexts.length).toBe(2);
      expect(contexts.every(c => c.metadata.type === 'knowledge')).toBe(true);
    });


    it('should filter by tags', async () => {
      const contexts = await contextStore.list({ tags: ['tag1'] });
      expect(contexts.length).toBe(2);
      expect(contexts.every(c => c.metadata.tags.includes('tag1'))).toBe(true);
    });

    it('should filter by multiple tags (AND)', async () => {
      const contexts = await contextStore.list({ tags: ['tag1', 'tag2'] });
      expect(contexts.length).toBe(1);
      expect(contexts[0].metadata.title).toBe('Knowledge 2');
    });

    it('should sort by updated date (newest first)', async () => {
      const contexts = await contextStore.list();
      for (let i = 1; i < contexts.length; i++) {
        const current = new Date(contexts[i].metadata.updated);
        const previous = new Date(contexts[i - 1].metadata.updated);
        expect(current.getTime()).toBeLessThanOrEqual(previous.getTime());
      }
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await contextStore.create('JavaScript Guide', 'Learn JavaScript fundamentals', 'knowledge', {
        tags: ['programming', 'javascript'],
      });
      await contextStore.create('Python Project', 'A project using Python and Django', 'project', {
        tags: ['programming', 'python'],
      });
      await contextStore.create('Meeting Notes', 'Discussion about API design', 'conversation');
    });

    it('should search by title', async () => {
      const results = await contextStore.search('JavaScript');
      expect(results.length).toBe(1);
      expect(results[0].metadata.title).toBe('JavaScript Guide');
    });

    it('should search by content', async () => {
      const results = await contextStore.search('Django');
      expect(results.length).toBe(1);
      expect(results[0].metadata.title).toBe('Python Project');
    });

    it('should search by tags', async () => {
      const results = await contextStore.search('programming');
      expect(results.length).toBe(2);
    });

    it('should be case insensitive', async () => {
      const results = await contextStore.search('PYTHON');
      expect(results.length).toBe(1);
      expect(results[0].metadata.title).toBe('Python Project');
    });

    it('should return empty array for no matches', async () => {
      const results = await contextStore.search('nonexistent');
      expect(results.length).toBe(0);
    });
  });
});