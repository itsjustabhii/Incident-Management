/**
 * @file Incident controller
 * @description Thin HTTP handlers for incident endpoints.
 * All business logic lives in the incident service layer.
 */

import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import * as incidentService from '../services/incident.service.js';

/**
 * GET /api/v1/incidents
 * Returns a paginated, filtered list of incidents.
 */
export const list = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { incidents, total } = await incidentService.listIncidents(
    req.query,
    pagination,
    req.user,
  );
  const meta = buildPaginationMeta(total, pagination.page, pagination.pageSize);
  sendSuccess(res, { incidents }, 200, meta);
});

/**
 * POST /api/v1/incidents
 * Creates a new incident; SLA breach time is computed and persisted.
 */
export const create = catchAsync(async (req, res) => {
  const incident = await incidentService.createIncident(req.body, req.user);
  sendSuccess(res, { incident }, 201);
});

/**
 * GET /api/v1/incidents/:id
 * Returns a single incident with related data (comments count, attachments, assignee).
 */
export const getById = catchAsync(async (req, res) => {
  const incident = await incidentService.getIncidentById(req.params.id, req.user);
  sendSuccess(res, { incident });
});

/**
 * PATCH /api/v1/incidents/:id
 * Updates incident fields, enforces state machine transitions, records audit log.
 */
export const update = catchAsync(async (req, res) => {
  const incident = await incidentService.updateIncident(req.params.id, req.body, req.user);
  sendSuccess(res, { incident });
});

/**
 * DELETE /api/v1/incidents/:id
 * Admin-only deletion. Records an audit log entry before removing.
 */
export const remove = catchAsync(async (req, res) => {
  await incidentService.deleteIncident(req.params.id, req.user);
  sendSuccess(res, { message: 'Incident deleted successfully' });
});

/**
 * GET /api/v1/incidents/:id/audit
 * Returns the full audit history for a specific incident.
 */
export const getAuditLog = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { logs, total } = await incidentService.getAuditLog(req.params.id, pagination);
  const meta = buildPaginationMeta(total, pagination.page, pagination.pageSize);
  sendSuccess(res, { logs }, 200, meta);
});
