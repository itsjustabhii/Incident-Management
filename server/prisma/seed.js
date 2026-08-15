/**
 * @file Prisma database seed
 * @description Populates the database with initial data for development and
 * testing. Creates admin, manager, engineer, and viewer accounts plus sample
 * teams and a few example incidents.
 *
 * Run with:  npm run db:seed  (from the server directory)
 * Or:        npx prisma db seed
 *
 * WARNING: This script is for development only — never seed production with
 * hardcoded credentials. All passwords here are intentionally weak and
 * obviously for demo purposes.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Hashes a plain-text password using bcrypt with a work factor of 12 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ─────────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@incidenthub.dev' },
    update: {},
    create: {
      email: 'admin@incidenthub.dev',
      passwordHash: await hashPassword('Admin1234!'),
      displayName: 'System Administrator',
      role: 'ADMIN',
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@incidenthub.dev' },
    update: {},
    create: {
      email: 'manager@incidenthub.dev',
      passwordHash: await hashPassword('Manager1234!'),
      displayName: 'Jane Manager',
      role: 'MANAGER',
    },
  });

  const engineerUser = await prisma.user.upsert({
    where: { email: 'engineer@incidenthub.dev' },
    update: {},
    create: {
      email: 'engineer@incidenthub.dev',
      passwordHash: await hashPassword('Engineer1234!'),
      displayName: 'Bob Engineer',
      role: 'ENGINEER',
    },
  });

  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@incidenthub.dev' },
    update: {},
    create: {
      email: 'viewer@incidenthub.dev',
      passwordHash: await hashPassword('Viewer1234!'),
      displayName: 'Alice Viewer',
      role: 'VIEWER',
    },
  });

  console.log('✅  Users created');

  // ── Team ──────────────────────────────────────────────────────────────────
  const platformTeam = await prisma.team.upsert({
    where: { name: 'Platform Engineering' },
    update: {},
    create: {
      name: 'Platform Engineering',
      description: 'Responsible for core infrastructure and platform reliability',
      members: {
        createMany: {
          data: [
            { userId: managerUser.id, role: 'LEAD' },
            { userId: engineerUser.id, role: 'MEMBER' },
          ],
          skipDuplicates: true,
        },
      },
    },
  });

  console.log('✅  Teams created');

  // ── Incidents ─────────────────────────────────────────────────────────────
  const now = new Date();

  await prisma.incident.createMany({
    skipDuplicates: true,
    data: [
      {
        id: '11111111-0000-0000-0000-000000000001',
        title: 'Production database experiencing high latency',
        description:
          'The primary PostgreSQL instance is showing P99 query latency above 2000ms. ' +
          'Several API endpoints are timing out as a result. Needs immediate investigation.',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        category: 'DATABASE',
        reportedById: engineerUser.id,
        assigneeId: engineerUser.id,
        teamId: platformTeam.id,
        slaBreachAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
      },
      {
        id: '11111111-0000-0000-0000-000000000002',
        title: 'Login service returning 503 errors intermittently',
        description:
          'Users are reporting sporadic 503 errors when attempting to log in. ' +
          'Error rate is approximately 15% of login attempts.',
        status: 'OPEN',
        priority: 'HIGH',
        category: 'APPLICATION',
        reportedById: managerUser.id,
        teamId: platformTeam.id,
        slaBreachAt: new Date(now.getTime() + 6 * 60 * 60 * 1000), // 6 hours from now
      },
      {
        id: '11111111-0000-0000-0000-000000000003',
        title: 'SSL certificate expiring in 7 days',
        description:
          'The TLS certificate for api.incidenthub.dev expires in 7 days. ' +
          'Auto-renewal failed — manual renewal required.',
        status: 'OPEN',
        priority: 'MEDIUM',
        category: 'SECURITY',
        reportedById: adminUser.id,
        slaBreachAt: new Date(now.getTime() + 20 * 60 * 60 * 1000),
      },
    ],
  });

  console.log('✅  Sample incidents created');
  console.log('');
  console.log('🎉 Seed complete! Demo accounts:');
  console.log('   admin@incidenthub.dev    / Admin1234!    (ADMIN)');
  console.log('   manager@incidenthub.dev  / Manager1234!  (MANAGER)');
  console.log('   engineer@incidenthub.dev / Engineer1234! (ENGINEER)');
  console.log('   viewer@incidenthub.dev   / Viewer1234!   (VIEWER)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
