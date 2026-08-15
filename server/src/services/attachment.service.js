/**
 * @file Attachment service
 */

import fs from 'fs';
import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { AUDIT_ACTION } from '../constants/audit.js';
import { USER_ROLE } from '../constants/roles.js';

export async function listAttachments(incidentId) {
  return prisma.incidentAttachment.findMany({
    where: { incidentId },
    include: { uploadedBy: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Persists multiple uploaded files as Attachment records.
 * req.files is the array populated by Multer after MIME/size validation.
 */
export async function createAttachments(incidentId, files, user) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new AppError('Incident not found', 404, 'NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const attachments = await Promise.all(
      files.map((file) =>
        tx.incidentAttachment.create({
          data: {
            incidentId,
            uploadedById: user.id,
            filename: file.originalname,
            storagePath: file.path,
            mimeType: file.mimetype,
            size: file.size,
          },
        }),
      ),
    );

    await tx.incidentAuditLog.create({
      data: {
        incidentId,
        actorId: user.id,
        action: AUDIT_ACTION.ATTACHMENT_ADDED,
        newValue: files.map((f) => f.originalname).join(', '),
      },
    });

    return attachments;
  });
}

export async function getAttachment(attachmentId, user) {
  const attachment = await prisma.incidentAttachment.findUnique({
    where: { id: attachmentId },
    include: { incident: { select: { reportedById: true, assigneeId: true } } },
  });
  if (!attachment) throw new AppError('Attachment not found', 404, 'NOT_FOUND');

  // SUPPORT_ENGINEERs and VIEWERs can only access attachments on incidents they are involved with
  if (
    (user.role === USER_ROLE.SUPPORT_ENGINEER || user.role === USER_ROLE.VIEWER) &&
    attachment.incident.reportedById !== user.id &&
    attachment.incident.assigneeId !== user.id
  ) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }

  return attachment;
}

export async function deleteAttachment(attachmentId, user) {
  const attachment = await prisma.incidentAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new AppError('Attachment not found', 404, 'NOT_FOUND');

  // Only the uploader or an ADMIN can delete an attachment
  if (attachment.uploadedById !== user.id && user.role !== USER_ROLE.ADMIN) {
    throw new AppError('You can only delete your own attachments', 403, 'FORBIDDEN');
  }

  await prisma.$transaction(async (tx) => {
    await tx.incidentAttachment.delete({ where: { id: attachmentId } });
    await tx.incidentAuditLog.create({
      data: {
        incidentId: attachment.incidentId,
        actorId: user.id,
        action: AUDIT_ACTION.ATTACHMENT_DELETED,
        oldValue: attachment.filename,
      },
    });
  });

  // Remove the file from disk after the DB record is deleted
  try {
    fs.unlinkSync(attachment.storagePath);
  } catch {
    // File already gone — not a critical failure
  }
}
