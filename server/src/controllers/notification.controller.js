/**
 * @file Notification controller
 */

import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import * as notificationService from '../services/notification.service.js';

/** GET /api/v1/notifications — Current user's notifications */
export const list = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { notifications, total, unreadCount } = await notificationService.listNotifications(
    req.user.id,
    pagination,
  );
  sendSuccess(
    res,
    { notifications, unreadCount },
    200,
    buildPaginationMeta(total, pagination.page, pagination.pageSize),
  );
});

/** PATCH /api/v1/notifications/:id/read */
export const markRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.id, req.user.id);
  sendSuccess(res, { notification });
});

/** PATCH /api/v1/notifications/read-all */
export const markAllRead = catchAsync(async (req, res) => {
  const count = await notificationService.markAllAsRead(req.user.id);
  sendSuccess(res, { message: `${count} notifications marked as read` });
});
