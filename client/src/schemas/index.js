/**
 * @file Zod validation schemas for client-side form validation
 * @description These schemas are used with react-hook-form + @hookform/resolvers/zod
 * to validate form inputs before they are submitted to the API.
 */

import { z } from 'zod';
import { INCIDENT_STATUS, INCIDENT_PRIORITY, INCIDENT_CATEGORY } from '../constants/index.js';

/**
 * Login form schema
 */
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Registration form schema
 */
export const registerSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Must include uppercase, lowercase, and a number',
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Create incident form schema
 */
export const createIncidentSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters').max(10000),
  priority: z.enum(Object.values(INCIDENT_PRIORITY)),
  category: z.enum(Object.values(INCIDENT_CATEGORY)),
  assigneeId: z.string().uuid().optional().or(z.literal('')),
  teamId: z.string().uuid().optional().or(z.literal('')),
});

/**
 * Update incident form schema — all fields optional
 */
export const updateIncidentSchema = z.object({
  title: z.string().min(5).max(255).optional(),
  description: z.string().min(10).max(10000).optional(),
  status: z.enum(Object.values(INCIDENT_STATUS)).optional(),
  priority: z.enum(Object.values(INCIDENT_PRIORITY)).optional(),
  category: z.enum(Object.values(INCIDENT_CATEGORY)).optional(),
  assigneeId: z.string().uuid().optional().or(z.literal('')),
});

/**
 * Comment form schema
 */
export const commentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(5000),
  isInternal: z.boolean().optional(),
});
