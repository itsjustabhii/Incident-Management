/**
 * @file Dashboard routes
 * @description Aggregated analytics endpoints powering the management dashboard.
 * These queries are cached in Redis to avoid expensive DB aggregations on every request.
 *
 * Authorization matrix:
 *   GET /stats     — All authenticated users (VIEWER gets limited view)
 *   GET /sla       — ADMIN, MANAGER (SLA compliance is management-level data)
 *   GET /workload  — ADMIN, MANAGER (workload distribution is management-level data)
 *   GET /trends    — All authenticated users
 *
 * VIEWERs are explicitly blocked from sensitive management-only metrics.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission, authorizeMinRole } from '../middleware/authorize.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { PERMISSION } from '../constants/permissions.js';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/dashboard/stats
 * High-level KPI counters (open incidents, breached SLAs, etc.)
 * All authenticated roles can access the basic stats view.
 */
router.get(
  '/stats',
  requirePermission(PERMISSION.VIEW_DASHBOARD),
  dashboardController.getStats,
);

/**
 * GET /api/v1/dashboard/sla
 * SLA compliance metrics.  Management-level data — MANAGER and above only.
 */
router.get(
  '/sla',
  requirePermission(PERMISSION.VIEW_SLA_METRICS),
  dashboardController.getSlaMetrics,
);

/**
 * GET /api/v1/dashboard/workload
 * Engineer workload distribution.  Management-level data — MANAGER and above only.
 */
router.get(
  '/workload',
  requirePermission(PERMISSION.VIEW_WORKLOAD),
  dashboardController.getWorkload,
);

/**
 * GET /api/v1/dashboard/trends
 * Incident volume over time.  Available to all authenticated users.
 */
router.get(
  '/trends',
  requirePermission(PERMISSION.VIEW_DASHBOARD),
  dashboardController.getTrends,
);

export default router;
