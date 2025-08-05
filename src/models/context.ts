import { z } from 'zod';

export const ContextMetadataSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: z.string(), // Now a flexible directory path like "travel/2024/japan" or "personal"
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

export type ContextMetadata = z.infer<typeof ContextMetadataSchema>;
export type Context = z.infer<typeof ContextSchema>;