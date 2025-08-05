import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Context, ContextMetadata } from '../../models/context.js';

export async function createTempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'llmem-test-'));
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export function createMockContext(overrides?: Partial<Context>): Context {
  const now = new Date().toISOString();
  const defaultContext: Context = {
    metadata: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test Context',
      type: 'knowledge',
      tags: ['test'],
      created: now,
      updated: now,
      relations: [],
    },
    content: 'This is test content.',
    filepath: '/test/path.md',
  };

  return {
    ...defaultContext,
    ...overrides,
    metadata: {
      ...defaultContext.metadata,
      ...(overrides?.metadata || {}),
    },
  };
}

export function createMockMarkdown(metadata?: Partial<ContextMetadata>): string {
  const context = createMockContext({ metadata });
  const { metadata: meta, content } = context;
  
  return `---
id: "${meta.id}"
title: "${meta.title}"
type: "${meta.type}"
tags: ["${meta.tags.join('", "')}"]
created: "${meta.created}"
updated: "${meta.updated}"
relations: [${meta.relations.map(r => `"${r}"`).join(', ')}]
---

${content}`;
}