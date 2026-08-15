/**
 * @file Authentication middleware
 * @description Verifies the JWT access token present in the Authorization header.
 * On success, attaches the decoded and DB-validated user payload to req.user so
 * downstream middleware and controllers can access the authenticated user's identity.
 *
 * Security design:
 *   • The role embedded in the JWT is the authoritative source — it is set at
 *     login time by the server and is NEVER overridden by client-supplied values.
 *   • The DB check on the hot-path ensures deactivated users cannot continue
 *     using valid tokens after their account is disabled, at the cost of one
 *     extra DB round-trip per request.  If this becomes a bottleneck, replace
 *     with a Redis-cached user record (TTL = access token lifetime).
 *   • Expired access tokens receive a specific error code (TOKEN_EXPIRED) so the
 *     client can silently refresh rather than showing a generic error.
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import prisma from '../config/database.js';

/**
 * Express middleware that enforces JWT authentication.
 * Rejects requests without a valid Bearer token with 401 Unauthorized.
 *
 * Flow:
 *   1. Extract Bearer token from Authorization header.
 *   2. Verify JWT signature and expiry.
 *   3. Confirm user still exists and is active in the database.
 *   4. Attach verified user payload to req.user.
 */
export const authenticate = catchAsync(async (req, _res, next) => {
  // Step 1: Extract token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required — no token provided', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix (7 characters)

  // Step 2: Verify signature and expiry using the server's secret
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // Distinguish expiry from invalid signature so the client can auto-refresh
      throw new AppError(
        'Access token has expired — please refresh your session',
        401,
        'TOKEN_EXPIRED',
      );
    }
    // All other JWT errors (tampered signature, malformed token) → 401
    throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
  }

  // Step 3: DB check — confirm the user still exists and is active.
  // This catches the case where an admin deactivated the user after they logged in.
  // Without this check, a deactivated user could continue making requests until
  // their 15-minute access token expires.
  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, email: true, role: true, active: true },
  });

  if (!user) {
    throw new AppError('User account not found', 401, 'UNAUTHORIZED');
  }

  if (!user.active) {
    // User was active when the token was issued but has since been deactivated
    throw new AppError(
      'Your account has been deactivated — contact an administrator',
      403,
      'ACCOUNT_DISABLED',
    );
  }

  // Step 4: Attach the verified user to the request.
  // Use the DB-sourced role rather than the JWT role to ensure any role changes
  // take effect immediately on the next request (not at next token refresh).
  req.user = {
    id: user.id,
    email: user.email,
    role: user.role, // Always from DB — never from the client-supplied JWT claim
  };

  next();
});

/**
 * Optional authentication middleware — attaches req.user if a valid token is
 * present, but does NOT reject the request if no token is provided.
 * Useful for endpoints that have both public and authenticated views.
 *
 * Note: This does NOT perform the DB active-user check for performance reasons.
 * Do not use on routes that modify data or return sensitive information.
 */
export const authenticateOptional = catchAsync(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    // Lightweight: only attach from JWT, no DB round-trip for optional auth
    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
  } catch {
    // Silently ignore invalid or expired tokens on optional auth routes
  }
  next();
});
