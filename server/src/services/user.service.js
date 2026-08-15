/**
 * @file User service
 * @description Business logic for user management.
 *
 * Authorization principles enforced here (defense-in-depth — route middleware also checks):
 *   • Only ADMINs can change a user's role — privilege escalation prevention.
 *   • Non-admin users can only update their own profile.
 *   • A user cannot deactivate their own account (would create an unrecoverable state).
 *   • Role changes are recorded in the audit log for compliance.
 */

import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { USER_ROLE } from '../constants/roles.js';
import { AUDIT_ACTION } from '../constants/audit.js';

/**
 * Removes sensitive fields from a user record before returning it to the caller.
 * @param {object} user - Raw Prisma user record
 * @returns {object} Safe user record
 */
function sanitize(user) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

/**
 * Returns a paginated, filtered list of users.
 * Only ADMIN and MANAGER roles should call this (enforced at the route layer).
 *
 * @param {object} query - Validated query params
 * @param {{ skip: number, take: number }} pagination
 */
export async function listUsers(query, { skip, take }) {
  const where = {};
  if (query.role) where.role = query.role;
  if (query.active !== undefined) where.active = query.active === 'true';
  if (query.search) {
    where.OR = [
      { displayName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { displayName: 'asc' },
      skip,
      take,
    }),
  ]);
  return { users, total };
}

/**
 * Returns a single user with their team memberships and incident counts.
 *
 * @param {string} id - User ID
 */
export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      teamMemberships: { include: { team: { select: { id: true, name: true } } } },
      _count: { select: { assignedIncidents: true, reportedIncidents: true } },
    },
  });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  return sanitize(user);
}

/**
 * Updates a user's profile.
 *
 * Security checks (defense-in-depth — route layer also enforces these):
 *   • Only ADMINs can change the role field — prevents privilege escalation.
 *   • Non-admins can only update their own profile.
 *
 * @param {string} targetId - ID of the user being updated
 * @param {object} changes  - Validated update data
 * @param {object} requestor - Authenticated user from req.user
 */
export async function updateUser(targetId, changes, requestor) {
  // PRIVILEGE ESCALATION PREVENTION: only ADMINs may change roles.
  // Any attempt by a non-admin to include a role change in the request body
  // is rejected here — this check must not be removed or weakened.
  if (changes.role && requestor.role !== USER_ROLE.ADMIN) {
    throw new AppError(
      'Only administrators can change user roles',
      403,
      'FORBIDDEN',
    );
  }

  // Prevent non-admins from modifying other users' profiles
  if (targetId !== requestor.id && requestor.role !== USER_ROLE.ADMIN) {
    throw new AppError('You can only update your own profile', 403, 'FORBIDDEN');
  }

  // Build the update payload — only include explicitly allowed fields
  const updateData = {};
  if (changes.displayName) updateData.displayName = changes.displayName;
  if (changes.avatarUrl !== undefined) updateData.avatarUrl = changes.avatarUrl;

  if (changes.role && requestor.role === USER_ROLE.ADMIN) {
    updateData.role = changes.role;

    // Record the role change in the audit log for compliance tracking
    const before = await prisma.user.findUnique({
      where: { id: targetId },
      select: { role: true },
    });

    await prisma.incidentAuditLog.create({
      data: {
        actorId: requestor.id,
        action: AUDIT_ACTION.USER_ROLE_CHANGED,
        oldValue: before?.role || null,
        newValue: changes.role,
        metadata: { targetUserId: targetId },
      },
    });
  }

  const user = await prisma.user.update({ where: { id: targetId }, data: updateData });
  return sanitize(user);
}

/**
 * Deactivates a user account (soft-delete via active=false).
 * Records an audit log entry for compliance.
 *
 * Security checks:
 *   • A user cannot deactivate their own account (avoids locking out the last admin).
 *
 * @param {string} targetId - ID of the user to deactivate
 * @param {object} requestor - Authenticated user from req.user
 */
export async function deactivateUser(targetId, requestor) {
  // Prevent self-deactivation — would lock the actor out of the system
  if (targetId === requestor.id) {
    throw new AppError(
      'You cannot deactivate your own account',
      400,
      'INVALID_OPERATION',
    );
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { active: false },
  });

  // Record deactivation in the immutable audit log
  await prisma.incidentAuditLog.create({
    data: {
      actorId: requestor.id,
      action: AUDIT_ACTION.USER_DEACTIVATED,
      metadata: { targetUserId: targetId },
    },
  });

  return sanitize(user);
}

/**
 * Reactivates a previously deactivated user account.
 * Records an audit log entry for compliance.
 *
 * @param {string} targetId - ID of the user to reactivate
 * @param {object} requestor - Authenticated ADMIN user
 */
export async function reactivateUser(targetId, requestor) {
  const user = await prisma.user.update({
    where: { id: targetId },
    data: { active: true },
  });

  await prisma.incidentAuditLog.create({
    data: {
      actorId: requestor.id,
      action: AUDIT_ACTION.USER_REACTIVATED,
      metadata: { targetUserId: targetId },
    },
  });

  return sanitize(user);
}
