/**
 * @file Request validation middleware factory
 * @description Creates Express middleware that validates incoming requests
 * against a Zod schema. Throws a ZodError (which the centralized error handler
 * converts to a 400 response) on validation failure.
 *
 * Separating validation into middleware keeps controllers free of validation
 * boilerplate and ensures validators are consistently applied.
 */

import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * Creates middleware that validates a specific part of the request against
 * the provided Zod schema.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} [target='body'] - Request part to validate
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/incidents', authenticate, validate(createIncidentSchema), controller.create);
 */
export const validate = (schema, target = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      // Pass the ZodError directly — the errorHandler middleware formats it
      return next(result.error);
    }
    // Replace the raw input with the parsed, type-safe data
    req[target] = result.data;
    next();
  };
