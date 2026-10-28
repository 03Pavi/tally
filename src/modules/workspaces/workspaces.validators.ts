import { z } from 'zod';

export const listWorkspacesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().min(1, 'Page must be at least 1').optional()),
});

export const workspaceIdParamSchema = z.object({
  workspaceId: z
    .string()
    .trim()
    .min(1, 'workspaceId is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid workspaceId format'),
});

export const createWorkspaceBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100, 'name is too long'),
});

export const updateWorkspaceBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100, 'name is too long'),
});

export type ValidatedListWorkspacesQuery = z.infer<typeof listWorkspacesQuerySchema>;
export type ValidatedWorkspaceIdParam = z.infer<typeof workspaceIdParamSchema>;
export type ValidatedCreateWorkspaceBody = z.infer<typeof createWorkspaceBodySchema>;
export type ValidatedUpdateWorkspaceBody = z.infer<typeof updateWorkspaceBodySchema>;
