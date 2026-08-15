/**
 * @file Auth controller
 * @description Handles HTTP request/response for authentication endpoints.
 * Business logic (password hashing, token generation, rotation) lives in
 * the auth service — this layer only handles HTTP concerns.
 *
 * Security responsibilities of this layer:
 *   • Extracts User-Agent and IP for session tracking (audit trail).
 *   • Sets the refresh token in an HttpOnly, Secure, SameSite cookie so it
 *     is inaccessible to JavaScript (XSS protection).
 *   • Returns the new rotated refresh token cookie on every /refresh call.
 *   • Clears the cookie on logout so the browser cannot replay it.
 */

import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';

/**
 * Cookie options for the HttpOnly refresh token.
 *
 * httpOnly  — Prevents XSS: document.cookie cannot read this value.
 * secure    — Sent only over HTTPS in production; HTTP allowed in dev for localhost.
 * sameSite  — 'strict' prevents the cookie from being sent on cross-site requests,
 *             providing CSRF protection for state-mutating auth endpoints.
 * path      — Scoped to /api/v1/auth only; the cookie is not sent on any other API
 *             request, reducing the exposure window.
 * maxAge    — Must match the refresh token DB/JWT TTL (7 days).
 */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/api/v1/auth',
};

/**
 * Extracts the client IP address from the request.
 * When running behind a proxy (nginx, load balancer), Express populates
 * req.ip from X-Forwarded-For because trust proxy is set to 1 in app.js.
 *
 * @param {import('express').Request} req
 * @returns {string|undefined}
 */
function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress;
}

/**
 * POST /api/v1/auth/register
 * Creates a new user account, issues tokens, and sets the refresh cookie.
 */
export const register = catchAsync(async (req, res) => {
  // Pass User-Agent and IP for session record and audit trail
  const { user, accessToken, refreshToken } = await authService.register(
    req.body,
    req.headers['user-agent'],
    getClientIp(req),
  );
  // Set the refresh token as an HttpOnly cookie so JS cannot access it
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  sendSuccess(res, { user, accessToken }, 201);
});

/**
 * POST /api/v1/auth/login
 * Validates credentials and issues JWT access + refresh tokens.
 * The refresh token is returned as an HttpOnly cookie only.
 */
export const login = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(
    req.body,
    req.headers['user-agent'],
    getClientIp(req),
  );
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  sendSuccess(res, { user, accessToken });
});

/**
 * POST /api/v1/auth/refresh
 * Issues a new access token AND rotates the refresh token.
 * The old cookie is replaced with the new rotated token.
 * No request body is needed — the refresh token is read from the HttpOnly cookie.
 */
export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;
  // refreshAccessToken performs rotation: old token is revoked, new one is issued
  const { accessToken, refreshToken: newRefreshToken } = await authService.refreshAccessToken(
    token,
    req.headers['user-agent'],
    getClientIp(req),
  );
  // Replace the cookie with the newly rotated refresh token
  res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
  sendSuccess(res, { accessToken });
});

/**
 * POST /api/v1/auth/logout
 * Revokes the current refresh token, deactivates the session, and clears the cookie.
 * Requires authentication so we know which user is logging out.
 */
export const logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;
  await authService.logout(req.user.id, token);
  // Clear the cookie — path must match exactly to ensure the browser removes it
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

/**
 * POST /api/v1/auth/change-password
 * Changes the authenticated user's password and revokes all existing sessions.
 * Requires the current password to prevent session-fixation account takeover.
 */
export const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  // Clear the refresh token cookie — user must log in again on all devices
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  sendSuccess(res, { message: 'Password changed successfully — please log in again' });
});

/**
 * GET /api/v1/auth/sessions
 * Returns all active sessions for the current user (security settings page).
 */
export const getSessions = catchAsync(async (req, res) => {
  const sessions = await authService.getActiveSessions(req.user.id);
  sendSuccess(res, { sessions });
});

/**
 * DELETE /api/v1/auth/sessions/:sessionId
 * Revokes a specific session by ID. Only the owning user can revoke their sessions.
 */
export const revokeSession = catchAsync(async (req, res) => {
  await authService.revokeSession(req.params.sessionId, req.user.id);
  sendSuccess(res, { message: 'Session revoked successfully' });
});
