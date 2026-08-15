/**
 * @file User request validators
 */

import { z } from 'zod';
import { USER_ROLE } from '../constants/roles.js';

const roleValues = Object.values(USER_ROLE);

export const updateUserSchema = z
  .object({
    displayName: z.string().min(2).max(100).trim().optional(),
    avatarUrl: z.string().url('Must be a valid URL').optional().nullable(),
    // Role changes are allowed only to ADMIN users — enforced in the controller/service
    role: z.enum(roleValues).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided',
  });
