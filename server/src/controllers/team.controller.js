/**
 * @file Team management controller
 */

import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import * as teamService from '../services/team.service.js';

export const list = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { teams, total } = await teamService.listTeams(pagination);
  sendSuccess(res, { teams }, 200, buildPaginationMeta(total, pagination.page, pagination.pageSize));
});

export const create = catchAsync(async (req, res) => {
  const team = await teamService.createTeam(req.body, req.user);
  sendSuccess(res, { team }, 201);
});

export const getById = catchAsync(async (req, res) => {
  const team = await teamService.getTeamById(req.params.id);
  sendSuccess(res, { team });
});

export const update = catchAsync(async (req, res) => {
  const team = await teamService.updateTeam(req.params.id, req.body);
  sendSuccess(res, { team });
});

export const remove = catchAsync(async (req, res) => {
  await teamService.deleteTeam(req.params.id);
  sendSuccess(res, { message: 'Team deleted' });
});

export const addMember = catchAsync(async (req, res) => {
  const member = await teamService.addMember(req.params.id, req.body);
  sendSuccess(res, { member }, 201);
});

export const removeMember = catchAsync(async (req, res) => {
  await teamService.removeMember(req.params.id, req.params.userId);
  sendSuccess(res, { message: 'Member removed from team' });
});
