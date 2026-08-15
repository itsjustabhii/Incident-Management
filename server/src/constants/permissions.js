/**
 * @file Permission constants
 * @description Explicit, named permissions used by requirePermission() middleware
 * and service-layer authorization checks.  Every action that can be gated is
 * declared here as a string constant so that permission names are never magic
 * strings scattered across the codebase.
 *
 * Security model:
 *   • Backend is the authoritative security boundary.  Frontend visibility
 *     (hiding buttons, routes) is a UX convenience only.
 *   • Every mutation (POST / PATCH / DELETE) is independently authorized via
 *     requirePermission() or explicit service-layer role checks.
 *   • Permissions are assigned to roles — they are NOT configurable per user.
 *     Fine-grained per-user overrides are a future concern.
 *   • Unrecognized permissions always deny access (fail-closed).
 */

import { USER_ROLE } from './roles.js';

// ── Permission name constants ──────────────────────────────────────────────────

export const PERMISSION = Object.freeze({
  // ── User management ───────────────────────────────────────────────────────
  /** Create, deactivate, and reactivate user accounts */
  MANAGE_USERS: 'manage:users',
  /** Change a user's role */
  MANAGE_ROLES: 'manage:roles',
  /** Read the full user list */
  READ_USERS: 'read:users',

  // ── SLA policy management ─────────────────────────────────────────────────
  /** Create / edit / delete SLA policies */
  MANAGE_SLA_POLICIES: 'manage:sla_policies',

  // ── Incident operations ───────────────────────────────────────────────────
  /** List all incidents across all teams / assignees */
  READ_ALL_INCIDENTS: 'read:all_incidents',
  /** List only incidents the user is involved with (assigned / reported) */
  READ_OWN_INCIDENTS: 'read:own_incidents',
  /** Create new incidents */
  CREATE_INCIDENTS: 'create:incidents',
  /** Edit incident title, description, category */
  EDIT_INCIDENTS: 'edit:incidents',
  /** Assign or reassign an incident to an engineer */
  ASSIGN_INCIDENTS: 'assign:incidents',
  /** Change incident status (open → in-progress → resolved, etc.) */
  CHANGE_INCIDENT_STATUS: 'change:incident_status',
  /** Change incident priority */
  CHANGE_INCIDENT_PRIORITY: 'change:incident_priority',
  /** Close or hard-delete incidents */
  CLOSE_INCIDENTS: 'close:incidents',
  /** Resolve incidents */
  RESOLVE_INCIDENTS: 'resolve:incidents',

  // ── Comments ──────────────────────────────────────────────────────────────
  /** Add a comment on any incident */
  ADD_COMMENTS: 'add:comments',
  /** Edit a comment (own comment; ADMIN can edit any) */
  EDIT_COMMENTS: 'edit:comments',
  /** Delete a comment (own comment; ADMIN can delete any) */
  DELETE_COMMENTS: 'delete:comments',

  // ── Attachments ───────────────────────────────────────────────────────────
  /** Upload attachments to an incident */
  UPLOAD_ATTACHMENTS: 'upload:attachments',
  /** Delete attachments (own; ADMIN can delete any) */
  DELETE_ATTACHMENTS: 'delete:attachments',

  // ── Dashboards ────────────────────────────────────────────────────────────
  /** Access the main dashboard stats endpoint */
  VIEW_DASHBOARD: 'view:dashboard',
  /** Access SLA metrics (MANAGER and above) */
  VIEW_SLA_METRICS: 'view:sla_metrics',
  /** Access workload distribution (MANAGER and above) */
  VIEW_WORKLOAD: 'view:workload',

  // ── Audit logs ────────────────────────────────────────────────────────────
  /** Access incident and system-level audit logs */
  VIEW_AUDIT_LOGS: 'view:audit_logs',
});

// ── Role → Permission mapping ──────────────────────────────────────────────────
//
// This is the single authoritative source for what each role may do.
// Adding a new permission:
//   1. Declare it in PERMISSION above.
//   2. Add it to the appropriate role sets below.
//   3. Use requirePermission(PERMISSION.YOUR_PERMISSION) on the route.
//
// Security principle: permissions are deny-by-default — a role only receives
// the permissions explicitly listed here.

export const ROLE_PERMISSIONS = Object.freeze({
  /**
   * ADMIN — Full access.
   * Can do everything any other role can do, plus user/role management
   * and access to the full audit log.
   */
  [USER_ROLE.ADMIN]: new Set([
    PERMISSION.MANAGE_USERS,
    PERMISSION.MANAGE_ROLES,
    PERMISSION.READ_USERS,
    PERMISSION.MANAGE_SLA_POLICIES,
    PERMISSION.READ_ALL_INCIDENTS,
    PERMISSION.CREATE_INCIDENTS,
    PERMISSION.EDIT_INCIDENTS,
    PERMISSION.ASSIGN_INCIDENTS,
    PERMISSION.CHANGE_INCIDENT_STATUS,
    PERMISSION.CHANGE_INCIDENT_PRIORITY,
    PERMISSION.CLOSE_INCIDENTS,
    PERMISSION.RESOLVE_INCIDENTS,
    PERMISSION.ADD_COMMENTS,
    PERMISSION.EDIT_COMMENTS,
    PERMISSION.DELETE_COMMENTS,
    PERMISSION.UPLOAD_ATTACHMENTS,
    PERMISSION.DELETE_ATTACHMENTS,
    PERMISSION.VIEW_DASHBOARD,
    PERMISSION.VIEW_SLA_METRICS,
    PERMISSION.VIEW_WORKLOAD,
    PERMISSION.VIEW_AUDIT_LOGS,
  ]),

  /**
   * MANAGER — Team oversight.
   * Can create, edit, assign, prioritize, and close incidents for their team.
   * Can access all dashboards and workload views. Cannot manage users/roles.
   */
  [USER_ROLE.MANAGER]: new Set([
    PERMISSION.READ_USERS,
    PERMISSION.READ_ALL_INCIDENTS,
    PERMISSION.CREATE_INCIDENTS,
    PERMISSION.EDIT_INCIDENTS,
    PERMISSION.ASSIGN_INCIDENTS,
    PERMISSION.CHANGE_INCIDENT_STATUS,
    PERMISSION.CHANGE_INCIDENT_PRIORITY,
    PERMISSION.CLOSE_INCIDENTS,
    PERMISSION.RESOLVE_INCIDENTS,
    PERMISSION.ADD_COMMENTS,
    PERMISSION.EDIT_COMMENTS,
    PERMISSION.DELETE_COMMENTS,
    PERMISSION.UPLOAD_ATTACHMENTS,
    PERMISSION.DELETE_ATTACHMENTS,
    PERMISSION.VIEW_DASHBOARD,
    PERMISSION.VIEW_SLA_METRICS,
    PERMISSION.VIEW_WORKLOAD,
    PERMISSION.VIEW_AUDIT_LOGS,
  ]),

  /**
   * SUPPORT_ENGINEER — Frontline responder.
   * Can view and update incidents they are assigned to or have reported.
   * Can add comments and upload attachments. Cannot assign or change priority.
   */
  [USER_ROLE.SUPPORT_ENGINEER]: new Set([
    PERMISSION.READ_OWN_INCIDENTS,
    PERMISSION.CREATE_INCIDENTS,
    PERMISSION.CHANGE_INCIDENT_STATUS,
    PERMISSION.RESOLVE_INCIDENTS,
    PERMISSION.ADD_COMMENTS,
    PERMISSION.EDIT_COMMENTS,
    PERMISSION.DELETE_COMMENTS,
    PERMISSION.UPLOAD_ATTACHMENTS,
    PERMISSION.DELETE_ATTACHMENTS,
    PERMISSION.VIEW_DASHBOARD,
  ]),

  /**
   * VIEWER — Read-only.
   * Can only view permitted incidents and basic dashboard stats.
   * Cannot perform any mutations.
   */
  [USER_ROLE.VIEWER]: new Set([
    PERMISSION.READ_OWN_INCIDENTS,
    PERMISSION.VIEW_DASHBOARD,
  ]),
});

/**
 * Returns true if the given role has the specified permission.
 * Unrecognized roles or permissions always return false (fail-closed).
 *
 * @param {string} role - The user's role from the verified JWT
 * @param {string} permission - A PERMISSION constant value
 * @returns {boolean}
 *
 * @example
 * if (!hasPermission(user.role, PERMISSION.ASSIGN_INCIDENTS)) {
 *   throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
 * }
 */
export function hasPermission(role, permission) {
  // Fail-closed: unknown role or permission = no access
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(permission);
}
