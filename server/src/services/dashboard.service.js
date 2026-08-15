/**
 * @file Dashboard service
 * @description Aggregated queries for the dashboard KPI cards, SLA metrics,
 * workload distribution, and trend charts. Results are cached in Redis
 * for 60 seconds to avoid running expensive aggregations on every page load.
 */

import prisma from '../config/database.js';
import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

const CACHE_TTL = 60; // seconds

/**
 * Generic cache-aside helper. Tries to return the cached value; on miss,
 * runs the provided loader function, caches the result, and returns it.
 *
 * @param {string} key - Redis cache key
 * @param {Function} loader - Async function that computes the value on cache miss
 * @param {number} [ttl=CACHE_TTL] - Cache TTL in seconds
 * @returns {Promise<*>} The cached or freshly computed value
 */
async function cacheAside(key, loader, ttl = CACHE_TTL) {
  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.debug({ key }, 'Dashboard cache hit');
      return JSON.parse(cached);
    }
  } catch {
    // Redis unavailable — fall through to DB query gracefully
    logger.warn({ key }, 'Redis unavailable — fetching dashboard data from DB');
  }

  const result = await loader();

  try {
    await redis.set(key, JSON.stringify(result), 'EX', ttl);
  } catch {
    // Cache write failure is non-fatal — the client still gets correct data
  }

  return result;
}

/**
 * Returns high-level incident KPI counts broken down by status and priority.
 * Engineers see only their own incidents; managers and admins see all.
 *
 * @param {object} user - Authenticated user
 */
export async function getStats(user) {
  const cacheKey = `cache:dashboard:stats:${user.id}`;

  return cacheAside(cacheKey, async () => {
    // SUPPORT_ENGINEERs and VIEWERs see only their own incidents; ADMIN/MANAGER see all
    const where =
      user.role === 'SUPPORT_ENGINEER' || user.role === 'VIEWER'
        ? { OR: [{ reportedById: user.id }, { assigneeId: user.id }] }
        : {};

    const [byStatus, byPriority, totalOpen, slaBreached] = await Promise.all([
      prisma.incident.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      prisma.incident.groupBy({
        by: ['priority'],
        where: { ...where, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        _count: { priority: true },
      }),
      prisma.incident.count({ where: { ...where, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      prisma.incident.count({ where: { ...where, slaBreached: true, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    ]);

    return { byStatus, byPriority, totalOpen, slaBreached };
  });
}

/**
 * Returns SLA compliance statistics: total incidents, breached count, and
 * compliance rate as a percentage.
 */
export async function getSlaMetrics() {
  return cacheAside('cache:dashboard:sla', async () => {
    const [total, breached, byPriority] = await Promise.all([
      prisma.incident.count({ where: { status: { notIn: ['CLOSED'] } } }),
      prisma.incident.count({ where: { slaBreached: true } }),
      prisma.incident.groupBy({
        by: ['priority'],
        _count: { id: true },
        where: { slaBreached: true },
      }),
    ]);

    return {
      total,
      breached,
      compliant: total - breached,
      complianceRate: total > 0 ? Math.round(((total - breached) / total) * 100) : 100,
      breachedByPriority: byPriority,
    };
  });
}

/**
 * Returns the open incident count per engineer for workload distribution charts.
 */
export async function getWorkload() {
  return cacheAside('cache:dashboard:workload', async () => {
    const workload = await prisma.incident.groupBy({
      by: ['assigneeId'],
      where: {
        status: { notIn: ['RESOLVED', 'CLOSED'] },
        assigneeId: { not: null },
      },
      _count: { id: true },
    });

    // Resolve engineer names in a single query rather than N individual lookups
    const engineerIds = workload.map((w) => w.assigneeId).filter(Boolean);
    const users = await prisma.user.findMany({
      where: { id: { in: engineerIds } },
      select: { id: true, displayName: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.displayName]));

    return workload.map((w) => ({
      userId: w.assigneeId,
      displayName: userMap[w.assigneeId] || 'Unassigned',
      openIncidents: w._count.id,
    }));
  });
}

/**
 * Returns a 30-day rolling window of incident creation counts grouped by day.
 * Used for the trend line chart on the dashboard.
 */
export async function getTrends() {
  return cacheAside('cache:dashboard:trends', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Raw SQL is necessary here because Prisma does not support date_trunc in groupBy
    const rows = await prisma.$queryRaw`
      SELECT
        date_trunc('day', created_at) AS day,
        COUNT(*)::int AS count
      FROM incidents
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY day
      ORDER BY day ASC
    `;

    return rows.map((r) => ({
      date: r.day.toISOString().split('T')[0],
      count: r.count,
    }));
  });
}
