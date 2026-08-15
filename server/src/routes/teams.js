/**
 * @file Team management routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createTeamSchema,
  updateTeamSchema,
  addMemberSchema,
} from '../validators/team.validator.js';
import * as teamController from '../controllers/team.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', teamController.list);
router.post('/', authorize('ADMIN', 'MANAGER'), validate(createTeamSchema), teamController.create);
router.get('/:id', teamController.getById);
router.patch('/:id', authorize('ADMIN', 'MANAGER'), validate(updateTeamSchema), teamController.update);
router.delete('/:id', authorize('ADMIN'), teamController.remove);

/** POST /api/v1/teams/:id/members — Add a user to a team */
router.post('/:id/members', authorize('ADMIN', 'MANAGER'), validate(addMemberSchema), teamController.addMember);

/** DELETE /api/v1/teams/:id/members/:userId — Remove a user from a team */
router.delete('/:id/members/:userId', authorize('ADMIN', 'MANAGER'), teamController.removeMember);

export default router;
