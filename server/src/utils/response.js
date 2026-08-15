/**
 * @file API response helpers
 * @description Standardizes the JSON envelope returned by all API endpoints.
 * Using a consistent shape lets the frontend RTK Query base query reliably
 * extract data, metadata, and errors without per-endpoint parsing logic.
 */

/**
 * Sends a successful JSON response with a standard envelope.
 *
 * @param {import('express').Response} res - Express response object
 * @param {*} data - The primary payload to send
 * @param {number} [statusCode=200] - HTTP status code
 * @param {object} [meta={}] - Optional metadata (pagination, etc.)
 */
export function sendSuccess(res, data, statusCode = 200, meta = {}) {
  const body = { success: true, data };
  if (Object.keys(meta).length > 0) {
    body.meta = meta;
  }
  res.status(statusCode).json(body);
}

/**
 * Sends an error JSON response with a standard envelope.
 * This is used by the centralized error handler and should not be called
 * directly from controllers — throw an AppError instead.
 *
 * @param {import('express').Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Machine-readable error code
 * @param {string} message - Human-readable error message
 * @param {Array} [details=[]] - Optional field-level error details
 */
export function sendError(res, statusCode, code, message, details = []) {
  const body = {
    success: false,
    error: { code, message },
  };
  if (details.length > 0) {
    body.error.details = details;
  }
  res.status(statusCode).json(body);
}
