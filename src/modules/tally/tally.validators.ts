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

export const currentUserQuerySchema = z.object({
  timezone: z.string().trim().max(100).optional(),
});

export type ValidatedListFormsQuery = z.infer<typeof listFormsQuerySchema>;
export type ValidatedFormIdParam = z.infer<typeof formIdParamSchema>;
export type ValidatedSubmissionIdParam = z.infer<typeof submissionIdParamSchema>;
export type ValidatedListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type ValidatedCurrentUserQuery = z.infer<typeof currentUserQuerySchema>;
