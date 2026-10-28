import { Router } from 'express';
import { FormsController } from './forms.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import {
  listFormsQuerySchema,
  formIdParamSchema,
  submissionIdParamSchema,
  createFormBodySchema,
  updateFormBodySchema,
  listSubmissionsQuerySchema,
} from './forms.validators.js';

export function createFormsRouter(controller: FormsController = new FormsController()): Router {
  const router = Router();

  /**
   * GET /api/forms
   */
  router.get(
    '/',
    validate(listFormsQuerySchema, 'query'),
    asyncHandler(controller.listForms)
  );

  /**
   * POST /api/forms
   */
  router.post(
    '/',
    validate(createFormBodySchema, 'body'),
    asyncHandler(controller.createForm)
  );

  /**
   * GET /api/forms/:formId
   */
  router.get(
    '/:formId',
    validate(formIdParamSchema, 'params'),
    asyncHandler(controller.getForm)
  );

  /**
   * PATCH /api/forms/:formId
   */
  router.patch(
    '/:formId',
    validate(formIdParamSchema, 'params'),
    validate(updateFormBodySchema, 'body'),
    asyncHandler(controller.updateForm)
  );

  /**
   * DELETE /api/forms/:formId
   */
  router.delete(
    '/:formId',
    validate(formIdParamSchema, 'params'),
    asyncHandler(controller.deleteForm)
  );

  /**
   * GET /api/forms/:formId/questions
   */
  router.get(
    '/:formId/questions',
    validate(formIdParamSchema, 'params'),
    asyncHandler(controller.listQuestions)
  );

  /**
   * GET /api/forms/:formId/submissions
   */
  router.get(
    '/:formId/submissions',
    validate(formIdParamSchema, 'params'),
    validate(listSubmissionsQuerySchema, 'query'),
    asyncHandler(controller.listSubmissions)
  );

  /**
   * GET /api/forms/:formId/submissions/:submissionId
   */
  router.get(
    '/:formId/submissions/:submissionId',
    validate(submissionIdParamSchema, 'params'),
    asyncHandler(controller.getSubmission)
  );

  /**
   * DELETE /api/forms/:formId/submissions/:submissionId
   */
  router.delete(
    '/:formId/submissions/:submissionId',
    validate(submissionIdParamSchema, 'params'),
    asyncHandler(controller.deleteSubmission)
  );

  return router;
}

export const formsRouter = createFormsRouter();
