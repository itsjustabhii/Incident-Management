/**
 * @file Notification routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

router.use(authenticate);

/** GET /api/v1/notifications — List notifications for the current user */
router.get('/', notificationController.list);

/** PATCH /api/v1/notifications/:id/read — Mark a single notification as read */
router.patch('/:id/read', notificationController.markRead);

/** PATCH /api/v1/notifications/read-all — Mark all notifications as read */
router.patch('/read-all', notificationController.markAllRead);

export default router;
