import { Router } from 'express';
import { FoldersController } from './folders.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import {
  workspaceIdParamSchema,
  folderIdParamSchema,
  createFolderBodySchema,
  updateFolderBodySchema,
} from './folders.validators.js';

export function createFoldersRouter(
  controller: FoldersController = new FoldersController()
): Router {
  const router = Router();

  /**
   * GET /api/workspaces/:workspaceId/folders
   */
  router.get(
    '/:workspaceId/folders',
    validate(workspaceIdParamSchema, 'params'),
    asyncHandler(controller.listFolders)
  );

  /**
   * POST /api/workspaces/:workspaceId/folders
   */
  router.post(
    '/:workspaceId/folders',
    validate(workspaceIdParamSchema, 'params'),
    validate(createFolderBodySchema, 'body'),
    asyncHandler(controller.createFolder)
  );

  /**
   * PATCH /api/workspaces/:workspaceId/folders/:id
   */
  router.patch(
    '/:workspaceId/folders/:id',
    validate(folderIdParamSchema, 'params'),
    validate(updateFolderBodySchema, 'body'),
    asyncHandler(controller.updateFolder)
  );

  /**
   * DELETE /api/workspaces/:workspaceId/folders/:id
   */
  router.delete(
    '/:workspaceId/folders/:id',
    validate(folderIdParamSchema, 'params'),
    asyncHandler(controller.deleteFolder)
  );

  return router;
}

export const foldersRouter = createFoldersRouter();
