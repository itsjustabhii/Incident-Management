/**
 * @file Incident request validators
 */

import { z } from 'zod';
import { INCIDENT_STATUS, INCIDENT_PRIORITY, INCIDENT_CATEGORY } from '../constants/incident.js';

const statusValues = Object.values(INCIDENT_STATUS);
const priorityValues = Object.values(INCIDENT_PRIORITY);
const categoryValues = Object.values(INCIDENT_CATEGORY);

/** Schema for POST /incidents */
export const createIncidentSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255).trim(),
  description: z.string().min(10, 'Description must be at least 10 characters').max(10000).trim(),
  priority: z.enum(priorityValues).default('MEDIUM'),
  category: z.enum(categoryValues).default('OTHER'),
  assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
  teamId: z.string().uuid('Invalid team ID').optional().nullable(),
});

/** Schema for PATCH /incidents/:id — all fields optional */
export const updateIncidentSchema = z
  .object({
    title: z.string().min(5).max(255).trim().optional(),
    description: z.string().min(10).max(10000).trim().optional(),
    status: z.enum(statusValues).optional(),
    priority: z.enum(priorityValues).optional(),
    category: z.enum(categoryValues).optional(),
    assigneeId: z.string().uuid().optional().nullable(),
    teamId: z.string().uuid().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

/** Schema for GET /incidents query parameters */
export const listIncidentsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(statusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  category: z.enum(categoryValues).optional(),
  assigneeId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status', 'slaBreachAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  slaBreached: z.enum(['true', 'false']).optional(),
});
