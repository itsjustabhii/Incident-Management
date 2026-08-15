/**
 * @file Authorization (RBAC) middleware
 * @description Factory functions that return Express middleware enforcing
 * role-based access control.  Authorization is always checked server-side
 * from the JWT payload — never from client-supplied role claims.
 */

import { AppError } from '../utils/AppError.js';
import { ROLE_HIERARCHY } from '../constants/roles.js';

/**
 * Creates middleware that restricts access to users whose role is in the
 * provided allowlist.
 *
 * @param {...string} allowedRoles - One or more roles permitted to access the route
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.delete('/incidents/:id', authenticate, authorize('ADMIN', 'MANAGER'), controller.delete);
 */
export const authorize = (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
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
 * @param {string} minimumRole - Minimum required role
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.get('/dashboard', authenticate, authorizeMinRole('MANAGER'), controller.stats);
 */
export const authorizeMinRole = (minimumRole) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    const userIndex = ROLE_HIERARCHY.indexOf(req.user.role);
    const requiredIndex = ROLE_HIERARCHY.indexOf(minimumRole);

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
