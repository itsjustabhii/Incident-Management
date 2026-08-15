/**
 * @file Authorization (RBAC) middleware
 * @description Factory functions that return Express middleware enforcing
 * role-based access control.  Authorization is always checked server-side
 * from the JWT payload — never from client-supplied role claims.
 *
 * Three levels of authorization are provided:
 *   1. authorize(...roles)       — allowlist of specific roles
 *   2. authorizeMinRole(role)    — role hierarchy threshold
 *   3. requirePermission(perm)   — explicit named permission check
 *
 * The requirePermission() approach is preferred because it is explicit about
 * what each role may do, makes auditing straightforward, and avoids the
 * implicit coupling of "role name implies set of actions" that role-only checks
 * create.
 *
 * Security note: Authentication (authenticate middleware) MUST run before any
 * of these authorization checks.  These functions trust that req.user is already
 * populated with a verified identity.  If req.user is absent, they return 401.
 */

import { AppError } from '../utils/AppError.js';
import { ROLE_HIERARCHY } from '../constants/roles.js';
import { hasPermission } from '../constants/permissions.js';

/**
 * Creates middleware that restricts access to users whose role is in the
 * provided allowlist.
 *
 * Prefer requirePermission() for new routes.  Use authorize() when you need
 * to gate on a specific role identity rather than a named action.
 *
 * @param {...string} allowedRoles - One or more roles permitted to access the route
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.delete('/incidents/:id', authenticate, authorize('ADMIN'), controller.delete);
 */
export const authorize = (...allowedRoles) =>
  (req, _res, next) => {
    // Guard: authenticate() must have run first and populated req.user
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    // Check that the user's role is in the explicit allowlist
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied — this action requires one of: ${allowedRoles.join(', ')}`,
          403,
          'FORBIDDEN',
        ),
      );
    }
    next();
  };

/**
 * Creates middleware that grants access to users whose role is at or above
 * the minimum required role in the role hierarchy.
 *
 * Hierarchy (highest → lowest): ADMIN > MANAGER > SUPPORT_ENGINEER > VIEWER
 *
 * @param {string} minimumRole - Minimum required role (e.g. 'MANAGER')
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.get('/dashboard/workload', authenticate, authorizeMinRole('MANAGER'), ctrl.workload);
 */
export const authorizeMinRole = (minimumRole) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    const userIndex = ROLE_HIERARCHY.indexOf(req.user.role);
    const requiredIndex = ROLE_HIERARCHY.indexOf(minimumRole);

    // Both indices must be valid — unknown roles are denied (fail-closed)
    if (userIndex === -1 || requiredIndex === -1 || userIndex > requiredIndex) {
      return next(
        new AppError(
          `Access denied — requires at least ${minimumRole} role`,
          403,
          'FORBIDDEN',
        ),
      );
    }
    next();
  };

/**
 * Creates middleware that verifies the requesting user has a specific named
 * permission.  Permission→role mappings are defined in constants/permissions.js.
 *
 * This is the preferred authorization check for new routes because:
 *   • Named permissions (e.g. 'assign:incidents') are self-documenting.
 *   • Adding a role does not require auditing every authorize() call.
 *   • Permission sets can evolve without changing route middleware.
 *
 * @param {string} permission - A PERMISSION constant value (e.g. PERMISSION.ASSIGN_INCIDENTS)
 * @returns {import('express').RequestHandler}
 *
 * @example
 * import { PERMISSION } from '../constants/permissions.js';
 * router.post('/incidents/:id/assign', authenticate, requirePermission(PERMISSION.ASSIGN_INCIDENTS), ctrl.assign);
 */
export const requirePermission = (permission) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    // hasPermission() is fail-closed: unknown role or permission → false
    if (!hasPermission(req.user.role, permission)) {
      return next(
        new AppError(
          `Access denied — you do not have the '${permission}' permission`,
          403,
          'FORBIDDEN',
        ),
      );
    }
    next();
  };

/**
 * Middleware that blocks VIEWERs from any mutation (POST/PUT/PATCH/DELETE).
 * Used as a blanket guard on routes that should be fully read-only for VIEWERs.
 *
 * This is complementary to requirePermission() — apply this first on a router
 * to catch any mutation methods that may not have explicit permission checks.
 *
 * @returns {import('express').RequestHandler}
 */
export const blockViewer = (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }
  const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (req.user.role === 'VIEWER' && MUTATING_METHODS.includes(req.method)) {
    return next(
      new AppError(
        'Viewers have read-only access — this action is not permitted',
        403,
        'FORBIDDEN',
      ),
    );
  }
  next();
};
