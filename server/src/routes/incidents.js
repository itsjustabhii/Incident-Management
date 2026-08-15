/**
 * @file Incident routes
 * @description CRUD and lifecycle endpoints for incidents.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize, authorizeMinRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createIncidentSchema,
  updateIncidentSchema,
  listIncidentsSchema,
} from '../validators/incident.validator.js';
import * as incidentController from '../controllers/incident.controller.js';

const router = Router();

// All incident routes require authentication
router.use(authenticate);

/** GET /api/v1/incidents — Paginated, filtered incident list */
router.get('/', validate(listIncidentsSchema, 'query'), incidentController.list);

/** POST /api/v1/incidents — Create a new incident */
router.post('/', validate(createIncidentSchema), incidentController.create);

/** GET /api/v1/incidents/:id — Get a single incident with full details */
router.get('/:id', incidentController.getById);

/** PATCH /api/v1/incidents/:id — Update incident fields / status / assignment */
router.patch('/:id', validate(updateIncidentSchema), incidentController.update);

/** DELETE /api/v1/incidents/:id — Admin only soft-delete */
router.delete('/:id', authorize('ADMIN'), incidentController.remove);

/** GET /api/v1/incidents/:id/audit — Audit trail for a specific incident */
router.get('/:id/audit', incidentController.getAuditLog);

export default router;
