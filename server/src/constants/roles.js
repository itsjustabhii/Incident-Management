/**
 * @file User role constants
 * @description RBAC role definitions for the platform.
 * Server-side authorization middleware uses these values to gate endpoint access.
 * The role is NEVER read from client input — it is always sourced from the
 * verified JWT payload, which is signed by the server at login time.
 *
 * Role summary:
 *   ADMIN            — Full platform access, user/role management, audit logs
 *   MANAGER          — Team incident management, dashboards, workload, assignments
 *   SUPPORT_ENGINEER — Work on assigned incidents, add comments, upload attachments
 *   VIEWER           — Read-only access to permitted incidents and dashboards
 */

export const USER_ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SUPPORT_ENGINEER: 'SUPPORT_ENGINEER',
  VIEWER: 'VIEWER',
});

/**
 * Ordered role hierarchy (highest privilege first).
 * Used by authorizeMinRole() to grant access to users at or above a threshold.
 *
 * ADMIN > MANAGER > SUPPORT_ENGINEER > VIEWER
 */
export const ROLE_HIERARCHY = [
  USER_ROLE.ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.SUPPORT_ENGINEER,
  USER_ROLE.VIEWER,
];

/**
 * Returns true if the given role has at least the required privilege level.
 * Both roles must be recognized; unrecognized roles always return false to
 * prevent privilege escalation via unexpected role strings.
 *
 * @param {string} userRole - The user's actual role from the JWT
 * @param {string} requiredRole - The minimum role required
 * @returns {boolean}
 */
export function hasMinimumRole(userRole, requiredRole) {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  // Deny if either role string is unrecognized — prevents unknown role bypass
  if (userIndex === -1 || requiredIndex === -1) return false;
  return userIndex <= requiredIndex;
}
