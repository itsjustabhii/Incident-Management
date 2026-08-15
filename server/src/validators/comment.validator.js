/**
 * @file Comment request validators
 */

import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(5000).trim(),
  isInternal: z.boolean().optional().default(false),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
});
