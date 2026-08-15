/**
 * @file Dashboard controller
 * @description Aggregated analytics for the management dashboard.
 * Results are cached in Redis to prevent expensive DB aggregations on every request.
 */

import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import * as dashboardService from '../services/dashboard.service.js';

/** GET /api/v1/dashboard/stats — High-level KPI counters */
export const getStats = catchAsync(async (req, res) => {
  const stats = await dashboardService.getStats(req.user);
  sendSuccess(res, stats);
});

/** GET /api/v1/dashboard/sla — SLA compliance metrics */
export const getSlaMetrics = catchAsync(async (req, res) => {
  const metrics = await dashboardService.getSlaMetrics();
  sendSuccess(res, metrics);
});

/** GET /api/v1/dashboard/workload — Per-engineer open incident counts */
export const getWorkload = catchAsync(async (req, res) => {
  const workload = await dashboardService.getWorkload();
  sendSuccess(res, workload);
});

/** GET /api/v1/dashboard/trends — Incident volume by day for the last 30 days */
export const getTrends = catchAsync(async (req, res) => {
  const trends = await dashboardService.getTrends();
  sendSuccess(res, trends);
});
