/**
 * @file Health check route
 * @description Provides a liveness and readiness endpoint used by Docker
 * health checks, Kubernetes probes, and uptime monitors.
 *
 * GET /api/v1/health — Quick liveness check (no DB query)
 * GET /api/v1/health/ready — Readiness check (verifies DB + Redis connectivity)
 */

import { Router } from 'express';
import prisma from '../config/database.js';
import { redis } from '../config/redis.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = Router();

/**
 * GET /api/v1/health
 * Liveness check — returns 200 immediately if the process is alive.
 * Used by Docker to decide whether to restart the container.
 */
router.get('/', (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /api/v1/health/ready
 * Readiness check — verifies that PostgreSQL and Redis are reachable.
 * Returns 503 if either dependency is unavailable so the load balancer
 * stops routing traffic to this instance.
 */
router.get(
  '/ready',
  catchAsync(async (_req, res) => {
    const checks = { postgres: false, redis: false };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = true;
    } catch {
      // Individual check failure logged below; do not throw here
    }

    try {
      const pong = await redis.ping();
      checks.redis = pong === 'PONG';
    } catch {
      // Same — record failure and continue to return a structured response
    }

    const allHealthy = Object.values(checks).every(Boolean);

    if (!allHealthy) {
      return sendError(
        res,
        503,
        'SERVICE_UNAVAILABLE',
        'One or more dependencies are unavailable',
      );
    }

    sendSuccess(res, {
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  }),
);

export default router;
