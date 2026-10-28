import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { getCurrentUserQuerySchema } from './users.validators.js';

export function createUsersRouter(controller: UsersController = new UsersController()): Router {
  const router = Router();

  /**
   * GET /api/users/me
   */
  router.get(
    '/me',
    validate(getCurrentUserQuerySchema, 'query'),
    asyncHandler(controller.getCurrentUser)
  );

  return router;
}

export const usersRouter = createUsersRouter();
