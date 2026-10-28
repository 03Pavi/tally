import type { User } from '../users/users.types.js';

export interface OrganizationInvite {
  id: string;
  email: string;
  organizationId: string;
  workspaceIds?: string[];
  invitedBy?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ListOrganizationUsersResponse {
  users?: User[];
  [key: string]: unknown;
}

export interface ListOrganizationInvitesResponse {
  invites?: OrganizationInvite[];
  [key: string]: unknown;
}

export interface CreateOrganizationInvitePayload {
  workspaceIds: string[];
  emails: string;
}
