/**
 * @file Team request validators
 */

import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  description: z.string().max(500).trim().optional(),
});

export const updateTeamSchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    description: z.string().max(500).trim().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided',
  });

export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['MEMBER', 'LEAD']).optional().default('MEMBER'),
});
