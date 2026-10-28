import { Router } from 'express';
import { TallyController } from './tally.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import {
  listFormsQuerySchema,
  formIdParamSchema,
  submissionIdParamSchema,
  listSubmissionsQuerySchema,
  currentUserQuerySchema,
} from './tally.validators.js';

export function createTallyRouter(controller: TallyController = new TallyController()): Router {
  const router = Router();

  /**
   * GET /api/tally/me
   * Retrieve authenticated user information
   */
  router.get(
    '/me',
    validate(currentUserQuerySchema, 'query'),
    asyncHandler(controller.getCurrentUser)
  );

  /**
   * GET /api/tally/forms
   * List forms with pagination and workspace filter
   */
  router.get(
    '/forms',
    validate(listFormsQuerySchema, 'query'),
    asyncHandler(controller.listForms)
  );

  /**
   * GET /api/tally/forms/:formId
   * Retrieve details, settings, and blocks of a specific form
   */
  router.get(
    '/forms/:formId',
    validate(formIdParamSchema, 'params'),
    asyncHandler(controller.getForm)
  );

  /**
   * GET /api/tally/forms/:formId/questions
   * Retrieve questions list for a specific form
   */
  router.get(
    '/forms/:formId/questions',
    validate(formIdParamSchema, 'params'),
    asyncHandler(controller.listQuestions)
  );

  /**
   * GET /api/tally/forms/:formId/submissions
   * List submissions for a specific form with pagination and filtering
   */
  router.get(
    '/forms/:formId/submissions',
    validate(formIdParamSchema, 'params'),
    validate(listSubmissionsQuerySchema, 'query'),
    asyncHandler(controller.listSubmissions)
  );

  /**
   * GET /api/tally/forms/:formId/submissions/:submissionId
   * Retrieve a specific submission with responses
   */
  router.get(
    '/forms/:formId/submissions/:submissionId',
    validate(submissionIdParamSchema, 'params'),
    asyncHandler(controller.getSubmission)
  );

  return router;
}

export const tallyRouter = createTallyRouter();
