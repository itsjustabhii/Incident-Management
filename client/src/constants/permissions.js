/**
 * @file Client-side permission constants
 * @description Mirrors the server-side permission names for use in role-aware
 * UI components (RoleGuard, Sidebar nav visibility, button disable states).
 *
 * IMPORTANT SECURITY NOTE:
 * These constants are used ONLY for UX purposes (hiding buttons, gating routes).
 * They are NOT a security boundary. Every action is independently authorized
 * on the backend. Frontend permission checks can be bypassed by a determined
 * attacker — the server MUST NOT trust them.
 */

import { USER_ROLE } from './index.js';

export const PERMISSION = Object.freeze({
  MANAGE_USERS: 'manage:users',
  MANAGE_ROLES: 'manage:roles',
  READ_USERS: 'read:users',
  MANAGE_SLA_POLICIES: 'manage:sla_policies',
  READ_ALL_INCIDENTS: 'read:all_incidents',
  READ_OWN_INCIDENTS: 'read:own_incidents',
  CREATE_INCIDENTS: 'create:incidents',
  EDIT_INCIDENTS: 'edit:incidents',
  ASSIGN_INCIDENTS: 'assign:incidents',
  CHANGE_INCIDENT_STATUS: 'change:incident_status',
  CHANGE_INCIDENT_PRIORITY: 'change:incident_priority',
  CLOSE_INCIDENTS: 'close:incidents',
  RESOLVE_INCIDENTS: 'resolve:incidents',
  ADD_COMMENTS: 'add:comments',
  EDIT_COMMENTS: 'edit:comments',
  DELETE_COMMENTS: 'delete:comments',
  UPLOAD_ATTACHMENTS: 'upload:attachments',
  DELETE_ATTACHMENTS: 'delete:attachments',
  VIEW_DASHBOARD: 'view:dashboard',
  VIEW_SLA_METRICS: 'view:sla_metrics',
  VIEW_WORKLOAD: 'view:workload',
  VIEW_AUDIT_LOGS: 'view:audit_logs',
});

/**
 * Maps each role to its set of permissions.
 * Must stay in sync with server/src/constants/permissions.js.
 * Used only for UX gating — never for security decisions.
 */
const ROLE_PERMISSIONS = {
  [USER_ROLE.ADMIN]: new Set(Object.values(PERMISSION)),

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

  [USER_ROLE.VIEWER]: new Set([
    PERMISSION.READ_OWN_INCIDENTS,
    PERMISSION.VIEW_DASHBOARD,
  ]),
};

/**
 * Returns true if the given role has the specified permission.
 * UX use only — do not use for any security decision.
 *
 * @param {string|null} role - The user's role from Redux auth state
 * @param {string} permission - A PERMISSION constant value
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
