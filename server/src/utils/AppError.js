/**
 * @file AppError — Operational error class
 * @description Custom error class for known, expected application errors
 * (e.g., 404 Not Found, 400 Validation Error, 403 Forbidden).
 *
 * The centralized error handler uses `isOperational` to distinguish these
 * from unexpected programmer errors. Operational errors are returned to the
 * client with a meaningful message; programmer errors result in a generic
 * 500 response to avoid leaking implementation details.
 */

/**
 * @class AppError
 * @extends Error
 *
 * @example
 * throw new AppError('Incident not found', 404, 'NOT_FOUND');
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description sent to the client
   * @param {number} statusCode - HTTP status code (e.g., 400, 401, 403, 404, 409)
   * @param {string} [code='INTERNAL_ERROR'] - Machine-readable error code for client logic
   * @param {Array} [details=[]] - Optional field-level validation details
   */
  constructor(message, statusCode, code = 'INTERNAL_ERROR', details = []) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Mark as an operational error so the error handler knows to surface it
    this.isOperational = true;

    // Capture a clean stack trace that excludes this constructor frame
    Error.captureStackTrace(this, this.constructor);
  }
}
