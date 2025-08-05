import { z } from 'zod';

export const ContextTypeSchema = z.enum(['personal', 'project', 'knowledge', 'conversation']);

export const ContextMetadataSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: ContextTypeSchema,
  tags: z.array(z.string()).default([]),
  created: z.string().datetime(),
  updated: z.string().datetime(),
  expires: z.string().datetime().nullable().optional(),
  relations: z.array(z.string().uuid()).default([]),
});

export const ContextSchema = z.object({
  metadata: ContextMetadataSchema,
  content: z.string(),
  filepath: z.string().optional(),
});

export type ContextType = z.infer<typeof ContextTypeSchema>;
export type ContextMetadata = z.infer<typeof ContextMetadataSchema>;
export type Context = z.infer<typeof ContextSchema>;