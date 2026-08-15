/**
 * @file Prisma database seed
 * @description Populates the database with comprehensive, realistic development
 * data for the Incident Management Platform.
 *
 * Creates:
 *   • 1 organization (IncidentHub Corp)
 *   • Role reference records (ADMIN, MANAGER, SUPPORT_ENGINEER, VIEWER)
 *   • 7 users: 1 admin, 2 managers, 3 support engineers, 1 viewer
 *   • 2 teams with members
 *   • 4 SLA policies (one per priority)
 *   • 10 incidents spanning all statuses, priorities, and categories
 *   • IncidentAssignment history records
 *   • Comments (public + internal) on incidents
 *   • Attachments metadata
 *   • Activity feed entries
 *   • Audit log entries
 *   • Notifications
 *   • Notification preferences for all users
 *
 * Run via:  npm run db:seed   (from the server directory)
 *        or: npx prisma db seed
 *
 * IMPORTANT: This script is for development only.
 *   - Never seed production with hardcoded credentials.
 *   - All passwords are intentionally obvious demo values.
 *   - bcrypt work factor is 12 — seed will take a few seconds per user hash.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hashes a plain-text password using bcrypt with work factor 12. */
async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

/**
 * Returns a Date offset from `base` by `offsetMs` milliseconds.
 * Positive values are in the future; negative values are in the past.
 */
function offsetDate(base, offsetMs) {
  return new Date(base.getTime() + offsetMs);
}

const MINUTE = 60 * 1000;
const HOUR   = 60 * MINUTE;
const DAY    = 24 * HOUR;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const now = new Date();
  console.log('🌱  Seeding database...\n');

  // =========================================================================
  // ROLE REFERENCE RECORDS
  // Provides human-readable labels and descriptions for each role.
  // The actual role enforcement uses the UserRole enum on the User model.
  // =========================================================================

  await prisma.$transaction(async (tx) => {
    const roles = [
      {
        name: 'ADMIN',
        label: 'System Administrator',
        description:
          'Full system access. Manages users, organizations, teams, settings, and all incidents.',
      },
      {
        name: 'MANAGER',
        label: 'Incident Manager',
        description:
          'Manages team incidents, views all dashboards, assigns and escalates incidents.',
      },
      {
        name: 'SUPPORT_ENGINEER',
        label: 'Support Engineer',
        description:
          'Creates and updates assigned incidents, adds comments, uploads attachments, resolves incidents.',
      },
      {
        name: 'VIEWER',
        label: 'Read-Only Viewer',
        description:
          'Read-only access to non-internal incidents. Cannot create or modify records.',
      },
    ];

    for (const role of roles) {
      await tx.role.upsert({
        where: { name: role.name },
        update: { label: role.label, description: role.description },
        create: role,
      });
    }
  });

  console.log('✅  Role reference records');

  // =========================================================================
  // ORGANIZATION
  // =========================================================================

  const org = await prisma.organization.upsert({
    where: { slug: 'incidenthub-corp' },
    update: {},
    create: {
      name: 'IncidentHub Corp',
      slug: 'incidenthub-corp',
      active: true,
    },
  });

  console.log('✅  Organization');

  // =========================================================================
  // USERS
  // All passwords are bcrypt-hashed — plaintext is never stored.
  // =========================================================================

  /**
   * upsertUser avoids duplicate key errors on repeated seed runs.
   * Update block is intentionally empty — we don't want re-seeding to
   * overwrite any manual changes made during development.
   */
  async function upsertUser({ email, plainPassword, displayName, role, avatarUrl }) {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await hashPassword(plainPassword),
        displayName,
        role,
        avatarUrl: avatarUrl ?? null,
        active: true,
      },
    });
  }

  const [admin, manager1, manager2, eng1, eng2, eng3, viewer] = await Promise.all([
    upsertUser({
      email: 'admin@incidenthub.dev',
      plainPassword: 'Admin1234!',
      displayName: 'System Administrator',
      role: 'ADMIN',
    }),
    upsertUser({
      email: 'sarah.manager@incidenthub.dev',
      plainPassword: 'Manager1234!',
      displayName: 'Sarah Chen',
      role: 'MANAGER',
    }),
    upsertUser({
      email: 'james.manager@incidenthub.dev',
      plainPassword: 'Manager1234!',
      displayName: 'James Okonkwo',
      role: 'MANAGER',
    }),
    upsertUser({
      email: 'alex.engineer@incidenthub.dev',
      plainPassword: 'Engineer1234!',
      displayName: 'Alex Rivera',
      role: 'SUPPORT_ENGINEER',
    }),
    upsertUser({
      email: 'priya.engineer@incidenthub.dev',
      plainPassword: 'Engineer1234!',
      displayName: 'Priya Sharma',
      role: 'SUPPORT_ENGINEER',
    }),
    upsertUser({
      email: 'tom.engineer@incidenthub.dev',
      plainPassword: 'Engineer1234!',
      displayName: 'Tom Walsh',
      role: 'SUPPORT_ENGINEER',
    }),
    upsertUser({
      email: 'viewer@incidenthub.dev',
      plainPassword: 'Viewer1234!',
      displayName: 'Alice Viewer',
      role: 'VIEWER',
    }),
  ]);

  console.log('✅  Users (7)');

  // Link all users to the organization
  await prisma.$transaction(
    [admin, manager1, manager2, eng1, eng2, eng3, viewer].map((u) =>
      prisma.organizationMember.upsert({
        where: { userId_organizationId: { userId: u.id, organizationId: org.id } },
        update: {},
        create: { userId: u.id, organizationId: org.id },
      }),
    ),
  );

  console.log('✅  Organization memberships');

  // =========================================================================
  // TEAMS
  // =========================================================================

  /**
   * Team upsert uses the composite unique key (organizationId, name).
   * On conflict we do nothing so repeat seeds are safe.
   */
  async function upsertTeam({ orgId, name, description, memberRoles }) {
    // Find-or-create the team
    let team = await prisma.team.findFirst({
      where: { organizationId: orgId, name },
    });

    if (!team) {
      team = await prisma.team.create({
        data: { organizationId: orgId, name, description },
      });
    }

    // Idempotently add members
    for (const { userId, role } of memberRoles) {
      await prisma.teamMember.upsert({
        where: { userId_teamId: { userId, teamId: team.id } },
        update: {},
        create: { userId, teamId: team.id, role },
      });
    }

    return team;
  }

  const platformTeam = await upsertTeam({
    orgId: org.id,
    name: 'Platform Engineering',
    description: 'Responsible for core infrastructure, reliability, and platform services.',
    memberRoles: [
      { userId: manager1.id, role: 'LEAD' },
      { userId: eng1.id,     role: 'MEMBER' },
      { userId: eng2.id,     role: 'MEMBER' },
    ],
  });

  const securityTeam = await upsertTeam({
    orgId: org.id,
    name: 'Security Operations',
    description: 'Handles security incidents, vulnerability management, and compliance.',
    memberRoles: [
      { userId: manager2.id, role: 'LEAD' },
      { userId: eng3.id,     role: 'MEMBER' },
    ],
  });

  console.log('✅  Teams (2)');

  // =========================================================================
  // SLA POLICIES (one per priority, per organization)
  // =========================================================================

  /**
   * SLA policy upsert uses the composite unique key (organizationId, priority).
   */
  async function upsertSLA({ orgId, name, priority, responseMinutes, resolutionMinutes }) {
    return prisma.sLAPolicy.upsert({
      where: { organizationId_priority: { organizationId: orgId, priority } },
      update: { responseMinutes, resolutionMinutes, name },
      create: { organizationId: orgId, name, priority, responseMinutes, resolutionMinutes },
    });
  }

  const [slaCritical, slaHigh, slaMedium, slaLow] = await Promise.all([
    upsertSLA({
      orgId: org.id,
      name: 'Critical SLA',
      priority: 'CRITICAL',
      responseMinutes: 60,    // 1 hour to first response
      resolutionMinutes: 240, // 4 hours to resolution
    }),
    upsertSLA({
      orgId: org.id,
      name: 'High SLA',
      priority: 'HIGH',
      responseMinutes: 240,  // 4 hours
      resolutionMinutes: 480, // 8 hours
    }),
    upsertSLA({
      orgId: org.id,
      name: 'Medium SLA',
      priority: 'MEDIUM',
      responseMinutes: 480,   // 8 hours
      resolutionMinutes: 1440, // 24 hours
    }),
    upsertSLA({
      orgId: org.id,
      name: 'Low SLA',
      priority: 'LOW',
      responseMinutes: 1440,  // 24 hours
      resolutionMinutes: 4320, // 72 hours
    }),
  ]);

  console.log('✅  SLA policies (4)');

  // =========================================================================
  // INCIDENTS
  // Fixed UUIDs allow idempotent re-seeding with createMany + skipDuplicates.
  // Timestamps are spread over the past 14 days to produce realistic dashboard
  // trend data.
  // =========================================================================

  // Incident definitions (created oldest → newest for realistic timeline)
  const incidentDefs = [
    // ── INC-001: CRITICAL, IN_PROGRESS, SLA breached ─────────────────────
    {
      id: '10000000-0000-0000-0000-000000000001',
      incidentNumber: 1,
      title: 'Production database experiencing critical latency spike',
      description:
        'The primary PostgreSQL cluster is reporting P99 query latency above 5,000ms across ' +
        'all read replicas. Multiple API endpoints are timing out, causing cascading failures ' +
        'in the order processing pipeline. Downstream services affected: checkout, inventory, ' +
        'and reporting. Root cause not yet identified. Current hypothesis: runaway query from ' +
        'the nightly analytics job that was recently modified.',
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      category: 'DATABASE',
      organizationId: org.id,
      reporterId: eng1.id,
      assigneeId: eng1.id,
      teamId: platformTeam.id,
      slaId: slaCritical.id,
      // Created 6 hours ago — SLA breach window was 4h, so it is now breached
      createdAt: offsetDate(now, -6 * HOUR),
      assignedAt: offsetDate(now, -6 * HOUR + 10 * MINUTE),
      slaBreachAt: offsetDate(now, -2 * HOUR), // Already past — breached
      slaBreached: true,
    },
    // ── INC-002: CRITICAL, OPEN, not yet assigned ─────────────────────────
    {
      id: '10000000-0000-0000-0000-000000000002',
      incidentNumber: 2,
      title: 'Authentication service returning 503 for 22% of login requests',
      description:
        'Starting approximately 45 minutes ago, roughly 22% of login attempts are receiving ' +
        '503 Service Unavailable. The error correlates with a deployment of auth-service v2.4.1 ' +
        'that went live at 14:30 UTC. Health check endpoints on two of the three auth pods are ' +
        'failing. No changes to infrastructure — likely a code regression.',
      status: 'OPEN',
      priority: 'CRITICAL',
      category: 'APPLICATION',
      organizationId: org.id,
      reporterId: manager1.id,
      assigneeId: null,
      teamId: platformTeam.id,
      slaId: slaCritical.id,
      createdAt: offsetDate(now, -45 * MINUTE),
      slaBreachAt: offsetDate(now, 15 * MINUTE), // 15 minutes left in SLA window
      slaBreached: false,
    },
    // ── INC-003: HIGH, IN_PROGRESS ────────────────────────────────────────
    {
      id: '10000000-0000-0000-0000-000000000003',
      incidentNumber: 3,
      title: 'TLS certificate auto-renewal failure on api.incidenthub.dev',
      description:
        "The Let's Encrypt auto-renewal job failed silently 3 days ago. The certificate for " +
        'api.incidenthub.dev expires in 4 days. ACME challenge is failing because the DNS ' +
        'TXT record required by our DNS-01 challenge was not updated — the IAM role permissions ' +
        'for the certbot Lambda were revoked during a recent security audit.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      category: 'SECURITY',
      organizationId: org.id,
      reporterId: admin.id,
      assigneeId: eng3.id,
      teamId: securityTeam.id,
      slaId: slaHigh.id,
      createdAt: offsetDate(now, -2 * DAY),
      assignedAt: offsetDate(now, -2 * DAY + 30 * MINUTE),
      slaBreachAt: offsetDate(now, 6 * HOUR),
      slaBreached: false,
    },
    // ── INC-004: HIGH, OPEN ───────────────────────────────────────────────
    {
      id: '10000000-0000-0000-0000-000000000004',
      incidentNumber: 4,
      title: 'Memory leak in notification-service causing OOM restarts',
      description:
        'The notification-service container is consuming 2x its normal memory and crashing ' +
        'every 3–4 hours due to OOM kill. This began after deploying notification-service v1.8.0 ' +
        'yesterday. Heap dumps collected during the last crash cycle. Initial analysis suggests ' +
        'a socket listener leak in the Redis subscriber pool — listeners are not being cleaned ' +
        'up after disconnections.',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'APPLICATION',
      organizationId: org.id,
      reporterId: eng2.id,
      assigneeId: null,
      teamId: platformTeam.id,
      slaId: slaHigh.id,
      createdAt: offsetDate(now, -18 * HOUR),
      slaBreachAt: offsetDate(now, -10 * HOUR),
      // SLA breached but not yet actioned
      slaBreached: true,
    },
    // ── INC-005: MEDIUM, ON_HOLD ──────────────────────────────────────────
    {
      id: '10000000-0000-0000-0000-000000000005',
      incidentNumber: 5,
      title: 'Pagination returning incorrect total count on incident list endpoint',
      description:
        'The GET /api/v1/incidents endpoint returns an inflated total count in the meta ' +
        'envelope when both status and priority filters are applied simultaneously. The count ' +
        'reflects all records matching status only, ignoring the priority filter. Reproduction ' +
        'steps: GET /api/v1/incidents?status=OPEN&priority=HIGH returns meta.total = 47 when ' +
        'the actual filtered result set is 12. Impact: dashboard pagination is misleading but ' +
        'data itself is correct.',
      status: 'ON_HOLD',
      priority: 'MEDIUM',
      category: 'APPLICATION',
      organizationId: org.id,
      reporterId: viewer.id,
      assigneeId: eng2.id,
      teamId: platformTeam.id,
      slaId: slaMedium.id,
      createdAt: offsetDate(now, -5 * DAY),
      assignedAt: offsetDate(now, -5 * DAY + 2 * HOUR),
      // SLA clock paused when status moved to ON_HOLD
      slaHoldStartedAt: offsetDate(now, -3 * DAY),
      slaHoldMinutes: 2880, // 2 days paused
      slaBreachAt: offsetDate(now, 10 * HOUR), // extended due to hold
      slaBreached: false,
    },
    // ── INC-006: MEDIUM, OPEN ─────────────────────────────────────────────
    {
      id: '10000000-0000-0000-0000-000000000006',
      incidentNumber: 6,
      title: 'Redis cache eviction policy causing elevated DB load during peak hours',
      description:
        'During business hours (09:00–17:00 UTC), the Redis instance is hitting its maxmemory ' +
        'limit and evicting keys aggressively. This causes a thundering herd of cache misses ' +
        'that drives PostgreSQL connection pool utilization above 85%. The root cause is ' +
        'insufficient maxmemory configuration — the instance was sized for Q1 traffic but ' +
        'volume has grown 40% since then. Proposed fix: increase maxmemory to 4GB or implement ' +
        'TTL-based eviction instead of allkeys-lru.',
      status: 'OPEN',
      priority: 'MEDIUM',
      category: 'INFRASTRUCTURE',
      organizationId: org.id,
      reporterId: eng1.id,
      assigneeId: eng1.id,
      teamId: platformTeam.id,
      slaId: slaMedium.id,
      createdAt: offsetDate(now, -1 * DAY),
      assignedAt: offsetDate(now, -1 * DAY + 1 * HOUR),
      slaBreachAt: offsetDate(now, 8 * HOUR),
      slaBreached: false,
    },
    // ── INC-007: LOW, OPEN ────────────────────────────────────────────────
    {
      id: '10000000-0000-0000-0000-000000000007',
      incidentNumber: 7,
      title: 'Dashboard trend chart misaligns timezone offset for UTC+5:30 users',
      description:
        'Users in IST (UTC+5:30) report that the "Incidents over time" chart on the dashboard ' +
        'shows data grouped by UTC day rather than their local day, making yesterday\'s spike ' +
        'appear to split across two chart bars. The bug is in the frontend groupBy utility — ' +
        'it calls toISOString() (always UTC) instead of using the user\'s locale offset. ' +
        'No backend changes required; client-only fix.',
      status: 'OPEN',
      priority: 'LOW',
      category: 'APPLICATION',
      organizationId: org.id,
      reporterId: viewer.id,
      assigneeId: null,
      teamId: platformTeam.id,
      slaId: slaLow.id,
      createdAt: offsetDate(now, -3 * DAY),
      slaBreachAt: offsetDate(now, 2 * DAY),
      slaBreached: false,
    },
    // ── INC-008: CRITICAL, RESOLVED ──────────────────────────────────────
    {
      id: '10000000-0000-0000-0000-000000000008',
      incidentNumber: 8,
      title: 'Security: exposed internal admin endpoint accessible without authentication',
      description:
        'A penetration test (authorized, carried out by the internal security team) discovered ' +
        'that the /internal/admin/users endpoint was reachable from the public internet without ' +
        'any authentication. The endpoint was created during a migration sprint and was ' +
        'inadvertently left off the authentication middleware chain. No evidence of unauthorized ' +
        'access in logs. Endpoint immediately taken offline — permanent fix deployed in patch v2.3.2.',
      status: 'RESOLVED',
      priority: 'CRITICAL',
      category: 'SECURITY',
      organizationId: org.id,
      reporterId: manager2.id,
      assigneeId: eng3.id,
      teamId: securityTeam.id,
      slaId: slaCritical.id,
      createdAt: offsetDate(now, -7 * DAY),
      assignedAt: offsetDate(now, -7 * DAY + 15 * MINUTE),
      resolvedAt: offsetDate(now, -7 * DAY + 3.5 * HOUR),
      resolutionTime: 210, // minutes
      slaBreachAt: offsetDate(now, -7 * DAY + 4 * HOUR),
      slaBreached: false, // Resolved within SLA window
    },
    // ── INC-009: HIGH, CLOSED ────────────────────────────────────────────
    {
      id: '10000000-0000-0000-0000-000000000009',
      incidentNumber: 9,
      title: 'Network packet loss between availability zones degrading cross-AZ calls',
      description:
        'Between 08:15 and 11:40 UTC on Monday, intermittent packet loss (1–3%) was detected ' +
        'on the east-west traffic links between AZ-1 and AZ-2. Services making synchronous ' +
        'cross-AZ gRPC calls experienced elevated error rates. Root cause: a misconfigured ' +
        'BGP route advertisement after a scheduled maintenance window on the core switch. ' +
        'Rolling back the BGP config change at 11:35 UTC restored full connectivity by 11:40 UTC.',
      status: 'CLOSED',
      priority: 'HIGH',
      category: 'NETWORK',
      organizationId: org.id,
      reporterId: eng2.id,
      assigneeId: eng2.id,
      teamId: platformTeam.id,
      slaId: slaHigh.id,
      createdAt: offsetDate(now, -10 * DAY),
      assignedAt: offsetDate(now, -10 * DAY + 5 * MINUTE),
      resolvedAt: offsetDate(now, -10 * DAY + 3.5 * HOUR),
      closedAt: offsetDate(now, -9 * DAY),
      resolutionTime: 205,
      slaBreachAt: offsetDate(now, -10 * DAY + 8 * HOUR),
      slaBreached: false,
    },
    // ── INC-010: LOW, RESOLVED ────────────────────────────────────────────
    {
      id: '10000000-0000-0000-0000-000000000010',
      incidentNumber: 10,
      title: 'Attachment download link expires too quickly for large file transfers',
      description:
        'Users attempting to download attachments larger than ~200MB occasionally receive ' +
        '"403 Forbidden" before the download completes. The presigned S3 URL generated by ' +
        'the download endpoint has a 60-second expiry, which is too short for slow connections ' +
        'to finish downloading large files. Proposed fix: increase presigned URL TTL to 15 ' +
        'minutes; large files are streamed via the backend proxy regardless of client speed.',
      status: 'RESOLVED',
      priority: 'LOW',
      category: 'APPLICATION',
      organizationId: org.id,
      reporterId: viewer.id,
      assigneeId: eng1.id,
      teamId: platformTeam.id,
      slaId: slaLow.id,
      createdAt: offsetDate(now, -12 * DAY),
      assignedAt: offsetDate(now, -12 * DAY + 6 * HOUR),
      resolvedAt: offsetDate(now, -11 * DAY),
      resolutionTime: 1080, // 18 hours
      slaBreachAt: offsetDate(now, -12 * DAY + 72 * HOUR),
      slaBreached: false,
    },
  ];

  /**
   * Build the createMany data array, stripping fields Prisma doesn't accept
   * (like slaId which maps to sla_id).  We use a raw data shape here.
   */
  await prisma.incident.createMany({
    skipDuplicates: true,
    data: incidentDefs.map(
      ({
        id, incidentNumber, title, description, status, priority, category,
        organizationId, reporterId, assigneeId, teamId, slaId,
        slaBreachAt, slaBreached, slaHoldStartedAt, slaHoldMinutes, resolutionTime,
        assignedAt, resolvedAt, closedAt, createdAt,
      }) => ({
        id,
        incidentNumber,
        title,
        description,
        status,
        priority,
        category,
        organizationId,
        reporterId,
        assigneeId: assigneeId ?? null,
        teamId: teamId ?? null,
        slaId: slaId ?? null,
        slaBreachAt: slaBreachAt ?? null,
        slaBreached: slaBreached ?? false,
        slaHoldStartedAt: slaHoldStartedAt ?? null,
        slaHoldMinutes: slaHoldMinutes ?? 0,
        resolutionTime: resolutionTime ?? null,
        assignedAt: assignedAt ?? null,
        resolvedAt: resolvedAt ?? null,
        closedAt: closedAt ?? null,
        createdAt: createdAt ?? now,
        updatedAt: resolvedAt ?? closedAt ?? createdAt ?? now,
      }),
    ),
  });

  console.log('✅  Incidents (10)');

  // =========================================================================
  // INCIDENT ASSIGNMENTS (history records)
  // =========================================================================

  // Lookup the created incidents so we have their IDs available
  const incidents = await prisma.incident.findMany({
    where: { organizationId: org.id },
    select: { id: true, incidentNumber: true, assigneeId: true, assignedAt: true, reporterId: true },
  });

  const incidentMap = Object.fromEntries(incidents.map((i) => [i.incidentNumber, i]));

  const assignmentData = [
    // INC-001: assigned immediately to eng1 on creation
    {
      incidentId: incidentMap[1].id,
      assigneeId: eng1.id,
      assignedAt: offsetDate(now, -6 * HOUR + 10 * MINUTE),
      assignedById: manager1.id,
    },
    // INC-003: assigned to eng3 by manager2
    {
      incidentId: incidentMap[3].id,
      assigneeId: eng3.id,
      assignedAt: offsetDate(now, -2 * DAY + 30 * MINUTE),
      assignedById: manager2.id,
    },
    // INC-005: first assigned to eng1, then reassigned to eng2
    {
      incidentId: incidentMap[5].id,
      assigneeId: eng1.id,
      assignedAt: offsetDate(now, -5 * DAY + 2 * HOUR),
      unassignedAt: offsetDate(now, -5 * DAY + 4 * HOUR),
      assignedById: manager1.id,
    },
    {
      incidentId: incidentMap[5].id,
      assigneeId: eng2.id,
      assignedAt: offsetDate(now, -5 * DAY + 4 * HOUR),
      assignedById: manager1.id,
    },
    // INC-006: assigned to eng1
    {
      incidentId: incidentMap[6].id,
      assigneeId: eng1.id,
      assignedAt: offsetDate(now, -1 * DAY + 1 * HOUR),
      assignedById: manager1.id,
    },
    // INC-008: assigned to eng3 15 min after creation
    {
      incidentId: incidentMap[8].id,
      assigneeId: eng3.id,
      assignedAt: offsetDate(now, -7 * DAY + 15 * MINUTE),
      assignedById: manager2.id,
    },
    // INC-009: assigned to eng2
    {
      incidentId: incidentMap[9].id,
      assigneeId: eng2.id,
      assignedAt: offsetDate(now, -10 * DAY + 5 * MINUTE),
      assignedById: manager1.id,
    },
    // INC-010: assigned to eng1 after 6 hours
    {
      incidentId: incidentMap[10].id,
      assigneeId: eng1.id,
      assignedAt: offsetDate(now, -12 * DAY + 6 * HOUR),
      assignedById: manager1.id,
    },
  ];

  await prisma.incidentAssignment.createMany({
    skipDuplicates: false,
    data: assignmentData.map(({ incidentId, assigneeId, assignedAt, unassignedAt, assignedById }) => ({
      incidentId,
      assigneeId,
      assignedAt,
      unassignedAt: unassignedAt ?? null,
      assignedById,
    })),
  });

  console.log('✅  Incident assignment records');

  // =========================================================================
  // INCIDENT COMMENTS
  // Mix of public comments (visible to all) and internal notes (VIEWER-hidden).
  // =========================================================================

  await prisma.incidentComment.createMany({
    skipDuplicates: false,
    data: [
      // INC-001
      {
        incidentId: incidentMap[1].id,
        authorId: eng1.id,
        body: 'Confirmed — P99 latency is 5.2s on the primary node. Running EXPLAIN ANALYZE on the nightly analytics query now. The sequential scan on the events table (280M rows, no index on created_at) looks like the culprit.',
        isInternal: false,
        createdAt: offsetDate(now, -5 * HOUR - 50 * MINUTE),
      },
      {
        incidentId: incidentMap[1].id,
        authorId: manager1.id,
        body: 'Escalating priority confirmed. Engineering leadership has been notified. Alex, please provide an update every 30 minutes until resolved.',
        isInternal: false,
        createdAt: offsetDate(now, -5 * HOUR - 30 * MINUTE),
      },
      {
        incidentId: incidentMap[1].id,
        authorId: eng1.id,
        // Internal note — not visible to VIEWER role
        body: 'Internal note: the analytics team ran a custom query without going through the standard review process. This bypassed query governor limits. Raising this in the post-mortem.',
        isInternal: true,
        createdAt: offsetDate(now, -5 * HOUR),
      },
      {
        incidentId: incidentMap[1].id,
        authorId: eng1.id,
        body: 'Killed the runaway analytics query. Primary latency dropped to 180ms immediately. Monitoring for 10 minutes to confirm stability before updating status.',
        isInternal: false,
        createdAt: offsetDate(now, -4 * HOUR - 30 * MINUTE),
      },
      // INC-002
      {
        incidentId: incidentMap[2].id,
        authorId: manager1.id,
        body: 'Verified. Auth pod 2 and pod 3 are failing readiness checks. Kubernetes is routing all traffic to pod 1 which is overwhelmed. Initiating rollback of v2.4.1.',
        isInternal: false,
        createdAt: offsetDate(now, -40 * MINUTE),
      },
      // INC-003
      {
        incidentId: incidentMap[3].id,
        authorId: eng3.id,
        body: 'Root cause confirmed: the certbot Lambda IAM role was missing route53:ChangeResourceRecordSets permission after the IAM audit on 2024-01-15. Applied the corrected policy. Renewal will retry at next scheduled run in 4 hours.',
        isInternal: false,
        createdAt: offsetDate(now, -2 * DAY + 2 * HOUR),
      },
      {
        incidentId: incidentMap[3].id,
        authorId: eng3.id,
        body: 'Auto-renewal succeeded. New certificate valid until 2025-03-14. Confirmed via `openssl s_client` — no more expiry warnings. Closing SLA clock.',
        isInternal: false,
        createdAt: offsetDate(now, -1 * DAY - 20 * HOUR),
      },
      // INC-005
      {
        incidentId: incidentMap[5].id,
        authorId: eng2.id,
        body: 'Reproduced the issue locally. The bug is in the Prisma query in `repositories/incident.repository.js` — the count query uses a separate filter object that drops the priority clause when multiple filters are combined with AND. Fix is straightforward.',
        isInternal: false,
        createdAt: offsetDate(now, -5 * DAY + 5 * HOUR),
      },
      {
        incidentId: incidentMap[5].id,
        authorId: manager1.id,
        body: 'Putting this on hold — the engineering team is in code freeze for the v2.5.0 release this week. Will resume immediately after release. eng2, please add this to the post-release cleanup list.',
        isInternal: false,
        createdAt: offsetDate(now, -3 * DAY),
      },
      // INC-008
      {
        incidentId: incidentMap[8].id,
        authorId: eng3.id,
        body: 'Endpoint taken offline immediately via nginx deny rule. Reviewing access logs for the past 30 days — no external IPs accessed the endpoint. The route was not indexed by any crawlers based on robots.txt exclusion. Patch v2.3.2 deployed and verified.',
        isInternal: false,
        createdAt: offsetDate(now, -7 * DAY + 1 * HOUR),
      },
      {
        incidentId: incidentMap[8].id,
        authorId: manager2.id,
        // Internal: security team post-mortem note
        body: 'Internal: This endpoint was created during sprint 42 and missed the security review checklist. Adding "auth middleware coverage check" to the CI pipeline as a required step. Full post-mortem document in Confluence.',
        isInternal: true,
        createdAt: offsetDate(now, -7 * DAY + 2 * HOUR),
      },
      // INC-009
      {
        incidentId: incidentMap[9].id,
        authorId: eng2.id,
        body: 'BGP config rollback applied at 11:35 UTC. Cross-AZ latency returned to baseline (0.4ms) by 11:40 UTC. Running full connectivity test suite to confirm no residual issues.',
        isInternal: false,
        createdAt: offsetDate(now, -10 * DAY + 3.5 * HOUR),
      },
      {
        incidentId: incidentMap[9].id,
        authorId: manager1.id,
        body: 'Connectivity test suite passed. All services green. Marking resolved. Post-mortem scheduled for Friday.',
        isInternal: false,
        createdAt: offsetDate(now, -10 * DAY + 3.75 * HOUR),
      },
    ],
  });

  console.log('✅  Comments');

  // =========================================================================
  // INCIDENT ATTACHMENTS (metadata only — no actual files in dev seed)
  // =========================================================================

  await prisma.incidentAttachment.createMany({
    skipDuplicates: false,
    data: [
      {
        incidentId: incidentMap[1].id,
        uploadedById: eng1.id,
        filename: 'pg-slow-query-log-2024-01-22.txt',
        storagePath: `uploads/${incidentMap[1].id}/pg-slow-query-log-2024-01-22.txt`,
        mimeType: 'text/plain',
        size: 142_580,
        createdAt: offsetDate(now, -5 * HOUR - 45 * MINUTE),
      },
      {
        incidentId: incidentMap[1].id,
        uploadedById: eng1.id,
        filename: 'explain-analyze-output.txt',
        storagePath: `uploads/${incidentMap[1].id}/explain-analyze-output.txt`,
        mimeType: 'text/plain',
        size: 8_192,
        createdAt: offsetDate(now, -5 * HOUR - 40 * MINUTE),
      },
      {
        incidentId: incidentMap[8].id,
        uploadedById: eng3.id,
        filename: 'nginx-access-log-audit.csv',
        storagePath: `uploads/${incidentMap[8].id}/nginx-access-log-audit.csv`,
        mimeType: 'text/csv',
        size: 2_048_000,
        createdAt: offsetDate(now, -7 * DAY + 90 * MINUTE),
      },
      {
        incidentId: incidentMap[9].id,
        uploadedById: eng2.id,
        filename: 'bgp-route-diff.txt',
        storagePath: `uploads/${incidentMap[9].id}/bgp-route-diff.txt`,
        mimeType: 'text/plain',
        size: 3_412,
        createdAt: offsetDate(now, -10 * DAY + 1 * HOUR),
      },
    ],
  });

  console.log('✅  Attachments');

  // =========================================================================
  // INCIDENT ACTIVITIES (human-readable timeline feed)
  // =========================================================================

  await prisma.incidentActivity.createMany({
    skipDuplicates: false,
    data: [
      // INC-001
      {
        incidentId: incidentMap[1].id, actorId: eng1.id,
        message: 'Alex Rivera opened this incident.',
        eventType: 'INCIDENT_CREATED',
        createdAt: offsetDate(now, -6 * HOUR),
      },
      {
        incidentId: incidentMap[1].id, actorId: manager1.id,
        message: 'Sarah Chen assigned this to Alex Rivera.',
        eventType: 'ASSIGNED',
        metadata: { assigneeId: eng1.id, assigneeName: 'Alex Rivera' },
        createdAt: offsetDate(now, -6 * HOUR + 10 * MINUTE),
      },
      {
        incidentId: incidentMap[1].id, actorId: null,
        message: 'SLA resolution deadline breached. This incident is now overdue.',
        eventType: 'SLA_BREACHED',
        createdAt: offsetDate(now, -2 * HOUR),
      },
      // INC-002
      {
        incidentId: incidentMap[2].id, actorId: manager1.id,
        message: 'Sarah Chen opened this incident.',
        eventType: 'INCIDENT_CREATED',
        createdAt: offsetDate(now, -45 * MINUTE),
      },
      // INC-003
      {
        incidentId: incidentMap[3].id, actorId: admin.id,
        message: 'System Administrator opened this incident.',
        eventType: 'INCIDENT_CREATED',
        createdAt: offsetDate(now, -2 * DAY),
      },
      {
        incidentId: incidentMap[3].id, actorId: manager2.id,
        message: 'James Okonkwo assigned this to Tom Walsh.',
        eventType: 'ASSIGNED',
        metadata: { assigneeId: eng3.id, assigneeName: 'Tom Walsh' },
        createdAt: offsetDate(now, -2 * DAY + 30 * MINUTE),
      },
      {
        incidentId: incidentMap[3].id, actorId: eng3.id,
        message: 'Tom Walsh changed status from OPEN to IN_PROGRESS.',
        eventType: 'STATUS_CHANGED',
        metadata: { from: 'OPEN', to: 'IN_PROGRESS' },
        createdAt: offsetDate(now, -2 * DAY + 35 * MINUTE),
      },
      // INC-005
      {
        incidentId: incidentMap[5].id, actorId: viewer.id,
        message: 'Alice Viewer opened this incident.',
        eventType: 'INCIDENT_CREATED',
        createdAt: offsetDate(now, -5 * DAY),
      },
      {
        incidentId: incidentMap[5].id, actorId: manager1.id,
        message: 'Sarah Chen assigned this to Alex Rivera.',
        eventType: 'ASSIGNED',
        metadata: { assigneeId: eng1.id },
        createdAt: offsetDate(now, -5 * DAY + 2 * HOUR),
      },
      {
        incidentId: incidentMap[5].id, actorId: manager1.id,
        message: 'Sarah Chen reassigned this from Alex Rivera to Priya Sharma.',
        eventType: 'REASSIGNED',
        metadata: { fromId: eng1.id, toId: eng2.id },
        createdAt: offsetDate(now, -5 * DAY + 4 * HOUR),
      },
      {
        incidentId: incidentMap[5].id, actorId: manager1.id,
        message: 'Sarah Chen changed status from IN_PROGRESS to ON_HOLD.',
        eventType: 'STATUS_CHANGED',
        metadata: { from: 'IN_PROGRESS', to: 'ON_HOLD' },
        createdAt: offsetDate(now, -3 * DAY),
      },
      {
        incidentId: incidentMap[5].id, actorId: null,
        message: 'SLA clock paused — incident is ON_HOLD.',
        eventType: 'SLA_PAUSED',
        createdAt: offsetDate(now, -3 * DAY),
      },
      // INC-008
      {
        incidentId: incidentMap[8].id, actorId: manager2.id,
        message: 'James Okonkwo opened this incident.',
        eventType: 'INCIDENT_CREATED',
        createdAt: offsetDate(now, -7 * DAY),
      },
      {
        incidentId: incidentMap[8].id, actorId: manager2.id,
        message: 'James Okonkwo assigned this to Tom Walsh.',
        eventType: 'ASSIGNED',
        metadata: { assigneeId: eng3.id },
        createdAt: offsetDate(now, -7 * DAY + 15 * MINUTE),
      },
      {
        incidentId: incidentMap[8].id, actorId: eng3.id,
        message: 'Tom Walsh changed status from IN_PROGRESS to RESOLVED.',
        eventType: 'STATUS_CHANGED',
        metadata: { from: 'IN_PROGRESS', to: 'RESOLVED' },
        createdAt: offsetDate(now, -7 * DAY + 3.5 * HOUR),
      },
      // INC-009
      {
        incidentId: incidentMap[9].id, actorId: eng2.id,
        message: 'Priya Sharma opened this incident.',
        eventType: 'INCIDENT_CREATED',
        createdAt: offsetDate(now, -10 * DAY),
      },
      {
        incidentId: incidentMap[9].id, actorId: manager1.id,
        message: 'Sarah Chen assigned this to Priya Sharma.',
        eventType: 'ASSIGNED',
        metadata: { assigneeId: eng2.id },
        createdAt: offsetDate(now, -10 * DAY + 5 * MINUTE),
      },
      {
        incidentId: incidentMap[9].id, actorId: eng2.id,
        message: 'Priya Sharma changed status from IN_PROGRESS to RESOLVED.',
        eventType: 'STATUS_CHANGED',
        metadata: { from: 'IN_PROGRESS', to: 'RESOLVED' },
        createdAt: offsetDate(now, -10 * DAY + 3.5 * HOUR),
      },
      {
        incidentId: incidentMap[9].id, actorId: manager1.id,
        message: 'Sarah Chen changed status from RESOLVED to CLOSED.',
        eventType: 'STATUS_CHANGED',
        metadata: { from: 'RESOLVED', to: 'CLOSED' },
        createdAt: offsetDate(now, -9 * DAY),
      },
    ],
  });

  console.log('✅  Activity feed entries');

  // =========================================================================
  // INCIDENT AUDIT LOGS (structured, immutable compliance log)
  // =========================================================================

  await prisma.incidentAuditLog.createMany({
    skipDuplicates: false,
    data: [
      // INC-001 created
      {
        incidentId: incidentMap[1].id, actorId: eng1.id,
        action: 'INCIDENT_CREATED',
        newValue: JSON.stringify({ status: 'OPEN', priority: 'CRITICAL' }),
        createdAt: offsetDate(now, -6 * HOUR),
      },
      // INC-001 assigned
      {
        incidentId: incidentMap[1].id, actorId: manager1.id,
        action: 'ASSIGNED',
        fieldName: 'assigneeId',
        oldValue: null,
        newValue: eng1.id,
        createdAt: offsetDate(now, -6 * HOUR + 10 * MINUTE),
      },
      // INC-001 SLA breached
      {
        incidentId: incidentMap[1].id, actorId: admin.id,
        action: 'SLA_BREACHED',
        newValue: JSON.stringify({ slaBreachAt: offsetDate(now, -2 * HOUR) }),
        createdAt: offsetDate(now, -2 * HOUR),
      },
      // INC-003 status → IN_PROGRESS
      {
        incidentId: incidentMap[3].id, actorId: eng3.id,
        action: 'STATUS_CHANGED',
        fieldName: 'status',
        oldValue: 'OPEN',
        newValue: 'IN_PROGRESS',
        createdAt: offsetDate(now, -2 * DAY + 35 * MINUTE),
      },
      // INC-005 reassignment
      {
        incidentId: incidentMap[5].id, actorId: manager1.id,
        action: 'REASSIGNED',
        fieldName: 'assigneeId',
        oldValue: eng1.id,
        newValue: eng2.id,
        createdAt: offsetDate(now, -5 * DAY + 4 * HOUR),
      },
      // INC-005 status → ON_HOLD
      {
        incidentId: incidentMap[5].id, actorId: manager1.id,
        action: 'STATUS_CHANGED',
        fieldName: 'status',
        oldValue: 'IN_PROGRESS',
        newValue: 'ON_HOLD',
        createdAt: offsetDate(now, -3 * DAY),
      },
      // INC-005 SLA paused
      {
        incidentId: incidentMap[5].id, actorId: admin.id,
        action: 'SLA_PAUSED',
        newValue: JSON.stringify({ slaHoldStartedAt: offsetDate(now, -3 * DAY) }),
        createdAt: offsetDate(now, -3 * DAY),
      },
      // INC-008 status → RESOLVED
      {
        incidentId: incidentMap[8].id, actorId: eng3.id,
        action: 'STATUS_CHANGED',
        fieldName: 'status',
        oldValue: 'IN_PROGRESS',
        newValue: 'RESOLVED',
        createdAt: offsetDate(now, -7 * DAY + 3.5 * HOUR),
      },
      // INC-009 status → CLOSED
      {
        incidentId: incidentMap[9].id, actorId: manager1.id,
        action: 'STATUS_CHANGED',
        fieldName: 'status',
        oldValue: 'RESOLVED',
        newValue: 'CLOSED',
        createdAt: offsetDate(now, -9 * DAY),
      },
      // User role audit: admin changed viewer's role (global action — no incidentId)
      {
        incidentId: null, actorId: admin.id,
        action: 'USER_ROLE_CHANGED',
        fieldName: 'role',
        oldValue: 'SUPPORT_ENGINEER',
        newValue: 'VIEWER',
        metadata: { targetUserId: viewer.id, targetEmail: viewer.email },
        createdAt: offsetDate(now, -14 * DAY),
      },
    ],
  });

  console.log('✅  Audit log entries');

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================

  await prisma.notification.createMany({
    skipDuplicates: false,
    data: [
      // eng1: assigned to INC-001
      {
        userId: eng1.id,
        type: 'INCIDENT_ASSIGNED',
        title: 'You have been assigned INC-001',
        body: 'Production database experiencing critical latency spike has been assigned to you.',
        referenceId: incidentMap[1].id,
        read: true,
        readAt: offsetDate(now, -5 * HOUR - 55 * MINUTE),
        createdAt: offsetDate(now, -6 * HOUR + 10 * MINUTE),
      },
      // eng1: SLA breached on INC-001
      {
        userId: eng1.id,
        type: 'SLA_BREACHED',
        title: 'SLA breached on INC-001',
        body: 'The resolution SLA for INC-001 has been breached. Immediate action required.',
        referenceId: incidentMap[1].id,
        read: false,
        createdAt: offsetDate(now, -2 * HOUR),
      },
      // manager1: SLA breached on INC-001
      {
        userId: manager1.id,
        type: 'SLA_BREACHED',
        title: 'SLA breached on INC-001',
        body: 'The resolution SLA for "Production database experiencing critical latency spike" has been breached.',
        referenceId: incidentMap[1].id,
        read: false,
        createdAt: offsetDate(now, -2 * HOUR),
      },
      // manager1: SLA at risk on INC-002
      {
        userId: manager1.id,
        type: 'SLA_AT_RISK',
        title: 'SLA at risk: INC-002',
        body: 'Less than 15 minutes remain on the SLA for "Authentication service returning 503".',
        referenceId: incidentMap[2].id,
        read: false,
        createdAt: offsetDate(now, -30 * MINUTE),
      },
      // eng3: assigned to INC-003
      {
        userId: eng3.id,
        type: 'INCIDENT_ASSIGNED',
        title: 'You have been assigned INC-003',
        body: 'TLS certificate auto-renewal failure on api.incidenthub.dev has been assigned to you.',
        referenceId: incidentMap[3].id,
        read: true,
        readAt: offsetDate(now, -2 * DAY + 45 * MINUTE),
        createdAt: offsetDate(now, -2 * DAY + 30 * MINUTE),
      },
      // eng2: reassigned to INC-005
      {
        userId: eng2.id,
        type: 'INCIDENT_ASSIGNED',
        title: 'INC-005 has been reassigned to you',
        body: 'Pagination returning incorrect total count on incident list endpoint has been reassigned to you.',
        referenceId: incidentMap[5].id,
        read: true,
        readAt: offsetDate(now, -5 * DAY + 4.5 * HOUR),
        createdAt: offsetDate(now, -5 * DAY + 4 * HOUR),
      },
      // viewer: incident they reported (INC-005) updated
      {
        userId: viewer.id,
        type: 'INCIDENT_UPDATED',
        title: 'INC-005 has been updated',
        body: 'The status of "Pagination returning incorrect total count" was changed to ON_HOLD.',
        referenceId: incidentMap[5].id,
        read: false,
        createdAt: offsetDate(now, -3 * DAY),
      },
      // eng3: INC-008 resolved
      {
        userId: eng3.id,
        type: 'INCIDENT_RESOLVED',
        title: 'INC-008 marked as resolved',
        body: 'The incident "Security: exposed internal admin endpoint" has been marked as resolved.',
        referenceId: incidentMap[8].id,
        read: true,
        readAt: offsetDate(now, -7 * DAY + 4 * HOUR),
        createdAt: offsetDate(now, -7 * DAY + 3.5 * HOUR),
      },
      // manager1: INC-009 closed
      {
        userId: manager1.id,
        type: 'INCIDENT_UPDATED',
        title: 'INC-009 closed',
        body: 'The incident "Network packet loss between availability zones" has been closed.',
        referenceId: incidentMap[9].id,
        read: true,
        readAt: offsetDate(now, -9 * DAY + 30 * MINUTE),
        createdAt: offsetDate(now, -9 * DAY),
      },
      // INC-004: sla breached — notify manager1
      {
        userId: manager1.id,
        type: 'SLA_BREACHED',
        title: 'SLA breached on INC-004',
        body: 'The resolution SLA for "Memory leak in notification-service" has been breached.',
        referenceId: incidentMap[4].id,
        read: false,
        createdAt: offsetDate(now, -10 * HOUR),
      },
    ],
  });

  console.log('✅  Notifications');

  // =========================================================================
  // NOTIFICATION PREFERENCES
  // Create default preferences for every user × every notification type.
  // Engineers and managers get in-app for all types.
  // Managers also get email for SLA_BREACHED and INCIDENT_ESCALATED.
  // =========================================================================

  const allNotifTypes = [
    'INCIDENT_ASSIGNED',
    'INCIDENT_UPDATED',
    'INCIDENT_RESOLVED',
    'COMMENT_ADDED',
    'SLA_AT_RISK',
    'SLA_BREACHED',
    'INCIDENT_ESCALATED',
  ];

  const allUsers = [admin, manager1, manager2, eng1, eng2, eng3, viewer];

  /**
   * Build preference rows: every user gets in-app enabled for all types.
   * Managers and Admin also get email for SLA_BREACHED + INCIDENT_ESCALATED.
   */
  const prefData = [];
  for (const user of allUsers) {
    for (const type of allNotifTypes) {
      const emailEnabled =
        ['ADMIN', 'MANAGER'].includes(user.role) &&
        ['SLA_BREACHED', 'INCIDENT_ESCALATED', 'SLA_AT_RISK'].includes(type);

      prefData.push({
        userId: user.id,
        type,
        inApp: true,
        email: emailEnabled,
      });
    }
  }

  // createMany with skipDuplicates handles repeated seed runs safely
  await prisma.notificationPreference.createMany({
    data: prefData,
    skipDuplicates: true,
  });

  console.log('✅  Notification preferences');

  // =========================================================================
  // DONE
  // =========================================================================

  console.log('\n🎉 Seed complete!\n');
  console.log('Demo accounts:');
  console.log('  ┌──────────────────────────────────────┬───────────────────┬──────────┐');
  console.log('  │ Email                                │ Password          │ Role     │');
  console.log('  ├──────────────────────────────────────┼───────────────────┼──────────┤');
  console.log('  │ admin@incidenthub.dev                │ Admin1234!        │ ADMIN    │');
  console.log('  │ sarah.manager@incidenthub.dev        │ Manager1234!      │ MANAGER  │');
  console.log('  │ james.manager@incidenthub.dev        │ Manager1234!      │ MANAGER  │');
  console.log('  │ alex.engineer@incidenthub.dev        │ Engineer1234!     │ SUPPORT_ENGINEER │');
  console.log('  │ priya.engineer@incidenthub.dev       │ Engineer1234!     │ SUPPORT_ENGINEER │');
  console.log('  │ tom.engineer@incidenthub.dev         │ Engineer1234!     │ SUPPORT_ENGINEER │');
  console.log('  │ viewer@incidenthub.dev               │ Viewer1234!       │ VIEWER   │');
  console.log('  └──────────────────────────────────────┴───────────────────┴──────────┘');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
