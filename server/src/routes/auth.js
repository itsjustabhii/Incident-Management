/**
 * @file Auth routes
 * @description Registers authentication endpoints under /api/v1/auth.
 * Business logic is delegated to the auth service — this file is pure routing.
 *
 * Rate limiting strategy:
 *   • /login and /register use the strict authLimiter (10 req / 15 min)
 *     to slow credential-stuffing and account-creation floods.
 *   • /refresh does NOT use the auth limiter — legitimate users may refresh
 *     frequently and blocking refreshes degrades UX without security benefit.
 *     The general API rate limiter still applies via app.js.
 */

import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
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
 * The refresh token is set in an HttpOnly cookie — not returned in the body.
 */
router.post('/login', authLimiter, validate(loginSchema), authController.login);

/**
 * POST /api/v1/auth/refresh
 * Issues a new access token AND a new rotated refresh token using the
 * HttpOnly cookie.  No request body required.
 */
router.post('/refresh', authController.refresh);

/**
 * POST /api/v1/auth/logout
 * Revokes the refresh token, deactivates the session, and clears the cookie.
 * Requires a valid access token so we know who is logging out.
 */
router.post('/logout', authenticate, authController.logout);

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', authenticate, authController.me);

/**
 * POST /api/v1/auth/change-password
 * Changes the user's password.  Requires the current password.
 * All existing sessions are revoked on success.
 */
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

/**
 * GET /api/v1/auth/sessions
 * Returns all active sessions for the current user (security page).
 */
router.get('/sessions', authenticate, authController.getSessions);

/**
 * DELETE /api/v1/auth/sessions/:sessionId
 * Revokes a specific session (remote logout from another device).
 */
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);

export default router;
