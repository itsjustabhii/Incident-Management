/**
 * @file Attachment controller
 * @description Handles file upload, listing, download, and deletion for
 * incident attachments. Multer middleware has already validated MIME type
 * and file size before these handlers execute.
 */

import path from 'path';
import fs from 'fs';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import * as attachmentService from '../services/attachment.service.js';

/** GET /api/v1/incidents/:incidentId/attachments */
export const list = catchAsync(async (req, res) => {
  const attachments = await attachmentService.listAttachments(req.params.incidentId);
  sendSuccess(res, { attachments });
});

/**
 * POST /api/v1/incidents/:incidentId/attachments
 * req.files is populated by Multer before this handler runs.
 */
export const upload = catchAsync(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('No files were uploaded', 400, 'NO_FILES');
  }
  const attachments = await attachmentService.createAttachments(
    req.params.incidentId,
    req.files,
    req.user,
  );
  sendSuccess(res, { attachments }, 201);
});

/** DELETE /api/v1/incidents/:incidentId/attachments/:attachmentId */
export const remove = catchAsync(async (req, res) => {
  await attachmentService.deleteAttachment(req.params.attachmentId, req.user);
  sendSuccess(res, { message: 'Attachment deleted' });
});

/**
 * GET /api/v1/incidents/:incidentId/attachments/:attachmentId/download
 * Streams the file directly from disk to the response.
 */
export const download = catchAsync(async (req, res) => {
  const attachment = await attachmentService.getAttachment(req.params.attachmentId, req.user);
  const filePath = path.resolve(attachment.storagePath);

  if (!fs.existsSync(filePath)) {
    throw new AppError('File not found on storage', 404, 'FILE_NOT_FOUND');
  }

  // Set headers to prompt the browser to download rather than attempt to render
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
  res.setHeader('Content-Type', attachment.mimeType);
  fs.createReadStream(filePath).pipe(res);
});
