import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileWatcher } from '../src/storage/file-watcher.js';
import { ContextStore } from '../src/storage/context-store.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';

// Mock chokidar
const mockWatcher = {
  on: vi.fn().mockReturnThis(),
  close: vi.fn()
};

vi.mock('chokidar', () => ({
  watch: vi.fn().mockReturnValue(mockWatcher)
}));

// Mock ContextStore
const mockContextStore = {
  hybridSearch: {
    addContext: vi.fn(),
    updateContext: vi.fn(),
    removeContext: vi.fn()
  },
  parser: {
    parse: vi.fn()
  }
} as any;

describe('FileWatcher', () => {
  let fileWatcher: FileWatcher;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'llmem-watcher-test-'));
    
    // Mock getConfig to return our temp directory
    vi.doMock('../src/utils/config.js', () => ({
      getConfig: () => ({
        storePath: tempDir,
        autoIndex: true
      })
    }));

    fileWatcher = new FileWatcher(mockContextStore);
  });

  afterEach(async () => {
    fileWatcher.stop();
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('lifecycle management', () => {
    it('should start file watcher', () => {
      const { watch } = require('chokidar');
      
      fileWatcher.start();

      expect(watch).toHaveBeenCalledWith(
        join(tempDir, 'contexts'),
        expect.objectContaining({
          ignored: expect.any(RegExp),
          persistent: true,
          ignoreInitial: true,
          depth: 10
        })
      );

      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should stop file watcher', () => {
      fileWatcher.start();
      expect(fileWatcher.isRunning()).toBe(true);

      fileWatcher.stop();
      expect(mockWatcher.close).toHaveBeenCalled();
      expect(fileWatcher.isRunning()).toBe(false);
    });

    it('should not start watcher if already running', () => {
      const { watch } = require('chokidar');
      
      fileWatcher.start();
      fileWatcher.start(); // Second call should be ignored

      expect(watch).toHaveBeenCalledTimes(1);
    });

    it('should track running state correctly', () => {
      expect(fileWatcher.isRunning()).toBe(false);
      
      fileWatcher.start();
      expect(fileWatcher.isRunning()).toBe(true);
      
      fileWatcher.stop();
      expect(fileWatcher.isRunning()).toBe(false);
    });
  });

  describe('file event handling', () => {
    let addHandler: Function;
    let changeHandler: Function;
    let unlinkHandler: Function;
    let errorHandler: Function;

    beforeEach(() => {
      fileWatcher.start();

      // Capture the event handlers
      const onCalls = mockWatcher.on.mock.calls;
      addHandler = onCalls.find(call => call[0] === 'add')?.[1];
      changeHandler = onCalls.find(call => call[0] === 'change')?.[1];
      unlinkHandler = onCalls.find(call => call[0] === 'unlink')?.[1];
      errorHandler = onCalls.find(call => call[0] === 'error')?.[1];
    });

    describe('file add events', () => {
      it('should handle markdown file addition', async () => {
        const mockContext = {
          metadata: {
            id: 'test-id',
            title: 'Test Context',
            type: 'personal',
            tags: ['test'],
            created: '2025-01-01T00:00:00Z',
            updated: '2025-01-01T00:00:00Z',
            relations: []
          },
          content: 'Test content',
          filepath: '/test.md'
        };

        mockContextStore.parser.parse.mockResolvedValue(mockContext);

        await addHandler('/path/to/test.md');

        expect(mockContextStore.hybridSearch.addContext).toHaveBeenCalledWith(mockContext);
      });

      it('should ignore non-markdown files', async () => {
        await addHandler('/path/to/test.txt');

        expect(mockContextStore.parser.parse).not.toHaveBeenCalled();
        expect(mockContextStore.hybridSearch.addContext).not.toHaveBeenCalled();
      });

      it('should handle parsing errors gracefully', async () => {
        mockContextStore.parser.parse.mockRejectedValue(new Error('Parse error'));

        // Should not throw
        await expect(addHandler('/path/to/invalid.md')).resolves.not.toThrow();

        expect(mockContextStore.hybridSearch.addContext).not.toHaveBeenCalled();
      });

      it('should handle indexing errors gracefully', async () => {
        const mockContext = {
          metadata: { id: 'test', title: 'Test' },
          content: 'Test'
        };

        mockContextStore.parser.parse.mockResolvedValue(mockContext);
        mockContextStore.hybridSearch.addContext.mockRejectedValue(new Error('Index error'));

        // Should not throw
        await expect(addHandler('/path/to/test.md')).resolves.not.toThrow();
      });
    });

    describe('file change events', () => {
      it('should handle markdown file changes', async () => {
        const mockContext = {
          metadata: {
            id: 'changed-id',
            title: 'Changed Context',
            type: 'knowledge',
            tags: ['updated'],
            created: '2025-01-01T00:00:00Z',
            updated: '2025-01-01T01:00:00Z',
            relations: []
          },
          content: 'Updated content',
          filepath: '/changed.md'
        };

        mockContextStore.parser.parse.mockResolvedValue(mockContext);

        await changeHandler('/path/to/changed.md');

        expect(mockContextStore.hybridSearch.updateContext).toHaveBeenCalledWith(mockContext);
      });

      it('should ignore non-markdown file changes', async () => {
        await changeHandler('/path/to/changed.txt');

        expect(mockContextStore.parser.parse).not.toHaveBeenCalled();
        expect(mockContextStore.hybridSearch.updateContext).not.toHaveBeenCalled();
      });

      it('should handle update errors gracefully', async () => {
        const mockContext = { metadata: { id: 'test' }, content: 'Test' };
        mockContextStore.parser.parse.mockResolvedValue(mockContext);
        mockContextStore.hybridSearch.updateContext.mockRejectedValue(new Error('Update error'));

        await expect(changeHandler('/path/to/test.md')).resolves.not.toThrow();
      });
    });

    describe('file deletion events', () => {
      it('should handle markdown file deletion', async () => {
        // File with ID in filename: test-title-abcd1234.md
        await unlinkHandler('/path/to/test-title-abcd1234.md');

        // Should log the attempt but not actually remove (as noted in implementation)
        // The current implementation doesn't remove from index to avoid removing wrong contexts
      });

      it('should ignore non-markdown file deletion', async () => {
        await unlinkHandler('/path/to/test.txt');

        // Should not do anything for non-markdown files
      });

      it('should handle files without ID pattern', async () => {
        await unlinkHandler('/path/to/no-id-pattern.md');

        // Should handle gracefully when filename doesn't match expected pattern
      });

      it('should handle deletion errors gracefully', async () => {
        // Should not throw even if there are internal errors
        await expect(unlinkHandler('/path/to/problematic-file.md')).resolves.not.toThrow();
      });
    });

    describe('error handling', () => {
      it('should handle watcher errors', () => {
        const testError = new Error('Watcher error');

        // Should not throw when error handler is called
        expect(() => errorHandler(testError)).not.toThrow();
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid file changes', async () => {
      const mockContext = {
        metadata: { id: 'rapid-test', title: 'Rapid Test' },
        content: 'Content'
      };

      mockContextStore.parser.parse.mockResolvedValue(mockContext);
      fileWatcher.start();

      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')?.[1];

      // Simulate rapid changes
      const promises = [
        changeHandler('/test/rapid.md'),
        changeHandler('/test/rapid.md'),
        changeHandler('/test/rapid.md')
      ];

      await Promise.all(promises);

      // Should handle all changes (though some might be redundant)
      expect(mockContextStore.hybridSearch.updateContext).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed file types in events', async () => {
      fileWatcher.start();

      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];

      await Promise.all([
        addHandler('/test/valid.md'),
        addHandler('/test/ignore.txt'),
        addHandler('/test/also-ignore.json'),
        addHandler('/test/another-valid.md')
      ]);

      // Should only process .md files
      expect(mockContextStore.parser.parse).toHaveBeenCalledTimes(2);
    });
  });
});