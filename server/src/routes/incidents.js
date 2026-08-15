/**
 * @file Incident routes
 * @description CRUD and lifecycle endpoints for incidents.
 *
 * Authorization matrix:
 *   GET  /                  — All authenticated users (scoped by service layer)
 *   POST /                  — ADMIN, MANAGER, SUPPORT_ENGINEER (VIEWER blocked)
 *   GET  /:id               — All authenticated users (scoped by service layer)
 *   PATCH /:id              — ADMIN, MANAGER, SUPPORT_ENGINEER (scoped by service layer)
 *   DELETE /:id             — ADMIN only
 *   GET  /:id/audit         — ADMIN, MANAGER only (sensitive compliance data)
 *
 * Additional field-level restrictions are enforced in the incident service:
 *   • SUPPORT_ENGINEER can only modify status/resolve their own incidents.
 *   • VIEWER can read but receives a filtered view (no internal comments in detail).
 *   • Only ADMIN/MANAGER can change assigneeId or priority.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize, requirePermission, blockViewer } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createIncidentSchema,
  updateIncidentSchema,
  listIncidentsSchema,
} from '../validators/incident.validator.js';
import * as incidentController from '../controllers/incident.controller.js';
import { PERMISSION } from '../constants/permissions.js';

const router = Router();

// All incident routes require a valid JWT — reject unauthenticated requests
router.use(authenticate);

// Block VIEWERs from all mutations at the router level.
// Individual GET handlers still work for VIEWERs.
router.use(blockViewer);

/**
 * GET /api/v1/incidents
 * Paginated, filtered incident list.
 * ENGINEERs / VIEWERs see only incidents they are involved with (service layer).
 */
router.get('/', validate(listIncidentsSchema, 'query'), incidentController.list);

/**
 * POST /api/v1/incidents
 * Creates a new incident. VIEWERs are blocked by blockViewer above.
 * SUPPORT_ENGINEERs can create incidents.
 */
router.post(
  '/',
  requirePermission(PERMISSION.CREATE_INCIDENTS),
  validate(createIncidentSchema),
  incidentController.create,
);

/**
 * GET /api/v1/incidents/:id
 * Returns a single incident. Access is scoped in the service layer.
 */
router.get('/:id', incidentController.getById);

/**
 * PATCH /api/v1/incidents/:id
 * Updates incident fields. Field-level restrictions enforced in the service:
 *   • Only ADMIN/MANAGER may change assigneeId or priority.
 *   • SUPPORT_ENGINEER may only update incidents they are assigned to.
 */
router.patch(
  '/:id',
  requirePermission(PERMISSION.EDIT_INCIDENTS),
  validate(updateIncidentSchema),
  incidentController.update,
);

/**
 * DELETE /api/v1/incidents/:id
 * Hard-deletes an incident (soft-delete in the service).
 * ADMIN only — irreversible privileged action.
 */
router.delete('/:id', authorize('ADMIN'), incidentController.remove);

/**
 * GET /api/v1/incidents/:id/audit
 * Returns the full audit history for a specific incident.
 * Restricted to ADMIN and MANAGER — contains sensitive field-level change data.
 */
router.get(
  '/:id/audit',
  requirePermission(PERMISSION.VIEW_AUDIT_LOGS),
  incidentController.getAuditLog,
);

export default router;
