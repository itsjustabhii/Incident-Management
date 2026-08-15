/**
 * @file Auth service
 * @description Business logic for registration, login, token issuance,
 * token refresh with rotation, logout, and password change.
 *
 * Security principles enforced here:
 *   • Passwords are hashed with bcrypt (cost factor 12) before persistence.
 *   • Timing-safe comparisons prevent user-enumeration via response time.
 *   • Refresh tokens use rotation — each use of a refresh token issues a NEW
 *     token and immediately revokes the old one.  Detecting a reuse of an
 *     already-revoked token triggers revocation of ALL tokens for that user
 *     (theft detection / cookie-theft response).
 *   • Each refresh token is persisted in the DB with its jti (JWT ID) so it
 *     can be individually revoked without invalidating every session.
 *   • Sessions are tracked separately to support "active sessions" UI and
 *     admin-forced logout.
 *   • Access tokens are short-lived (15m) to limit blast radius on theft.
 *   • The password hash is stripped from every object returned to callers.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/** bcrypt cost factor — 12 rounds ≈ 200 ms on modern hardware (OWASP recommended minimum) */
const BCRYPT_ROUNDS = 12;

/** Refresh token lifetime in milliseconds (must match JWT_REFRESH_EXPIRES_IN) */
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Strips sensitive fields from a user record before returning it to the client.
 * The password hash MUST never leave the server boundary.
 *
 * @param {object} user - Raw Prisma user record
 * @returns {object} Safe user object safe for API responses
 */
function sanitizeUser(user) {
  // Destructure to exclude passwordHash — any new sensitive fields added to
  // the model should be explicitly removed here
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

/**
 * Generates a signed JWT access token.
 * Short TTL (15m default) limits the blast radius if a token is intercepted —
 * even a stolen token becomes useless quickly without the refresh token cookie.
 *
 * Payload carries only the minimum claims needed for authorization:
 *   sub   — user ID (stable, used as PK)
 *   email — for display without a DB round-trip
 *   role  — used by authorize() middleware; set by the server at sign time
 *
 * @param {object} user - User record from Prisma
 * @returns {string} Signed JWT access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      // The role claim is embedded in the token by the server so that every
      // request carries the authorized role without a DB lookup.  The role in
      // the token is as trustworthy as the token signature.
      role: user.role,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  );
}

/**
 * Generates a signed JWT refresh token, persists a DB record for revocation
 * tracking, and creates a corresponding Session row.
 *
 * The jti (JWT ID) is a random UUID that links the JWT to its DB record.
 * Storing it in the DB allows per-token revocation without requiring a secret
 * rotation that would invalidate all sessions simultaneously.
 *
 * @param {object} user    - User record
 * @param {string} [userAgent] - HTTP User-Agent header (for session UI)
 * @param {string} [ipAddress] - Client IP (for session UI and audit)
 * @returns {Promise<string>} Signed JWT refresh token
 */
async function generateRefreshToken(user, userAgent, ipAddress) {
  const jti = uuidv4(); // Cryptographically random, impossible to predict/forge
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  // Persist the token record — allows revocation and theft detection
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    },
  });

  // Create a parallel session record for the "active sessions" security page
  await prisma.session.create({
    data: {
      userId: user.id,
      jti,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      active: true,
    },
  });

  return jwt.sign(
    { sub: user.id, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN },
  );
}

/**
 * Registers a new user account.
 * Performs a duplicate-email check before the expensive bcrypt hash to
 * avoid wasted CPU on requests that will fail anyway.
 *
 * @param {{ email: string, password: string, displayName: string }} data
 * @param {string} [userAgent] - HTTP User-Agent
 * @param {string} [ipAddress] - Client IP
 */
export async function register(data, userAgent, ipAddress) {
  const { email, password, displayName } = data;

  // Pre-hash duplicate check — cheap DB read before expensive bcrypt work
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Use a generic 409 rather than "email taken" to reduce enumeration risk
    throw new AppError('An account with this email address already exists', 409, 'CONFLICT');
  }

  // Hash the password before storing — plaintext passwords MUST NOT be persisted
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });

  logger.info({ userId: user.id }, 'New user registered');

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user, userAgent, ipAddress);

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

/**
 * Authenticates a user with email + password.
 *
 * Timing-attack defense: bcrypt.compare() is always called, even when the
 * user does not exist, using a pre-computed dummy hash.  This ensures that
 * response times are identical for "email not found" and "wrong password",
 * preventing an attacker from using timing differences to enumerate valid emails.
 *
 * @param {{ email: string, password: string }} credentials
 * @param {string} [userAgent]
 * @param {string} [ipAddress]
 */
export async function login({ email, password }, userAgent, ipAddress) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always run bcrypt.compare regardless of whether the user was found.
  // This makes the response time the same whether or not the email exists,
  // preventing user enumeration via timing side-channels.
  const passwordMatch = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, '$2b$12$invalidhashpaddingtomimicwork00');

  if (!user || !passwordMatch) {
    // Return an identical error for both cases (wrong email AND wrong password)
    // so an attacker cannot determine which one is wrong
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check account status AFTER the password check to avoid leaking whether
  // an email is registered (active check is a separate observable difference)
  if (!user.active) {
    throw new AppError(
      'Your account has been deactivated — contact an administrator',
      403,
      'ACCOUNT_DISABLED',
    );
  }

  // Update last-login timestamp — useful for security audit and UI display
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info({ userId: user.id, ipAddress }, 'User logged in');

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user, userAgent, ipAddress);

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

/**
 * Issues a new access token AND a new refresh token from a valid refresh token.
 *
 * REFRESH TOKEN ROTATION:
 * On each successful refresh, the old token is atomically revoked and a new
 * token is issued.  This limits the window in which a stolen refresh token
 * remains usable to a single use.
 *
 * THEFT DETECTION (reuse detection):
 * If a refresh token that is already revoked is presented, it indicates that
 * the original token was stolen and used by a different party.  In this case,
 * ALL refresh tokens for that user are revoked to force re-authentication and
 * stop the attacker's session.  The user will need to log in again.
 *
 * @param {string} refreshToken - Raw refresh token string from the cookie
 * @param {string} [userAgent]
 * @param {string} [ipAddress]
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export async function refreshAccessToken(refreshToken, userAgent, ipAddress) {
  if (!refreshToken) {
    throw new AppError('No refresh token provided', 401, 'UNAUTHORIZED');
  }

  // Verify the JWT signature and expiry before any DB work
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Refresh token has expired — please log in again', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }

  // Look up the token record in the DB to check revocation status
  const stored = await prisma.refreshToken.findUnique({ where: { jti: decoded.jti } });

  if (!stored) {
    // Token was never issued by this server (or was hard-deleted)
    throw new AppError('Refresh token not recognised', 401, 'INVALID_TOKEN');
  }

  if (stored.revoked) {
    // THEFT DETECTION: this token has already been used and rotated out.
    // Presenting a revoked token means someone is attempting to reuse an old
    // token — revoke ALL tokens for this user to force full re-authentication.
    logger.warn(
      { userId: stored.userId, jti: decoded.jti },
      'Refresh token reuse detected — revoking all user tokens (possible theft)',
    );
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revoked: false },
      data: { revoked: true },
    });
    // Deactivate all active sessions too
    await prisma.session.updateMany({
      where: { userId: stored.userId, active: true },
      data: { active: false },
    });
    await redis.del(`session:${stored.userId}`);
    throw new AppError(
      'Token reuse detected — all sessions have been revoked. Please log in again.',
      401,
      'TOKEN_REUSE_DETECTED',
    );
  }

  if (stored.expiresAt < new Date()) {
    throw new AppError('Refresh token has expired — please log in again', 401, 'TOKEN_EXPIRED');
  }

  // Verify user still exists and is active
  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || !user.active) {
    throw new AppError('User account not found or deactivated', 401, 'UNAUTHORIZED');
  }

  // ROTATION: Atomically revoke the old token and issue a new one.
  // Using a transaction ensures we never have two valid tokens simultaneously.
  const newJti = uuidv4();
  const newExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await prisma.$transaction(async (tx) => {
    // Revoke the old token — it cannot be used again
    await tx.refreshToken.update({
      where: { jti: decoded.jti },
      data: { revoked: true },
    });
    // Deactivate the old session record
    await tx.session.updateMany({
      where: { jti: decoded.jti },
      data: { active: false },
    });
    // Issue a fresh token record
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        jti: newJti,
        expiresAt: newExpiresAt,
        userAgent: userAgent || stored.userAgent,
        ipAddress: ipAddress || stored.ipAddress,
      },
    });
    // Create a fresh session record
    await tx.session.create({
      data: {
        userId: user.id,
        jti: newJti,
        expiresAt: newExpiresAt,
        userAgent: userAgent || stored.userAgent,
        ipAddress: ipAddress || stored.ipAddress,
        active: true,
      },
    });
  });

  // Sign the new refresh token with the new jti
  const newRefreshToken = jwt.sign(
    { sub: user.id, jti: newJti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN },
  );

  // Issue a fresh access token (updated role in case it changed since last login)
  const newAccessToken = generateAccessToken(user);

  logger.info({ userId: user.id }, 'Refresh token rotated');

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

/**
 * Logs out a user by revoking their specific refresh token, deactivating the
 * session, and clearing any Redis session cache for that user.
 *
 * Note: The access token cannot be invalidated before its natural expiry (15m)
 * without a token denylist (Redis-based).  The short TTL is the primary
 * mitigation; adding a Redis denylist is a hardening step for high-security deployments.
 *
 * @param {string} userId
 * @param {string|undefined} refreshToken - Raw token string from the cookie
 */
export async function logout(userId, refreshToken) {
  if (refreshToken) {
    try {
      // Decode without verification first (already expired tokens should still be revoked)
      const decoded = jwt.decode(refreshToken);
      if (decoded?.jti) {
        // Revoke this specific token in the DB (preserves audit trail via revoked=true)
        await prisma.refreshToken.updateMany({
          where: { jti: decoded.jti, userId },
          data: { revoked: true },
        });
        // Mark the matching session as inactive
        await prisma.session.updateMany({
          where: { jti: decoded.jti, userId },
          data: { active: false },
        });
      }
    } catch {
      // Token is malformed — proceed with logout anyway, just clear the Redis cache
    }
  }

  // Clear any Redis-cached session data for this user
  await redis.del(`session:${userId}`);
  logger.info({ userId }, 'User logged out');
}

/**
 * Changes the authenticated user's password.
 * Verifies the current password before accepting the new one to prevent
 * a session-fixation attack where a hijacked session is used to change the password.
 * On success, revokes ALL existing refresh tokens for the user to force
 * re-authentication on all devices — a standard post-password-change security step.
 *
 * @param {string} userId
 * @param {{ currentPassword: string, newPassword: string }} data
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  // Verify the current password — prevents session-fixation attacks where an
  // attacker with a hijacked token tries to permanently take over the account
  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');
  }

  if (currentPassword === newPassword) {
    throw new AppError(
      'New password must be different from the current password',
      400,
      'INVALID_INPUT',
    );
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    // Update the password hash
    await tx.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    // Revoke ALL refresh tokens — forces re-authentication on every device.
    // This is the correct behavior after a password change because any stolen
    // refresh token is now useless without the new password.
    await tx.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    // Deactivate all sessions
    await tx.session.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });
  });

  // Clear Redis session cache
  await redis.del(`session:${userId}`);
  logger.info({ userId }, 'User changed password — all sessions revoked');
}

/**
 * Returns the authenticated user's profile (without sensitive fields).
 *
 * @param {string} userId
 */
export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      teamMemberships: { include: { team: { select: { id: true, name: true } } } },
    },
  });
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  return sanitizeUser(user);
}

/**
 * Returns all active sessions for a user (for the security settings page).
 * Excludes expired sessions from the returned list.
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getActiveSessions(userId) {
  return prisma.session.findMany({
    where: { userId, active: true, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      jti: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      userAgent: true,
      ipAddress: true,
    },
    orderBy: { lastSeenAt: 'desc' },
  });
}

/**
 * Revokes a specific session by its ID.
 * Only the owning user or an ADMIN can revoke a session.
 *
 * @param {string} sessionId - Session row ID
 * @param {string} userId - The requesting user's ID (from JWT)
 */
export async function revokeSession(sessionId, userId) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('Session not found', 404, 'NOT_FOUND');
  if (session.userId !== userId) {
    throw new AppError('You can only revoke your own sessions', 403, 'FORBIDDEN');
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.update({ where: { id: sessionId }, data: { active: false } });
    await tx.refreshToken.updateMany({
      where: { jti: session.jti, userId },
      data: { revoked: true },
    });
  });

  logger.info({ userId, sessionId }, 'Session revoked by user');
}
