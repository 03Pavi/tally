import { z } from 'zod';

export const listFormsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(1, 'Page must be at least 1').optional()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined))
    .pipe(
      z
        .number()
        .int()
        .min(1, 'Limit must be at least 1')
        .max(500, 'Limit cannot exceed 500')
        .optional()
    ),
  workspaceIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      if (Array.isArray(val)) return val;
      return val.split(',').map((id) => id.trim()).filter(Boolean);
    }),
});

export const formIdParamSchema = z.object({
  formId: z
    .string()
    .trim()
    .min(1, 'Form ID is required')
    .max(100, 'Form ID is too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid form ID format'),
});

export const submissionIdParamSchema = formIdParamSchema.extend({
  submissionId: z
    .string()
    .trim()
    .min(1, 'Submission ID is required')
    .max(100, 'Submission ID is too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid submission ID format'),
});

export const blockSchema = z.object({
  uuid: z.string().trim().min(1, 'uuid is required'),
  type: z.string().trim().min(1, 'type is required'),
  groupUuid: z.string().optional(),
  groupType: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
}).passthrough();

export const createFormBodySchema = z.object({
  workspaceId: z.string().trim().optional(),
  templateId: z.string().trim().optional(),
  folderId: z.string().trim().optional(),
  status: z.enum(['BLANK', 'DRAFT', 'PUBLISHED']),
  blocks: z.array(blockSchema),
  settings: z.record(z.unknown()).optional(),
});

export const updateFormBodySchema = z.object({
  name: z.string().trim().optional(),
  status: z.enum(['BLANK', 'DRAFT', 'PUBLISHED']).optional(),
  blocks: z.array(blockSchema).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const listSubmissionsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(1, 'Page must be at least 1').optional()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined))
    .pipe(
      z
        .number()
        .int()
        .min(1, 'Limit must be at least 1')
        .max(500, 'Limit cannot exceed 500')
        .optional()
    ),
  filter: z.enum(['all', 'completed', 'partial']).optional(),
  startDate: z
    .string()
    .datetime({ message: 'startDate must be a valid ISO 8601 date string' })
    .optional(),
  endDate: z
    .string()
    .datetime({ message: 'endDate must be a valid ISO 8601 date string' })
    .optional(),
  afterId: z
    .string()
    .trim()
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid afterId format')
    .optional(),
});

export type ValidatedListFormsQuery = z.infer<typeof listFormsQuerySchema>;
export type ValidatedFormIdParam = z.infer<typeof formIdParamSchema>;
export type ValidatedSubmissionIdParam = z.infer<typeof submissionIdParamSchema>;
export type ValidatedCreateFormBody = z.infer<typeof createFormBodySchema>;
export type ValidatedUpdateFormBody = z.infer<typeof updateFormBodySchema>;
export type ValidatedListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
