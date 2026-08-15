/**
 * @file Comment routes
 * @description Endpoints for comment threads on incidents.
 * Mounted under /api/v1/incidents so the URL is /incidents/:incidentId/comments
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import {
  createCommentSchema,
  updateCommentSchema,
} from '../validators/comment.validator.js';
import * as commentController from '../controllers/comment.controller.js';

const router = Router();

router.use(authenticate);

/** GET /api/v1/incidents/:incidentId/comments */
router.get('/:incidentId/comments', commentController.list);

/** POST /api/v1/incidents/:incidentId/comments */
router.post('/:incidentId/comments', validate(createCommentSchema), commentController.create);

/** PATCH /api/v1/incidents/:incidentId/comments/:commentId */
router.patch(
  '/:incidentId/comments/:commentId',
  validate(updateCommentSchema),
  commentController.update,
);

/** DELETE /api/v1/incidents/:incidentId/comments/:commentId */
router.delete('/:incidentId/comments/:commentId', commentController.remove);

export default router;
