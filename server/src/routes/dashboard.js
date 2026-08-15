/**
 * @file Dashboard routes
 * @description Aggregated analytics endpoints powering the management dashboard.
 * These queries are cached in Redis to avoid expensive DB aggregations on every request.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeMinRole } from '../middleware/authorize.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.use(authenticate);

/** GET /api/v1/dashboard/stats — High-level KPI counters */
router.get('/stats', dashboardController.getStats);

/** GET /api/v1/dashboard/sla — SLA compliance metrics */
router.get('/sla', authorizeMinRole('MANAGER'), dashboardController.getSlaMetrics);

/** GET /api/v1/dashboard/workload — Engineer workload distribution */
router.get('/workload', authorizeMinRole('MANAGER'), dashboardController.getWorkload);

/** GET /api/v1/dashboard/trends — Incident volume over time */
router.get('/trends', dashboardController.getTrends);

export default router;
