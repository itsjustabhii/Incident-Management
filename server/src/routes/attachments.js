/**
 * @file Attachment routes
 * @description File upload and download endpoints for incident attachments.
 *
 * Authorization matrix:
 *   GET    /:incidentId/attachments                        — All authenticated users
 *   POST   /:incidentId/attachments                        — ADMIN, MANAGER, SUPPORT_ENGINEER (VIEWER blocked)
 *   DELETE /:incidentId/attachments/:attachmentId          — Uploader or ADMIN (enforced in service)
 *   GET    /:incidentId/attachments/:attachmentId/download — All authenticated users
 *
 * VIEWERs cannot upload or delete attachments — they are read-only.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { upload } from '../config/multer.js';
import * as attachmentController from '../controllers/attachment.controller.js';
import { PERMISSION } from '../constants/permissions.js';

const router = Router();

// All attachment routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/incidents/:incidentId/attachments
 * Returns the attachment list for an incident.
 * All authenticated roles can view attachment metadata.
 */
router.get('/:incidentId/attachments', attachmentController.list);

/**
 * POST /api/v1/incidents/:incidentId/attachments
 * Uploads one or more files.  Multer validates MIME type and file size.
 * VIEWER role cannot upload attachments.
 */
router.post(
  '/:incidentId/attachments',
  requirePermission(PERMISSION.UPLOAD_ATTACHMENTS),
  upload.array('files', 5),
  attachmentController.upload,
);

/**
 * DELETE /api/v1/incidents/:incidentId/attachments/:attachmentId
 * Deletes an attachment.  Uploader or ADMIN only (enforced in service layer).
 * VIEWER role cannot delete attachments.
 */
router.delete(
  '/:incidentId/attachments/:attachmentId',
  requirePermission(PERMISSION.DELETE_ATTACHMENTS),
  attachmentController.remove,
);

/**
 * GET /api/v1/incidents/:incidentId/attachments/:attachmentId/download
 * Downloads the attachment file.  All authenticated roles can download.
 */
router.get(
  '/:incidentId/attachments/:attachmentId/download',
  attachmentController.download,
);

export default router;
