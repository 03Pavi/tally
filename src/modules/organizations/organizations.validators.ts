import { z } from 'zod';

export const organizationIdParamSchema = z.object({
  organizationId: z.string().trim().min(1, 'organizationId is required').regex(/^[a-zA-Z0-9_-]+$/, 'Invalid organizationId format'),
});

export const removeOrganizationUserParamSchema = organizationIdParamSchema.extend({
  userId: z.string().trim().min(1, 'userId is required').regex(/^[a-zA-Z0-9_-]+$/, 'Invalid userId format'),
});

export const cancelOrganizationInviteParamSchema = organizationIdParamSchema.extend({
  inviteId: z.string().trim().min(1, 'inviteId is required').regex(/^[a-zA-Z0-9_-]+$/, 'Invalid inviteId format'),
});

export const createOrganizationInviteBodySchema = z.object({
  workspaceIds: z.array(z.string().trim().min(1)).min(1, 'At least one workspaceId is required'),
  emails: z.string().trim().min(1, 'emails string is required'),
});

export type ValidatedOrganizationIdParam = z.infer<typeof organizationIdParamSchema>;
export type ValidatedRemoveOrganizationUserParam = z.infer<typeof removeOrganizationUserParamSchema>;
export type ValidatedCancelOrganizationInviteParam = z.infer<typeof cancelOrganizationInviteParamSchema>;
export type ValidatedCreateOrganizationInviteBody = z.infer<typeof createOrganizationInviteBodySchema>;
