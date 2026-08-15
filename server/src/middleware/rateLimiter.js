/**
 * @file Rate limiting middleware
 * @description Configures express-rate-limit to protect the API from brute-force
 * attacks and excessive traffic. The auth endpoints have a stricter limit than
 * general API endpoints because they are the primary target for credential
 * stuffing attacks.
 */

import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';

/**
 * Creates a rate limiter with a standard handler that uses the app's error
 * envelope format instead of the default text response.
 *
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum requests per window per IP
 * @param {string} message - Human-readable message shown when limit is hit
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
function createLimiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Send RateLimit-* headers per RFC 6585
    legacyHeaders: false,
    handler(req, res) {
      sendError(res, 429, 'RATE_LIMIT_EXCEEDED', message);
    },
    // Use the IP as the key; in production behind a proxy, trust the X-Forwarded-For header
    keyGenerator: (req) => req.ip,
  });
}

/**
 * General API rate limiter — applied to all /api/v1/* routes.
 * Generous enough for normal use but prevents large-scale scraping.
 */
export const apiLimiter = createLimiter(
  env.RATE_LIMIT_WINDOW_MS,
  env.RATE_LIMIT_MAX_REQUESTS,
  'Too many requests — please try again later',
);

/**
 * Strict authentication rate limiter — applied only to /auth/login and /auth/register.
 * Limits to 10 attempts per 15 minutes to slow credential stuffing attacks.
 */
export const authLimiter = createLimiter(
  15 * 60 * 1000, // 15-minute window
  10,
  'Too many authentication attempts — please wait 15 minutes before trying again',
);
