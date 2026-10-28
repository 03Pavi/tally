import { Router } from 'express';
import { OrganizationsController } from './organizations.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import {
  organizationIdParamSchema,
  removeOrganizationUserParamSchema,
  cancelOrganizationInviteParamSchema,
  createOrganizationInviteBodySchema,
} from './organizations.validators.js';

export function createOrganizationsRouter(
  controller: OrganizationsController = new OrganizationsController()
): Router {
  const router = Router();

  /**
   * GET /api/organizations/:organizationId/users
   */
  router.get(
    '/:organizationId/users',
    validate(organizationIdParamSchema, 'params'),
    asyncHandler(controller.listUsers)
  );

  /**
   * DELETE /api/organizations/:organizationId/users/:userId
   */
  router.delete(
    '/:organizationId/users/:userId',
    validate(removeOrganizationUserParamSchema, 'params'),
    asyncHandler(controller.removeUser)
  );

  /**
   * GET /api/organizations/:organizationId/invites
   */
  router.get(
    '/:organizationId/invites',
    validate(organizationIdParamSchema, 'params'),
    asyncHandler(controller.listInvites)
  );

  /**
   * POST /api/organizations/:organizationId/invites
   */
  router.post(
    '/:organizationId/invites',
    validate(organizationIdParamSchema, 'params'),
    validate(createOrganizationInviteBodySchema, 'body'),
    asyncHandler(controller.createInvite)
  );

  /**
   * DELETE /api/organizations/:organizationId/invites/:inviteId
   */
  router.delete(
    '/:organizationId/invites/:inviteId',
    validate(cancelOrganizationInviteParamSchema, 'params'),
    asyncHandler(controller.cancelInvite)
  );

  return router;
}

export const organizationsRouter = createOrganizationsRouter();
