/**
 * @file Multer upload configuration
 * @description Configures Multer for handling multipart/form-data file uploads.
 * Enforces MIME type allowlist and per-file size limits before files ever reach
 * controller code, rejecting unsafe uploads at the middleware layer.
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { env } from './env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Allowed MIME types for file uploads.
 * This is the primary security boundary — never allow execution-capable types.
 */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Multer disk storage engine.
 * Files are stored in a per-incident subdirectory with a UUID-based filename
 * to prevent filename collisions and path traversal attacks.
 */
const storage = multer.diskStorage({
  /**
   * Determines the upload directory for a given request.
   * Creates the directory if it does not already exist.
   */
  destination(req, _file, cb) {
    // Use the incidentId from route params to organise uploads by incident
    const incidentId = req.params.incidentId || 'general';
    const uploadPath = path.join(env.UPLOAD_DIR, incidentId);

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  /**
   * Generates a safe, collision-resistant filename.
   * Preserves the original extension for downstream MIME sniffing.
   */
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${uuidv4()}${ext}`;
    cb(null, safeName);
  },
});

/**
 * MIME type filter — rejects files whose MIME type is not in the allowlist.
 * Operates on the MIME type reported by the client; actual file content
 * validation should be added for production hardening (e.g., file-type library).
 */
function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `File type '${file.mimetype}' is not allowed. Allowed types: images, PDF, plain text, CSV, Office documents.`,
        415,
        'UNSUPPORTED_MEDIA_TYPE',
      ),
      false,
    );
  }
}

/**
 * Configured Multer instance.
 * Max file size is read from the validated environment configuration.
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024, // Convert MB → bytes
    files: 5, // Maximum 5 files per request
  },
});
