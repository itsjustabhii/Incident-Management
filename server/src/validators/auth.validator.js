/**
 * @file Authentication request validators
 * @description Zod schemas that validate the shape and content of auth request
 * bodies before they reach controller code.
 */

import { z } from 'zod';

/**
 * Schema for POST /auth/register
 * Password rules enforce minimum security requirements while remaining
 * achievable for real users (no absurd complexity demands).
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email('Must be a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    ),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must not exceed 100 characters')
    .trim(),
});

/**
 * Schema for POST /auth/login
 */
export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Schema for POST /auth/refresh
 * The refresh token comes from the HttpOnly cookie, not the body,
 * so this schema is a no-op but kept for consistency.
 */
export const refreshSchema = z.object({}).optional();
