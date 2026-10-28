import { Router } from 'express';
import { WebhooksController } from './webhooks.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import {
  listWebhooksQuerySchema,
  webhookIdParamSchema,
  webhookEventParamSchema,
  createWebhookBodySchema,
  updateWebhookBodySchema,
  listWebhookEventsQuerySchema,
} from './webhooks.validators.js';

export function createWebhooksRouter(
  controller: WebhooksController = new WebhooksController()
): Router {
  const router = Router();

  /**
   * GET /api/webhooks
   */
  router.get(
    '/',
    validate(listWebhooksQuerySchema, 'query'),
    asyncHandler(controller.listWebhooks)
  );

  /**
   * POST /api/webhooks
   */
  router.post(
    '/',
    validate(createWebhookBodySchema, 'body'),
    asyncHandler(controller.createWebhook)
  );

  /**
   * PATCH /api/webhooks/:webhookId
   */
  router.patch(
    '/:webhookId',
    validate(webhookIdParamSchema, 'params'),
    validate(updateWebhookBodySchema, 'body'),
    asyncHandler(controller.updateWebhook)
  );

  /**
   * DELETE /api/webhooks/:webhookId
   */
  router.delete(
    '/:webhookId',
    validate(webhookIdParamSchema, 'params'),
    asyncHandler(controller.deleteWebhook)
  );

  /**
   * GET /api/webhooks/:webhookId/events
   */
  router.get(
    '/:webhookId/events',
    validate(webhookIdParamSchema, 'params'),
    validate(listWebhookEventsQuerySchema, 'query'),
    asyncHandler(controller.listEvents)
  );

  /**
   * POST /api/webhooks/:webhookId/events/:eventId
   */
  router.post(
    '/:webhookId/events/:eventId',
    validate(webhookEventParamSchema, 'params'),
    asyncHandler(controller.retryEvent)
  );

  return router;
}

export const webhooksRouter = createWebhooksRouter();
