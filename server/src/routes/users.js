/**
 * @file User management routes
 *
 * Authorization matrix:
 *   GET  /         — ADMIN, MANAGER (manage their teams; need to see user list)
 *   GET  /:id      — Any authenticated user (view profiles, needed for assignment UI)
 *   PATCH /:id     — Own profile (any user) OR role change (ADMIN only; enforced in service)
 *   DELETE /:id    — ADMIN only (deactivation is a privileged irreversible action)
 *
 * Additional field-level restriction in user.service.js:
 *   • Only ADMIN can change the 'role' field.
 *   • Non-admin users can only update their own profile (displayName, avatarUrl).
 *   • A user cannot deactivate their own account.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize, requirePermission } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { updateUserSchema } from '../validators/user.validator.js';
import * as userController from '../controllers/user.controller.js';
import { PERMISSION } from '../constants/permissions.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/users
 * Returns the full user list.  Only ADMIN and MANAGER need this —
 * e.g. for the assignment dropdown or the admin user-management page.
 */
router.get('/', requirePermission(PERMISSION.READ_USERS), userController.list);

/**
 * GET /api/v1/users/:id
 * Returns a single user's profile.  Any authenticated user can view profiles
 * (needed to show reporter/assignee details on incident cards).
 */
router.get('/:id', userController.getById);

/**
 * PATCH /api/v1/users/:id
 * Updates a user's profile.
 * The service layer enforces that non-ADMINs can only update their own profile
 * and cannot change the role field — this is a defense-in-depth check.
 */
router.patch('/:id', validate(updateUserSchema), userController.update);

/**
 * DELETE /api/v1/users/:id
 * Deactivates a user account (soft-delete via active=false).
 * ADMIN only — this is a privileged, destructive operation.
 */
router.delete('/:id', authorize('ADMIN'), userController.deactivate);

export default router;
