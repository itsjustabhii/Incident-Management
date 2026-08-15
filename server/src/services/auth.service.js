/**
 * @file Auth service
 * @description Business logic for registration, login, token issuance,
 * token refresh, and logout. This layer has no knowledge of HTTP — it
 * returns plain objects or throws AppErrors.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/** Bcrypt work factor — 12 is a good balance of security vs. latency (~200ms) */
const BCRYPT_ROUNDS = 12;

/**
 * Strips sensitive fields from a user record before returning it to the client.
 * The password hash must never leave the server.
 *
 * @param {object} user - Raw Prisma user record
 * @returns {object} Safe user object for API responses
 */
function sanitizeUser(user) {
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

/**
 * Generates a signed JWT access token.
 * Short TTL (15m) limits the blast radius if a token is intercepted.
 *
 * @param {object} user - User record
 * @returns {string} Signed JWT access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  );
}

/**
 * Generates a signed JWT refresh token and persists it in the database.
 * The jti (JWT ID) is stored so individual tokens can be revoked without
 * invalidating all sessions for the user.
 *
 * @param {object} user - User record
 * @returns {Promise<string>} Signed JWT refresh token
 */
async function generateRefreshToken(user) {
  const jti = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId: user.id, jti, expiresAt },
  });

  return jwt.sign(
    { sub: user.id, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN },
  );
}

/**
 * Registers a new user account.
 * @param {{ email, password, displayName }} data
 */
export async function register(data) {
  const { email, password, displayName } = data;

  // Check for existing account before hashing — cheap DB read avoids wasted bcrypt work
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('An account with this email address already exists', 409, 'CONFLICT');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });

  logger.info({ userId: user.id }, 'New user registered');

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user);

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

/**
 * Authenticates a user with email + password.
 * Uses bcrypt.compare — always runs even when email is not found to prevent
 * timing-based user enumeration attacks.
 *
 * @param {{ email, password }} credentials
 */
export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Use a constant-time comparison regardless of whether the user exists
  // to prevent leaking whether an email is registered
  const passwordMatch = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, '$2b$12$invalidhashpaddingtomimicwork');

  if (!user || !passwordMatch) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.active) {
    throw new AppError('Your account has been deactivated — contact an administrator', 403, 'ACCOUNT_DISABLED');
  }

  logger.info({ userId: user.id }, 'User logged in');

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user);

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

/**
 * Issues a new access token from a valid refresh token.
 * Verifies the token's jti against the database to support token revocation.
 *
 * @param {string} refreshToken - The raw refresh token string from the cookie
 */
export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new AppError('No refresh token provided', 401, 'UNAUTHORIZED');
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_TOKEN');
  }

  // Look up the token in the DB to verify it hasn't been revoked
  const stored = await prisma.refreshToken.findUnique({ where: { jti: decoded.jti } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new AppError('Refresh token has been revoked or expired', 401, 'TOKEN_REVOKED');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || !user.active) {
    throw new AppError('User not found or deactivated', 401, 'UNAUTHORIZED');
  }

  const accessToken = generateAccessToken(user);
  return { accessToken };
}

/**
 * Logs out a user by revoking their refresh token and clearing any Redis session data.
 *
 * @param {string} userId
 * @param {string|undefined} refreshToken - The raw token string from the cookie
 */
export async function logout(userId, refreshToken) {
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
      // Mark the token as revoked instead of deleting to preserve audit trail
      await prisma.refreshToken.updateMany({
        where: { jti: decoded.jti, userId },
        data: { revoked: true },
      });
    } catch {
      // Token is already invalid — proceed with logout regardless
    }
  }
  // Clear any cached session data for this user
  await redis.del(`session:${userId}`);
  logger.info({ userId }, 'User logged out');
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
