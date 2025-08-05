import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownParser } from './markdown-parser.js';
import { createMockMarkdown } from '../test/helpers/test-utils.js';

describe('MarkdownParser', () => {
  let parser: MarkdownParser;

  beforeEach(() => {
    parser = new MarkdownParser();
  });

  describe('parse', () => {
    it('should parse valid markdown with frontmatter', () => {
      const markdown = createMockMarkdown();
      const result = parser.parse(markdown);

      expect(result.metadata.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.metadata.title).toBe('Test Context');
      expect(result.metadata.type).toBe('knowledge');
      expect(result.content).toBe('This is test content.');
    });

    it('should handle markdown with complex content', () => {
      const markdown = `---
id: "550e8400-e29b-41d4-a716-446655440000"
title: "Complex Test"
type: "project"
tags: ["test", "complex"]
created: "2024-01-01T00:00:00Z"
updated: "2024-01-01T00:00:00Z"
privacy: "public"
relations: []
---

# Header 1

This is a paragraph with **bold** and *italic* text.

## Header 2

- List item 1
- List item 2

\`\`\`javascript
const code = "example";
\`\`\``;

      const result = parser.parse(markdown);
      expect(result.metadata.title).toBe('Complex Test');
      expect(result.content).toContain('# Header 1');
      expect(result.content).toContain('```javascript');
    });

    it('should include filepath if provided', () => {
      const markdown = createMockMarkdown();
      const filepath = '/test/context.md';
      const result = parser.parse(markdown, filepath);

      expect(result.filepath).toBe(filepath);
    });

    it('should throw on invalid metadata', () => {
      const invalidMarkdown = `---
title: "Missing required fields"
---

Content`;

      expect(() => parser.parse(invalidMarkdown)).toThrow();
    });
  });

  describe('stringify', () => {
    it('should convert context to markdown with frontmatter', () => {
      const context = {
        metadata: {
          id: '123',
          title: 'Test',
          type: 'knowledge' as const,
          tags: ['test'],
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
          relations: [],
        },
        content: 'Test content',
      };

      const result = parser.stringify(context);
      
      expect(result).toContain('---');
      expect(result).toContain('id: \'123\'');
      expect(result).toContain('title: Test');
      expect(result).toContain('Test content');
    });
  });

  describe('createNewContext', () => {
    it('should create a new context with generated ID', () => {
      const result = parser.createNewContext(
        'New Context',
        'Content here',
        'personal'
      );

      expect(result.metadata.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.metadata.title).toBe('New Context');
      expect(result.metadata.type).toBe('personal');
      expect(result.content).toBe('Content here');
    });

    it('should apply additional metadata', () => {
      const result = parser.createNewContext(
        'New Context',
        'Content',
        'project',
        {
          tags: ['important', 'work'],
        }
      );

      expect(result.metadata.tags).toEqual(['important', 'work']);
    });
  });

  describe('extractSummary', () => {
    it('should extract plain text summary', () => {
      const content = `# Title

This is a **bold** paragraph with [links](http://example.com) and *italic* text.

## Another section

More content here...`;

      const summary = parser.extractSummary(content, 50);
      
      expect(summary).toBe('Title This is a bold paragraph with links and...');
      expect(summary.length).toBeLessThanOrEqual(50);
    });

    it('should return full content if under max length', () => {
      const content = 'Short content';
      const summary = parser.extractSummary(content, 100);
      
      expect(summary).toBe('Short content');
    });

    it('should truncate at word boundaries', () => {
      const content = 'This is a test sentence with multiple words that should be truncated';
      const summary = parser.extractSummary(content, 30);
      
      expect(summary).toBe('This is a test sentence...');
      expect(summary.length).toBeLessThanOrEqual(30);
      expect(summary.endsWith('...')).toBe(true);
    });

    it('should handle text with no spaces', () => {
      const content = 'Verylongwordwithoutanyspaces';
      const summary = parser.extractSummary(content, 15);
      
      expect(summary).toBe('Verylongword...');
      expect(summary.length).toBe(15);
    });
  });
});