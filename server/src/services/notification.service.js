/**
 * @file Notification service
 * @description Creates in-app notifications and emits them via WebSocket.
 * This service is called by other services (incident, comment) after
 * successful DB operations — it never runs inside a transaction because
 * notification failures should not roll back the triggering operation.
 */

import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { NOTIFICATION_TYPE } from '../constants/audit.js';
import { emitNotificationToUser } from '../websocket/socket.js';
import { logger } from '../utils/logger.js';

/**
 * Creates a notification record in the DB and emits it to the user via WebSocket.
 *
 * @param {string} userId - The notification recipient
 * @param {string} type - One of NOTIFICATION_TYPE values
 * @param {string} title - Short notification title
 * @param {string} body - Notification body text
 * @param {string|null} referenceId - Optional incident ID for deep-linking
 * @returns {Promise<object>} The created notification
 */
export async function createNotification(userId, type, title, body, referenceId = null) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, referenceId },
  });

  // Push the notification to the user's Socket.IO channel so the badge
  // updates instantly without requiring a page refresh
  emitNotificationToUser(userId, notification);
  logger.debug({ userId, type, notificationId: notification.id }, 'Notification sent');

  return notification;
}

/**
 * Notifies a user that an incident has been assigned to them.
 * @param {object} incident - The incident that was assigned
 * @param {object} assignedBy - The user who performed the assignment
 */
export async function notifyAssignment(incident, assignedBy) {
  if (!incident.assigneeId) return;
  // Don't notify users who assigned the incident to themselves
  if (incident.assigneeId === assignedBy.id) return;

  await createNotification(
    incident.assigneeId,
    NOTIFICATION_TYPE.INCIDENT_ASSIGNED,
    'Incident Assigned to You',
    `${assignedBy.displayName || 'Someone'} assigned "${incident.title}" to you.`,
    incident.id,
  );
}

/**
 * Notifies the incident reporter when someone comments on their incident.
 * Does not notify when the reporter comments on their own incident.
 *
 * @param {object} incident - The incident that received a comment
 * @param {object} comment - The new comment
 * @param {object} commenter - The user who added the comment
 */
export async function notifyComment(incident, comment, commenter) {
  if (!incident.reportedById || incident.reportedById === commenter.id) return;

  await createNotification(
    incident.reportedById,
    NOTIFICATION_TYPE.COMMENT_ADDED,
    'New Comment on Your Incident',
    `${commenter.displayName || 'Someone'} commented on "${incident.title}".`,
    incident.id,
  );
}

/**
 * Returns a paginated list of notifications for a specific user.
 * @param {string} userId
 * @param {{ skip, take }} pagination
 */
export async function listNotifications(userId, { skip, take }) {
  const [total, notifications, unreadCount] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { notifications, total, unreadCount };
}

/**
 * Marks a single notification as read. Verifies ownership to prevent
 * one user from marking another user's notifications as read.
 *
 * @param {string} notificationId
 * @param {string} userId - The authenticated user's ID
 */
export async function markAsRead(notificationId, userId) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });

  if (!notification) throw new AppError('Notification not found', 404, 'NOT_FOUND');
  if (notification.userId !== userId) throw new AppError('Access denied', 403, 'FORBIDDEN');

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

/**
 * Marks all of a user's notifications as read in a single query.
 * @param {string} userId
 * @returns {Promise<number>} Count of notifications updated
 */
export async function markAllAsRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return result.count;
}
