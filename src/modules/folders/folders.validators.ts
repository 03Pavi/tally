import { z } from 'zod';

export const workspaceIdParamSchema = z.object({
  workspaceId: z
    .string()
    .trim()
    .min(1, 'workspaceId is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid workspaceId format'),
});

export const folderIdParamSchema = workspaceIdParamSchema.extend({
  id: z
    .string()
    .trim()
    .min(1, 'folder id is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid folder id format'),
});

export const createFolderBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100, 'name is too long'),
  parentId: z.string().trim().optional(),
});

export const updateFolderBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100, 'name is too long'),
});

export type ValidatedWorkspaceIdParam = z.infer<typeof workspaceIdParamSchema>;
export type ValidatedFolderIdParam = z.infer<typeof folderIdParamSchema>;
export type ValidatedCreateFolderBody = z.infer<typeof createFolderBodySchema>;
export type ValidatedUpdateFolderBody = z.infer<typeof updateFolderBodySchema>;
