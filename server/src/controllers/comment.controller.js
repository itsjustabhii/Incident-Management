/**
 * @file Comment controller
 */

import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import * as commentService from '../services/comment.service.js';

/** GET /api/v1/incidents/:incidentId/comments */
export const list = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { comments, total } = await commentService.listComments(
    req.params.incidentId,
    pagination,
    req.user,
  );
  sendSuccess(res, { comments }, 200, buildPaginationMeta(total, pagination.page, pagination.pageSize));
});

/** POST /api/v1/incidents/:incidentId/comments */
export const create = catchAsync(async (req, res) => {
  const comment = await commentService.createComment(req.params.incidentId, req.body, req.user);
  sendSuccess(res, { comment }, 201);
});

/** PATCH /api/v1/incidents/:incidentId/comments/:commentId */
export const update = catchAsync(async (req, res) => {
  const comment = await commentService.updateComment(
    req.params.commentId,
    req.body,
    req.user,
  );
  sendSuccess(res, { comment });
});

/** DELETE /api/v1/incidents/:incidentId/comments/:commentId */
export const remove = catchAsync(async (req, res) => {
  await commentService.deleteComment(req.params.commentId, req.user);
  sendSuccess(res, { message: 'Comment deleted' });
});
