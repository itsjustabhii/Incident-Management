/**
 * @file User management routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { updateUserSchema } from '../validators/user.validator.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

router.use(authenticate);

/** GET /api/v1/users — List all users (ADMIN, MANAGER) */
router.get('/', authorize('ADMIN', 'MANAGER'), userController.list);

/** GET /api/v1/users/:id */
router.get('/:id', userController.getById);

/** PATCH /api/v1/users/:id */
router.patch('/:id', validate(updateUserSchema), userController.update);

/** DELETE /api/v1/users/:id — Deactivate a user (ADMIN only) */
router.delete('/:id', authorize('ADMIN'), userController.deactivate);

export default router;
