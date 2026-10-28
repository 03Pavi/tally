import { Router } from 'express';
import { WorkspacesController } from './workspaces.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import {
  listWorkspacesQuerySchema,
  workspaceIdParamSchema,
  createWorkspaceBodySchema,
  updateWorkspaceBodySchema,
} from './workspaces.validators.js';

export function createWorkspacesRouter(
  controller: WorkspacesController = new WorkspacesController()
): Router {
  const router = Router();

  /**
   * GET /api/workspaces
   */
  router.get(
    '/',
    validate(listWorkspacesQuerySchema, 'query'),
    asyncHandler(controller.listWorkspaces)
  );

  /**
   * POST /api/workspaces
   */
  router.post(
    '/',
    validate(createWorkspaceBodySchema, 'body'),
    asyncHandler(controller.createWorkspace)
  );

  /**
   * GET /api/workspaces/:workspaceId
   */
  router.get(
    '/:workspaceId',
    validate(workspaceIdParamSchema, 'params'),
    asyncHandler(controller.getWorkspace)
  );

  /**
   * PATCH /api/workspaces/:workspaceId
   */
  router.patch(
    '/:workspaceId',
    validate(workspaceIdParamSchema, 'params'),
    validate(updateWorkspaceBodySchema, 'body'),
    asyncHandler(controller.updateWorkspace)
  );

  /**
   * DELETE /api/workspaces/:workspaceId
   */
  router.delete(
    '/:workspaceId',
    validate(workspaceIdParamSchema, 'params'),
    asyncHandler(controller.deleteWorkspace)
  );

  return router;
}

export const workspacesRouter = createWorkspacesRouter();
