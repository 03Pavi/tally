import { z } from 'zod';

export const listWebhooksQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(1, 'Page must be at least 1').optional()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(1).max(500).optional()),
});

export const webhookIdParamSchema = z.object({
  webhookId: z
    .string()
    .trim()
    .min(1, 'webhookId is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid webhookId format'),
});

export const webhookEventParamSchema = webhookIdParamSchema.extend({
  eventId: z
    .string()
    .trim()
    .min(1, 'eventId is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid eventId format'),
});

export const createWebhookBodySchema = z.object({
  formId: z.string().trim().min(1, 'formId is required'),
  url: z.string().url('url must be a valid URL'),
  eventTypes: z.array(z.string().min(1)).min(1, 'At least one eventType is required'),
  signingSecret: z.string().nullable().optional(),
  httpHeaders: z
    .array(
      z.object({
        name: z.string().min(1),
        value: z.string(),
      })
    )
    .nullable()
    .optional(),
  externalSubscriber: z.string().nullable().optional(),
});

export const updateWebhookBodySchema = z.object({
  url: z.string().url('url must be a valid URL').optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  isEnabled: z.boolean().optional(),
  signingSecret: z.string().nullable().optional(),
  httpHeaders: z
    .array(
      z.object({
        name: z.string().min(1),
        value: z.string(),
      })
    )
    .nullable()
    .optional(),
});

export const listWebhookEventsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(1, 'Page must be at least 1').optional()),
});

export type ValidatedListWebhooksQuery = z.infer<typeof listWebhooksQuerySchema>;
export type ValidatedWebhookIdParam = z.infer<typeof webhookIdParamSchema>;
export type ValidatedWebhookEventParam = z.infer<typeof webhookEventParamSchema>;
export type ValidatedCreateWebhookBody = z.infer<typeof createWebhookBodySchema>;
export type ValidatedUpdateWebhookBody = z.infer<typeof updateWebhookBodySchema>;
export type ValidatedListWebhookEventsQuery = z.infer<typeof listWebhookEventsQuerySchema>;
