import { Router } from 'express';
import { AnalyticsController } from './analytics.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import {
  formAnalyticsParamSchema,
  formAnalyticsQuerySchema,
} from './analytics.validators.js';

export function createAnalyticsRouter(
  controller: AnalyticsController = new AnalyticsController()
): Router {
  const router = Router();

  /**
   * GET /api/analytics/forms/:formId/metrics
   */
  router.get(
    '/forms/:formId/metrics',
    validate(formAnalyticsParamSchema, 'params'),
    validate(formAnalyticsQuerySchema, 'query'),
    asyncHandler(controller.getMetrics)
  );

  /**
   * GET /api/analytics/forms/:formId/visits
   */
  router.get(
    '/forms/:formId/visits',
    validate(formAnalyticsParamSchema, 'params'),
    validate(formAnalyticsQuerySchema, 'query'),
    asyncHandler(controller.getVisits)
  );

  /**
   * GET /api/analytics/forms/:formId/submissions
   */
  router.get(
    '/forms/:formId/submissions',
    validate(formAnalyticsParamSchema, 'params'),
    validate(formAnalyticsQuerySchema, 'query'),
    asyncHandler(controller.getSubmissions)
  );

  /**
   * GET /api/analytics/forms/:formId/dimensions
   */
  router.get(
    '/forms/:formId/dimensions',
    validate(formAnalyticsParamSchema, 'params'),
    validate(formAnalyticsQuerySchema, 'query'),
    asyncHandler(controller.getDimensions)
  );

  /**
   * GET /api/analytics/forms/:formId/drop-off
   */
  router.get(
    '/forms/:formId/drop-off',
    validate(formAnalyticsParamSchema, 'params'),
    validate(formAnalyticsQuerySchema, 'query'),
    asyncHandler(controller.getDropOff)
  );

  return router;
}

export const analyticsRouter = createAnalyticsRouter();
