/**
 * @file Auth routes
 * @description Registers authentication endpoints under /api/v1/auth.
 * Business logic is delegated to the auth service — this file is pure routing.
 */

import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import {
  loginSchema,
  registerSchema,
  refreshSchema,
} from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Creates a new user account. Applies the strict auth rate limiter to
 * prevent automated account creation floods.
 */
router.post('/register', authLimiter, validate(registerSchema), authController.register);

/**
 * POST /api/v1/auth/login
 * Validates credentials and issues JWT access + refresh tokens.
 */
router.post('/login', authLimiter, validate(loginSchema), authController.login);

/**
 * POST /api/v1/auth/refresh
 * Issues a new access token using the HttpOnly refresh token cookie.
 * No request body required — the cookie is read automatically.
 */
router.post('/refresh', authController.refresh);

/**
 * POST /api/v1/auth/logout
 * Revokes the refresh token and clears the cookie.
 */
router.post('/logout', authenticate, authController.logout);

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', authenticate, authController.me);

export default router;
