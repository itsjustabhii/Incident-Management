/**
 * @file Comment service
 */

import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { AUDIT_ACTION } from '../constants/audit.js';
import { USER_ROLE } from '../constants/roles.js';
import { emitToIncident } from '../websocket/socket.js';
import * as notificationService from './notification.service.js';

/**
 * Returns paginated comments for an incident.
 * VIEWER role cannot see internal comments.
 */
export async function listComments(incidentId, { skip, take }, user) {
  const where = {
    incidentId,
    // VIEWERs and SUPPORT_ENGINEERs cannot see internal notes — only ADMIN/MANAGER can
    ...(
      user.role === USER_ROLE.VIEWER || user.role === USER_ROLE.SUPPORT_ENGINEER
        ? { isInternal: false }
        : {}
    ),
  };

  const [total, comments] = await Promise.all([
    prisma.incidentComment.count({ where }),
    prisma.incidentComment.findMany({
      where,
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
  ]);
  return { comments, total };
}

/**
 * Creates a comment on an incident and notifies the reporter.
 */
export async function createComment(incidentId, data, user) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { id: true, title: true, reportedById: true },
  });
  if (!incident) throw new AppError('Incident not found', 404, 'NOT_FOUND');

  // Only MANAGER/ADMIN can post internal notes — SUPPORT_ENGINEER and VIEWER cannot
  const isInternal = data.isInternal && [USER_ROLE.ADMIN, USER_ROLE.MANAGER].includes(user.role);

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.incidentComment.create({
      data: { incidentId, authorId: user.id, body: data.body, isInternal },
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    await tx.incidentAuditLog.create({
      data: {
        incidentId,
        actorId: user.id,
        action: AUDIT_ACTION.COMMENT_ADDED,
        newValue: data.body.slice(0, 200),
      },
    });

    return created;
  });

  // Notify the incident reporter that a new comment was added
  await notificationService.notifyComment(incident, comment, user);

  // Broadcast to everyone viewing the incident in real-time
  emitToIncident(incidentId, 'comment_added', { comment });

  return comment;
}

/**
 * Updates a comment. Only the original author or an admin can edit.
 */
export async function updateComment(commentId, data, user) {
  const comment = await prisma.incidentComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comment not found', 404, 'NOT_FOUND');

  // Only the original author or an ADMIN can edit a comment
  if (comment.authorId !== user.id && user.role !== USER_ROLE.ADMIN) {
    throw new AppError('You can only edit your own comments', 403, 'FORBIDDEN');
  }

  const updated = await prisma.incidentComment.update({
    where: { id: commentId },
    data: { body: data.body, editedAt: new Date() },
    include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  emitToIncident(comment.incidentId, 'comment_updated', { comment: updated });
  return updated;
}

/**
 * Deletes a comment. Only the author or an admin can delete.
 */
export async function deleteComment(commentId, user) {
  const comment = await prisma.incidentComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new AppError('Comment not found', 404, 'NOT_FOUND');

  // Only the original author or an ADMIN can delete a comment
  if (comment.authorId !== user.id && user.role !== USER_ROLE.ADMIN) {
    throw new AppError('You can only delete your own comments', 403, 'FORBIDDEN');
  }

  await prisma.$transaction(async (tx) => {
    await tx.incidentComment.delete({ where: { id: commentId } });
    await tx.incidentAuditLog.create({
      data: {
        incidentId: comment.incidentId,
        actorId: user.id,
        action: AUDIT_ACTION.COMMENT_DELETED,
      },
    });
  });

  emitToIncident(comment.incidentId, 'comment_deleted', { commentId });
}
