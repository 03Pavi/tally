import { TallyClient } from '../../client/tally.client.js';
import type {
  ListWorkspacesQuery,
  ListWorkspacesResponse,
  Workspace,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
} from './workspaces.types.js';

export class WorkspacesService {
  private readonly client: TallyClient;

  constructor(client?: TallyClient) {
    this.client = client ?? new TallyClient();
  }

  /**
   * Returns a paginated array of workspace objects.
   * Documented endpoint: GET https://api.tally.so/workspaces
   */
  public async listWorkspaces(query: ListWorkspacesQuery = {}): Promise<ListWorkspacesResponse> {
    const params: Record<string, number | undefined> = {};
    if (query.page !== undefined) params['page'] = query.page;
    return this.client.get<ListWorkspacesResponse>('/workspaces', { params });
  }

  /**
   * Creates a new workspace and assigns authenticated user as a member.
   * Documented endpoint: POST https://api.tally.so/workspaces
   */
  public async createWorkspace(payload: CreateWorkspacePayload): Promise<Workspace> {
    return this.client.post<Workspace>('/workspaces', payload);
  }

  /**
   * Returns a single workspace by its ID with associated members.
   * Documented endpoint: GET https://api.tally.so/workspaces/{workspaceId}
   */
  public async getWorkspace(workspaceId: string): Promise<Workspace> {
    if (!workspaceId || !workspaceId.trim()) throw new Error('workspaceId is required');
    return this.client.get<Workspace>(`/workspaces/${encodeURIComponent(workspaceId.trim())}`);
  }

  /**
   * Updates a workspace's information by its ID.
   * Documented endpoint: PATCH https://api.tally.so/workspaces/{workspaceId}
   */
  public async updateWorkspace(
    workspaceId: string,
    payload: UpdateWorkspacePayload
  ): Promise<Workspace> {
    if (!workspaceId || !workspaceId.trim()) throw new Error('workspaceId is required');
    return this.client.patch<Workspace>(
      `/workspaces/${encodeURIComponent(workspaceId.trim())}`,
      payload
    );
  }

  /**
   * Deletes a workspace and all its associated forms.
   * Documented endpoint: DELETE https://api.tally.so/workspaces/{workspaceId}
   */
  public async deleteWorkspace(workspaceId: string): Promise<void> {
    if (!workspaceId || !workspaceId.trim()) throw new Error('workspaceId is required');
    return this.client.delete<void>(`/workspaces/${encodeURIComponent(workspaceId.trim())}`);
  }
}
