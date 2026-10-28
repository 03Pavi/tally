import { z } from 'zod';

export const getCurrentUserQuerySchema = z.object({
  timezone: z.string().trim().max(100).optional(),
});

export type ValidatedGetCurrentUserQuery = z.infer<typeof getCurrentUserQuerySchema>;
