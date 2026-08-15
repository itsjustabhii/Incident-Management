/**
 * @file Auth controller
 * @description Handles HTTP request/response for authentication endpoints.
 * Business logic (password hashing, token generation) lives in the auth service.
 */

import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';

/** Cookie options for the HttpOnly refresh token */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,         // Prevents XSS access to the token via document.cookie
  secure: env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict',     // CSRF protection — only send on same-site requests
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/api/v1/auth',   // Scope cookie to auth endpoints only
};

/**
 * POST /api/v1/auth/register
 * Creates a new user account and returns tokens.
 */
export const register = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  sendSuccess(res, { user, accessToken }, 201);
});

/**
 * POST /api/v1/auth/login
 * Validates credentials and returns JWT tokens.
 */
export const login = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  sendSuccess(res, { user, accessToken });
});

/**
 * POST /api/v1/auth/refresh
 * Issues a new access token from the HttpOnly refresh token cookie.
 * No request body needed — the cookie is read by cookieParser middleware.
 */
export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;
  const { accessToken } = await authService.refreshAccessToken(token);
  sendSuccess(res, { accessToken });
});

/**
 * POST /api/v1/auth/logout
 * Revokes the current refresh token and clears the cookie.
 */
export const logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;
  await authService.logout(req.user.id, token);
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  sendSuccess(res, { message: 'Logged out successfully' });
});

/**
 * GET /api/v1/auth/me
 * Returns the profile of the currently authenticated user.
 */
export const me = catchAsync(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  sendSuccess(res, { user });
});
