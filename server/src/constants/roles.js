/**
 * @file User role constants
 * @description RBAC role definitions for the platform.
 * Server-side authorization middleware uses these values to gate
 * endpoint access. The role is never read from client input — only
 * from the verified JWT payload.
 */

export const USER_ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  ENGINEER: 'ENGINEER',
  VIEWER: 'VIEWER',
});

/**
 * Ordered role hierarchy (highest privilege first).
 * Used when a route requires "at least MANAGER" level access.
 */
export const ROLE_HIERARCHY = [
  USER_ROLE.ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.ENGINEER,
  USER_ROLE.VIEWER,
];

/**
 * Returns true if the given role has at least the required privilege level.
 *
 * @param {string} userRole - The user's actual role from the JWT
 * @param {string} requiredRole - The minimum role required
 * @returns {boolean}
 */
export function hasMinimumRole(userRole, requiredRole) {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  // If either role is unrecognized, deny access
  if (userIndex === -1 || requiredIndex === -1) return false;
  return userIndex <= requiredIndex;
}
