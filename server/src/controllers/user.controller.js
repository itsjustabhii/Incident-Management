/**
 * @file User management controller
 */

import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import * as userService from '../services/user.service.js';

export const list = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { users, total } = await userService.listUsers(req.query, pagination);
  sendSuccess(res, { users }, 200, buildPaginationMeta(total, pagination.page, pagination.pageSize));
});

export const getById = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  sendSuccess(res, { user });
});

export const update = catchAsync(async (req, res) => {
  // The service enforces that only ADMIN users can change roles
  const user = await userService.updateUser(req.params.id, req.body, req.user);
  sendSuccess(res, { user });
});

export const deactivate = catchAsync(async (req, res) => {
  await userService.deactivateUser(req.params.id, req.user);
  sendSuccess(res, { message: 'User deactivated successfully' });
});
