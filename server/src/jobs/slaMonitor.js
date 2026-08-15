/**
 * @file SLA monitor background job
 * @description Runs on a cron schedule to detect incidents that have breached
 * their SLA deadline. For each breached incident it:
 *   1. Marks slaBreached = true on the incident
 *   2. Creates a Notification for the assignee and reporter
 *   3. Emits a real-time event via Socket.IO
 *
 * The job uses a Redis distributed lock so it is safe to run in a
 * multi-instance deployment — only one instance processes breaches at a time.
 */

import cron from 'node-cron';
import prisma from '../config/database.js';
import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { emitToIncident, emitNotificationToUser } from '../websocket/socket.js';
import { NOTIFICATION_TYPE } from '../constants/audit.js';

const LOCK_KEY = 'lock:sla-job';
const LOCK_TTL_SECONDS = 55; // Slightly less than the 60s cron interval

/**
 * Acquires a Redis distributed lock using SET NX EX.
 * Returns true if the lock was acquired, false if another instance holds it.
 * This prevents two server instances from processing the same SLA breaches.
 *
 * @returns {Promise<boolean>}
 */
async function acquireLock() {
  const result = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
  return result === 'OK';
}

/**
 * Releases the distributed lock after the job finishes processing.
 */
async function releaseLock() {
  await redis.del(LOCK_KEY);
}

/**
 * Core SLA breach detection logic.
 * Queries for all non-resolved incidents whose slaBreachAt is in the past
 * and slaBreached flag is still false, then processes each one.
 */
async function processSlaBreaches() {
  const now = new Date();

  // Single query to find all newly breached incidents — index on slaBreachAt makes this fast
  const breachedIncidents = await prisma.incident.findMany({
    where: {
      slaBreachAt: { lte: now },
      slaBreached: false,
      status: { notIn: ['RESOLVED', 'CLOSED'] },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      assigneeId: true,
      reportedById: true,
    },
  });

  if (breachedIncidents.length === 0) return;

  logger.info({ count: breachedIncidents.length }, 'Processing SLA breaches');

  for (const incident of breachedIncidents) {
    try {
      // Use a transaction to ensure the flag update and notification creation
      // are atomic — partial writes would lead to duplicate notifications
      await prisma.$transaction(async (tx) => {
        // Mark the incident as SLA breached
        await tx.incident.update({
          where: { id: incident.id },
          data: { slaBreached: true },
        });

        // Notify the assignee if one is set
        const recipientIds = new Set();
        if (incident.assigneeId) recipientIds.add(incident.assigneeId);
        if (incident.reportedById) recipientIds.add(incident.reportedById);

        const notifications = await Promise.all(
          [...recipientIds].map((userId) =>
            tx.notification.create({
              data: {
                userId,
                type: NOTIFICATION_TYPE.SLA_BREACHED,
                title: 'SLA Breached',
                body: `Incident "${incident.title}" has breached its SLA deadline.`,
                referenceId: incident.id,
              },
            }),
          ),
        );

        // Emit real-time events after the transaction commits
        // (emits are outside the promise chain to avoid blocking the transaction)
        return { notifications };
      });

      // Emit WebSocket events after the DB transaction succeeds
      emitToIncident(incident.id, 'sla_breach', {
        incidentId: incident.id,
        title: incident.title,
      });

      if (incident.assigneeId) {
        const notif = await prisma.notification.findFirst({
          where: {
            userId: incident.assigneeId,
            referenceId: incident.id,
            type: NOTIFICATION_TYPE.SLA_BREACHED,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (notif) emitNotificationToUser(incident.assigneeId, notif);
      }
    } catch (err) {
      // Log and continue — a failure on one incident should not block others
      logger.error({ err, incidentId: incident.id }, 'Failed to process SLA breach');
    }
  }
}

/**
 * Starts the SLA monitor cron job.
 * Scheduled to run every minute. The job is idempotent — running it more
 * frequently than intended (e.g., during a restart) will not create duplicate
 * notifications because slaBreached is checked before acting.
 */
export function startSlaMonitor() {
  // '* * * * *' = every minute
  cron.schedule('* * * * *', async () => {
    // Skip if another instance is already running the job
    const locked = await acquireLock();
    if (!locked) {
      logger.debug('SLA monitor: skipping — lock held by another instance');
      return;
    }

    try {
      await processSlaBreaches();
    } catch (err) {
      logger.error({ err }, 'SLA monitor job encountered an error');
    } finally {
      await releaseLock();
    }
  });

  logger.info('SLA monitor job started (runs every minute)');
}
