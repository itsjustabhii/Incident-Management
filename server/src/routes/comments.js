/**
 * @file Comment routes
 * @description Endpoints for comment threads on incidents.
 * Mounted under /api/v1/incidents so the URL is /incidents/:incidentId/comments
 *
 * Authorization matrix:
 *   GET    /:incidentId/comments           — All authenticated users (VIEWERs get non-internal only)
 *   POST   /:incidentId/comments           — ADMIN, MANAGER, SUPPORT_ENGINEER (VIEWER blocked)
 *   PATCH  /:incidentId/comments/:id       — Comment author or ADMIN (enforced in service)
 *   DELETE /:incidentId/comments/:id       — Comment author or ADMIN (enforced in service)
 *
 * VIEWERs cannot add, edit, or delete comments — they have read-only access.
 * Internal comment visibility is filtered in the service layer by role.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission, blockViewer } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createCommentSchema,
  updateCommentSchema,
} from '../validators/comment.validator.js';
import * as commentController from '../controllers/comment.controller.js';
import { PERMISSION } from '../constants/permissions.js';

const router = Router();

// All comment routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/incidents/:incidentId/comments
 * Returns comments for an incident.  VIEWERs see non-internal comments only
 * (the service layer filters based on user.role).
 */
router.get('/:incidentId/comments', commentController.list);

/**
 * POST /api/v1/incidents/:incidentId/comments
 * Adds a new comment.  VIEWER role cannot add comments.
 */
router.post(
  '/:incidentId/comments',
  requirePermission(PERMISSION.ADD_COMMENTS),
  validate(createCommentSchema),
  commentController.create,
);

/**
 * PATCH /api/v1/incidents/:incidentId/comments/:commentId
 * Updates a comment. Only the author or ADMIN can edit (enforced in service).
 */
router.patch(
  '/:incidentId/comments/:commentId',
  requirePermission(PERMISSION.EDIT_COMMENTS),
  validate(updateCommentSchema),
  commentController.update,
);

/**
 * DELETE /api/v1/incidents/:incidentId/comments/:commentId
 * Deletes a comment. Only the author or ADMIN can delete (enforced in service).
 */
router.delete(
  '/:incidentId/comments/:commentId',
  requirePermission(PERMISSION.DELETE_COMMENTS),
  commentController.remove,
);

export default router;
