/**
 * @file Incident service
 * @description Core business logic for incident lifecycle management.
 * Handles creation, updates, status transitions, SLA computation,
 * audit logging, and real-time event emission.
 */

import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { computeSlaBreachAt, adjustSlaForHold } from '../utils/sla.js';
import {
  INCIDENT_STATUS,
  VALID_STATUS_TRANSITIONS,
} from '../constants/incident.js';
import { AUDIT_ACTION } from '../constants/audit.js';
import { USER_ROLE } from '../constants/roles.js';
import { emitToIncident, emitBroadcast } from '../websocket/socket.js';
import * as notificationService from './notification.service.js';

/**
 * Select shape used for list queries — avoids fetching heavy fields like
 * full description in paginated lists where they are not needed.
 */
const INCIDENT_LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  category: true,
  slaBreachAt: true,
  slaBreached: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  reportedBy: { select: { id: true, displayName: true, avatarUrl: true } },
  assignee: { select: { id: true, displayName: true, avatarUrl: true } },
  team: { select: { id: true, name: true } },
  _count: { select: { comments: true, attachments: true } },
};

/**
 * Builds a Prisma where clause from the validated query parameters.
 * Applies role-based filtering: SUPPORT_ENGINEERs can only see incidents they are
 * involved with; VIEWERs cannot see internal data.
 *
 * @param {object} query - Validated query params
 * @param {object} user - Authenticated user from JWT
 * @returns {object} Prisma where clause
 */
function buildIncidentFilter(query, user) {
  const where = {};

  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.category) where.category = query.category;
  if (query.assigneeId) where.assigneeId = query.assigneeId;
  if (query.teamId) where.teamId = query.teamId;
  if (query.slaBreached === 'true') where.slaBreached = true;
  if (query.slaBreached === 'false') where.slaBreached = false;

  // Full-text search on title and description using Postgres ILIKE
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // SUPPORT_ENGINEERs and VIEWERs can only see incidents they reported or are assigned to.
  // ADMIN and MANAGER see all incidents for their organization.
  if (user.role === USER_ROLE.SUPPORT_ENGINEER || user.role === USER_ROLE.VIEWER) {
    where.OR = [
      ...(where.OR || []),
      { reportedById: user.id },
      { assigneeId: user.id },
    ];
  }

  return where;
}

/**
 * Returns a paginated, filtered list of incidents.
 * @param {object} query - Validated query params
 * @param {{ skip, take, page, pageSize }} pagination
 * @param {object} user - Authenticated user
 */
export async function listIncidents(query, { skip, take }, user) {
  const where = buildIncidentFilter(query, user);

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';

  // Run count and data queries in parallel to reduce total latency
  const [total, incidents] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      select: INCIDENT_LIST_SELECT,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
  ]);

  return { incidents, total };
}

/**
 * Creates a new incident, computes SLA breach time, and records an audit log entry.
 * The entire operation runs in a transaction to ensure consistency.
 *
 * @param {object} data - Validated request body
 * @param {object} user - Authenticated user (becomes the reporter)
 */
export async function createIncident(data, user) {
  const { title, description, priority, category, assigneeId, teamId } = data;

  const incident = await prisma.$transaction(async (tx) => {
    const created = await tx.incident.create({
      data: {
        title,
        description,
        priority,
        category,
        reportedById: user.id,
        assigneeId: assigneeId || null,
        teamId: teamId || null,
        slaBreachAt: computeSlaBreachAt(priority),
      },
      include: {
        reportedBy: { select: { id: true, displayName: true } },
        assignee: { select: { id: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Record audit log inside the same transaction so it's atomic with the create
    await tx.incidentAuditLog.create({
      data: {
        incidentId: created.id,
        actorId: user.id,
        action: AUDIT_ACTION.INCIDENT_CREATED,
        newValue: JSON.stringify({ title, priority, category }),
      },
    });

    return created;
  });

  logger.info({ incidentId: incident.id, userId: user.id }, 'Incident created');

  // Notify the assignee outside the transaction — notification failure should not
  // roll back the incident creation
  if (incident.assigneeId) {
    await notificationService.notifyAssignment(incident, user);
  }

  // Broadcast the new incident to all connected clients
  emitBroadcast('incident_created', { incident });

  return incident;
}

/**
 * Returns a single incident with full details including comments count,
 * attachments, and recent audit entries.
 *
 * @param {string} id - Incident ID
 * @param {object} user - Authenticated user
 */
export async function getIncidentById(id, user) {
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      reportedBy: { select: { id: true, displayName: true, avatarUrl: true } },
      assignee: { select: { id: true, displayName: true, avatarUrl: true } },
      team: { select: { id: true, name: true } },
      attachments: {
        select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { comments: true } },
    },
  });

  if (!incident) {
    throw new AppError('Incident not found', 404, 'NOT_FOUND');
  }

  // SUPPORT_ENGINEERs and VIEWERs can only view incidents they are involved with.
  // ADMIN and MANAGER can view all incidents.
  if (
    (user.role === USER_ROLE.SUPPORT_ENGINEER || user.role === USER_ROLE.VIEWER) &&
    incident.reportedById !== user.id &&
    incident.assigneeId !== user.id
  ) {
    throw new AppError('You do not have access to this incident', 403, 'FORBIDDEN');
  }

  return incident;
}

/**
 * Updates an incident, enforcing the status state machine and recording
 * field-level diffs in the audit log. Runs inside a transaction.
 *
 * @param {string} id - Incident ID
 * @param {object} changes - Validated update body
 * @param {object} user - Authenticated user
 */
export async function updateIncident(id, changes, user) {
  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) throw new AppError('Incident not found', 404, 'NOT_FOUND');

  // SUPPORT_ENGINEERs can only modify incidents they are involved with.
  // ADMIN and MANAGER can modify any incident.
  if (
    user.role === USER_ROLE.SUPPORT_ENGINEER &&
    existing.reportedById !== user.id &&
    existing.assigneeId !== user.id
  ) {
    throw new AppError('You do not have permission to modify this incident', 403, 'FORBIDDEN');
  }

  // SUPPORT_ENGINEERs cannot change assignee or priority — management-only fields
  if (user.role === USER_ROLE.SUPPORT_ENGINEER) {
    if (changes.assigneeId !== undefined) {
      throw new AppError(
        'Support engineers cannot reassign incidents — contact a manager',
        403,
        'FORBIDDEN',
      );
    }
    if (changes.priority !== undefined && changes.priority !== existing.priority) {
      throw new AppError(
        'Support engineers cannot change incident priority — contact a manager',
        403,
        'FORBIDDEN',
      );
    }
  }

  // Enforce the status state machine — reject invalid transitions
  if (changes.status && changes.status !== existing.status) {
    const allowed = VALID_STATUS_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(changes.status)) {
      throw new AppError(
        `Cannot transition from ${existing.status} to ${changes.status}`,
        422,
        'INVALID_STATUS_TRANSITION',
      );
    }
  }

  // Compute SLA adjustments when status changes to/from ON_HOLD
  if (changes.status === INCIDENT_STATUS.ON_HOLD && existing.status !== INCIDENT_STATUS.ON_HOLD) {
    changes.slaHoldStartedAt = new Date();
  } else if (
    changes.status !== INCIDENT_STATUS.ON_HOLD &&
    existing.status === INCIDENT_STATUS.ON_HOLD &&
    existing.slaHoldStartedAt
  ) {
    // Resume SLA clock — extend breach deadline by the hold duration
    changes.slaBreachAt = adjustSlaForHold(existing.slaBreachAt, existing.slaHoldStartedAt);
    changes.slaHoldStartedAt = null;
  }

  // Set lifecycle timestamps automatically based on status transitions
  if (changes.status === INCIDENT_STATUS.RESOLVED && !existing.resolvedAt) {
    changes.resolvedAt = new Date();
  } else if (changes.status === INCIDENT_STATUS.CLOSED && !existing.closedAt) {
    changes.closedAt = new Date();
  }

  // Recompute SLA if priority changes (replaces the original breach deadline)
  if (changes.priority && changes.priority !== existing.priority && !existing.slaBreached) {
    changes.slaBreachAt = computeSlaBreachAt(changes.priority, existing.createdAt);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.incident.update({
      where: { id },
      data: changes,
      include: {
        reportedBy: { select: { id: true, displayName: true, avatarUrl: true } },
        assignee: { select: { id: true, displayName: true, avatarUrl: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Build field-level audit entries for every changed field
    const auditEntries = Object.entries(changes)
      .filter(([key]) => !['slaHoldStartedAt', 'slaBreachAt', 'resolvedAt', 'closedAt'].includes(key))
      .map(([fieldName, newValue]) => ({
        incidentId: id,
        actorId: user.id,
        action: fieldName === 'status'
          ? AUDIT_ACTION.INCIDENT_STATUS_CHANGED
          : fieldName === 'assigneeId'
            ? AUDIT_ACTION.INCIDENT_ASSIGNED
            : AUDIT_ACTION.INCIDENT_UPDATED,
        fieldName,
        oldValue: String(existing[fieldName] ?? ''),
        newValue: String(newValue ?? ''),
      }));

    if (auditEntries.length > 0) {
      await tx.incidentAuditLog.createMany({ data: auditEntries });
    }

    return result;
  });

  // Emit real-time update to all clients currently viewing this incident
  emitToIncident(id, 'incident_updated', { incidentId: id, changes });

  // Send notification if the incident was just assigned to someone new
  if (changes.assigneeId && changes.assigneeId !== existing.assigneeId) {
    await notificationService.notifyAssignment(updated, user);
  }

  logger.info({ incidentId: id, userId: user.id, changes: Object.keys(changes) }, 'Incident updated');
  return updated;
}

/**
 * Deletes an incident (admin only). Records a final audit entry before deletion.
 *
 * @param {string} id - Incident ID
 * @param {object} user - Must be ADMIN
 */
export async function deleteIncident(id, user) {
  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) throw new AppError('Incident not found', 404, 'NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    await tx.incidentAuditLog.create({
      data: {
        incidentId: id,
        actorId: user.id,
        action: AUDIT_ACTION.INCIDENT_DELETED,
        oldValue: JSON.stringify({ title: existing.title, status: existing.status }),
      },
    });
    await tx.incident.delete({ where: { id } });
  });

  emitBroadcast('incident_deleted', { incidentId: id });
  logger.info({ incidentId: id, userId: user.id }, 'Incident deleted');
}

/**
 * Returns the paginated audit log for a specific incident.
 *
 * @param {string} incidentId
 * @param {{ skip, take, page, pageSize }} pagination
 */
export async function getAuditLog(incidentId, { skip, take }) {
  const [total, logs] = await Promise.all([
    prisma.incidentAuditLog.count({ where: { incidentId } }),
    prisma.incidentAuditLog.findMany({
      where: { incidentId },
      include: { actor: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);
  return { logs, total };
}
