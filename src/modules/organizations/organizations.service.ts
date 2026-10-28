import { TallyClient } from '../../client/tally.client.js';
import type {
  ListOrganizationUsersResponse,
  ListOrganizationInvitesResponse,
  CreateOrganizationInvitePayload,
  OrganizationInvite,
} from './organizations.types.js';

export class OrganizationsService {
  private readonly client: TallyClient;

  constructor(client?: TallyClient) {
    this.client = client ?? new TallyClient();
  }

  /**
   * Returns a list of all users in your organization.
   * Documented endpoint: GET https://api.tally.so/organizations/{organizationId}/users
   */
  public async listUsers(organizationId: string): Promise<ListOrganizationUsersResponse> {
    if (!organizationId || !organizationId.trim()) throw new Error('organizationId is required');
    return this.client.get<ListOrganizationUsersResponse>(
      `/organizations/${encodeURIComponent(organizationId.trim())}/users`
    );
  }

  /**
   * Removes a user from your organization.
   * Documented endpoint: DELETE https://api.tally.so/organizations/{organizationId}/users/{userId}
   */
  public async removeUser(organizationId: string, userId: string): Promise<void> {
    if (!organizationId || !organizationId.trim()) throw new Error('organizationId is required');
    if (!userId || !userId.trim()) throw new Error('userId is required');
    return this.client.delete<void>(
      `/organizations/${encodeURIComponent(organizationId.trim())}/users/${encodeURIComponent(userId.trim())}`
    );
  }

  /**
   * Returns a list of all invites in your organization.
   * Documented endpoint: GET https://api.tally.so/organizations/{organizationId}/invites
   */
  public async listInvites(organizationId: string): Promise<ListOrganizationInvitesResponse> {
    if (!organizationId || !organizationId.trim()) throw new Error('organizationId is required');
    return this.client.get<ListOrganizationInvitesResponse>(
      `/organizations/${encodeURIComponent(organizationId.trim())}/invites`
    );
  }

  /**
   * Invites users to join specific workspaces within your organization.
   * Documented endpoint: POST https://api.tally.so/organizations/{organizationId}/invites
   */
  public async createInvite(
    organizationId: string,
    payload: CreateOrganizationInvitePayload
  ): Promise<OrganizationInvite | OrganizationInvite[]> {
    if (!organizationId || !organizationId.trim()) throw new Error('organizationId is required');
    return this.client.post<OrganizationInvite | OrganizationInvite[]>(
      `/organizations/${encodeURIComponent(organizationId.trim())}/invites`,
      payload
    );
  }

  /**
   * Cancels a pending invitation to join workspaces within your organization.
   * Documented endpoint: DELETE https://api.tally.so/organizations/{organizationId}/invites/{inviteId}
   */
  public async cancelInvite(organizationId: string, inviteId: string): Promise<void> {
    if (!organizationId || !organizationId.trim()) throw new Error('organizationId is required');
    if (!inviteId || !inviteId.trim()) throw new Error('inviteId is required');
    return this.client.delete<void>(
      `/organizations/${encodeURIComponent(organizationId.trim())}/invites/${encodeURIComponent(inviteId.trim())}`
    );
  }
}
