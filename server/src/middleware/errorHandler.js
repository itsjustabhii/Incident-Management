/**
 * @file Centralized error handling middleware
 * @description The final Express error handler. Every error thrown or passed
 * to next(err) anywhere in the application ends up here.
 *
 * Operational errors (AppError instances) are surfaced to the client with
 * their status code and message. Unexpected programmer errors result in a
 * generic 500 response to avoid leaking internal implementation details.
 */

import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';
import { env } from '../config/env.js';

/**
 * Converts a Zod validation error into a standardized array of field-level
 * error details for inclusion in the API error envelope.
 *
 * @param {ZodError} zodError - The Zod validation error
 * @returns {Array<{field: string, message: string}>}
 */
function formatZodErrors(zodError) {
  return zodError.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

/**
 * Global Express error handler.
 * Must be registered LAST in the middleware chain (after all routes).
 *
 * @param {Error} err - The error that was thrown or passed to next()
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next - Required by Express signature even if unused
 */
export function errorHandler(err, req, res, _next) {
  // Handle Zod validation errors from request validators
  if (err instanceof ZodError) {
    const details = formatZodErrors(err);
    logger.warn({ path: req.path, details }, 'Request validation failed');
    return sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed', details);
  }

  // Handle known operational errors (thrown via AppError)
  if (err.isOperational) {
    logger.warn({ code: err.code, path: req.path, message: err.message }, 'Operational error');
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // Handle Prisma unique constraint violations (e.g., duplicate email)
  if (err.code === 'P2002') {
    const fields = err.meta?.target?.join(', ') || 'field';
    return sendError(res, 409, 'CONFLICT', `A record with this ${fields} already exists`);
  }

  // Handle Prisma record not found errors
  if (err.code === 'P2025') {
    return sendError(res, 404, 'NOT_FOUND', 'The requested record was not found');
  }

  // Unknown / unexpected errors — log full details server-side but send generic message
  logger.error({ err, path: req.path, method: req.method }, 'Unexpected error');

  // In development, include the stack trace in the response for easier debugging
  const message =
    env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred';

  const response = sendError(res, 500, 'INTERNAL_ERROR', message);

  if (env.NODE_ENV === 'development') {
    res.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message, stack: err.stack },
    });
    return;
  }

  return response;
}

/**
 * 404 handler — catches requests that did not match any route.
 * Registered after all route definitions.
 */
export function notFoundHandler(req, res) {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
}
