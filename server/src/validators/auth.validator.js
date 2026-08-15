/**
 * @file Authentication request validators
 * @description Zod schemas that validate the shape and content of auth request
 * bodies before they reach controller code.
 *
 * Validation here is a first line of defence (input sanity) but is NOT a
 * substitute for server-side authorization — invalid input is rejected before
 * any business logic runs.
 */

import { z } from 'zod';

/**
 * Schema for POST /auth/register
 * Password rules enforce minimum security requirements while remaining
 * achievable for real users (no absurd complexity demands).
 * Upper-bound (128 chars) prevents bcrypt DoS via extremely long passwords.
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
    .max(128, 'Password must not exceed 128 characters — this is a DoS prevention limit')
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
 * No complex password rules here — the DB comparison determines validity.
 * We still cap the password to prevent bcrypt DoS on login attempts.
 */
export const loginSchema = z.object({
  email: z.string().email('Must be a valid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required').max(128, 'Password must not exceed 128 characters'),
});

/**
 * Schema for POST /auth/refresh
 * The refresh token comes from the HttpOnly cookie, not the body.
 * This schema is a no-op placeholder kept for middleware consistency.
 */
export const refreshSchema = z.object({}).optional();

/**
 * Schema for POST /auth/change-password
 * Requires the current password to prevent session-fixation attacks.
 * The new password must meet the same complexity rules as registration.
 */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required')
    .max(128, 'Password must not exceed 128 characters'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'New password must contain at least one uppercase letter, one lowercase letter, and one number',
    ),
});
