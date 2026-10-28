import { z } from 'zod';

export const analyticsPeriodValues = [
  'today',
  'yesterday',
  '24h',
  '7d',
  '30d',
  '3m',
  '6m',
  '12m',
  'all',
] as const;

export const formAnalyticsQuerySchema = z.object({
  period: z.enum(analyticsPeriodValues, {
    errorMap: () => ({
      message: `period must be one of: ${analyticsPeriodValues.join(', ')}`,
    }),
  }),
});

export const formAnalyticsParamSchema = z.object({
  formId: z
    .string()
    .trim()
    .min(1, 'formId is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid formId format'),
});

export type ValidatedFormAnalyticsQuery = z.infer<typeof formAnalyticsQuerySchema>;
export type ValidatedFormAnalyticsParam = z.infer<typeof formAnalyticsParamSchema>;
