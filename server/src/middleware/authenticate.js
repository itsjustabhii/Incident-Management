/**
 * @file Authentication middleware
 * @description Verifies the JWT access token present in the Authorization header.
 * On success, attaches the decoded user payload to req.user so downstream
 * middleware and controllers can access the authenticated user's identity.
 *
 * The role embedded in the JWT is the authoritative source — it is set at
 * login time by the server and is NEVER overridden by client-supplied values.
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

/**
 * Express middleware that enforces JWT authentication.
 * Rejects requests without a valid Bearer token with 401 Unauthorized.
 */
export const authenticate = catchAsync(async (req, _res, next) => {
  // Extract the Bearer token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required — no token provided', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired — please refresh your session', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
  }

  // Attach the verified user payload to the request object for downstream use
  // The 'role' field here comes from the signed JWT, not from the client
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role,
  };

  next();
});

/**
 * Optional authentication middleware — attaches req.user if a valid token
 * is present, but does not reject the request if no token is provided.
 * Useful for endpoints that have both public and authenticated views.
 */
export const authenticateOptional = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
  } catch {
    // Silently ignore invalid tokens on optional auth routes
  }
  next();
};
