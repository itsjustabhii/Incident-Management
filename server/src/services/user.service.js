/**
 * @file User service
 */

import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { USER_ROLE } from '../constants/roles.js';
import { AUDIT_ACTION } from '../constants/audit.js';

function sanitize(user) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

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
        id: true, email: true, displayName: true,
        avatarUrl: true, role: true, active: true, createdAt: true,
      },
      orderBy: { displayName: 'asc' },
      skip,
      take,
    }),
  ]);
  return { users, total };
}

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
 * Updates a user's profile. Only ADMINs can change roles.
 * Users can update their own display name and avatar.
 */
export async function updateUser(targetId, changes, requestor) {
  // Prevent non-admins from escalating privileges by changing their own role
  if (changes.role && requestor.role !== USER_ROLE.ADMIN) {
    throw new AppError('Only admins can change user roles', 403, 'FORBIDDEN');
  }

  // Non-admin users can only update their own profile
  if (targetId !== requestor.id && requestor.role !== USER_ROLE.ADMIN) {
    throw new AppError('You can only update your own profile', 403, 'FORBIDDEN');
  }

  const updateData = {};
  if (changes.displayName) updateData.displayName = changes.displayName;
  if (changes.avatarUrl !== undefined) updateData.avatarUrl = changes.avatarUrl;

  if (changes.role && requestor.role === USER_ROLE.ADMIN) {
    updateData.role = changes.role;
    await prisma.auditLog.create({
      data: {
        actorId: requestor.id,
        action: AUDIT_ACTION.USER_ROLE_CHANGED,
        oldValue: (await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } }))?.role,
        newValue: changes.role,
        metadata: { targetUserId: targetId },
      },
    });
  }

  const user = await prisma.user.update({ where: { id: targetId }, data: updateData });
  return sanitize(user);
}

export async function deactivateUser(targetId, requestor) {
  if (targetId === requestor.id) {
    throw new AppError('You cannot deactivate your own account', 400, 'INVALID_OPERATION');
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { active: false },
  });

  await prisma.auditLog.create({
    data: {
      actorId: requestor.id,
      action: AUDIT_ACTION.USER_DEACTIVATED,
      metadata: { targetUserId: targetId },
    },
  });

  return sanitize(user);
}
