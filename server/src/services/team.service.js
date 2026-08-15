/**
 * @file Team service
 */

import prisma from '../config/database.js';
import { AppError } from '../utils/AppError.js';

export async function listTeams({ skip, take }) {
  const [total, teams] = await Promise.all([
    prisma.team.count(),
    prisma.team.findMany({
      include: {
        _count: { select: { members: true, incidents: true } },
      },
      orderBy: { name: 'asc' },
      skip,
      take,
    }),
  ]);
  return { teams, total };
}

export async function createTeam(data, user) {
  return prisma.team.create({
    data: {
      ...data,
      // Automatically add the creator as team lead
      members: {
        create: { userId: user.id, role: 'LEAD' },
      },
    },
    include: { _count: { select: { members: true } } },
  });
}

export async function getTeamById(id) {
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
      },
    },
  });
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  return team;
}

export async function updateTeam(id, data) {
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  return prisma.team.update({ where: { id }, data });
}

export async function deleteTeam(id) {
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  await prisma.team.delete({ where: { id } });
}

export async function addMember(teamId, { userId, role }) {
  const [team, user] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  return prisma.teamMember.upsert({
    where: { userId_teamId: { userId, teamId } },
    update: { role },
    create: { userId, teamId, role },
  });
}

export async function removeMember(teamId, userId) {
  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (!member) throw new AppError('Member not found in team', 404, 'NOT_FOUND');
  await prisma.teamMember.delete({ where: { userId_teamId: { userId, teamId } } });
}
