/**
 * @file Attachment routes
 * @description File upload and download endpoints for incident attachments.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { upload } from '../config/multer.js';
import * as attachmentController from '../controllers/attachment.controller.js';

const router = Router();

router.use(authenticate);

/** GET /api/v1/incidents/:incidentId/attachments */
router.get('/:incidentId/attachments', attachmentController.list);

/**
 * POST /api/v1/incidents/:incidentId/attachments
 * Multer middleware validates MIME type and file size before the controller runs.
 */
router.post(
  '/:incidentId/attachments',
  upload.array('files', 5),
  attachmentController.upload,
);

/** DELETE /api/v1/incidents/:incidentId/attachments/:attachmentId */
router.delete('/:incidentId/attachments/:attachmentId', attachmentController.remove);

/** GET /api/v1/incidents/:incidentId/attachments/:attachmentId/download */
router.get(
  '/:incidentId/attachments/:attachmentId/download',
  attachmentController.download,
);

export default router;
