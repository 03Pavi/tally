import { TallyClient } from '../../client/tally.client.js';
import type {
  ListFoldersResponse,
  Folder,
  CreateFolderPayload,
  UpdateFolderPayload,
} from './folders.types.js';

export class FoldersService {
  private readonly client: TallyClient;

  constructor(client?: TallyClient) {
    this.client = client ?? new TallyClient();
  }

  /**
   * Returns the folders in a workspace.
   * Documented endpoint: GET https://api.tally.so/workspaces/{workspaceId}/folders
   */
  public async listFolders(workspaceId: string): Promise<ListFoldersResponse> {
    if (!workspaceId || !workspaceId.trim()) throw new Error('workspaceId is required');
    return this.client.get<ListFoldersResponse>(
      `/workspaces/${encodeURIComponent(workspaceId.trim())}/folders`
    );
  }

  /**
   * Creates a folder in a workspace.
   * Documented endpoint: POST https://api.tally.so/workspaces/{workspaceId}/folders
   */
  public async createFolder(workspaceId: string, payload: CreateFolderPayload): Promise<Folder> {
    if (!workspaceId || !workspaceId.trim()) throw new Error('workspaceId is required');
    return this.client.post<Folder>(
      `/workspaces/${encodeURIComponent(workspaceId.trim())}/folders`,
      payload
    );
  }

  /**
   * Renames a folder by its ID.
   * Documented endpoint: PATCH https://api.tally.so/workspaces/{workspaceId}/folders/{id}
   */
  public async updateFolder(
    workspaceId: string,
    id: string,
    payload: UpdateFolderPayload
  ): Promise<Folder> {
    if (!workspaceId || !workspaceId.trim()) throw new Error('workspaceId is required');
    if (!id || !id.trim()) throw new Error('folder id is required');
    return this.client.patch<Folder>(
      `/workspaces/${encodeURIComponent(workspaceId.trim())}/folders/${encodeURIComponent(id.trim())}`,
      payload
    );
  }

  /**
   * Deletes a folder and its subtree by its ID.
   * Documented endpoint: DELETE https://api.tally.so/workspaces/{workspaceId}/folders/{id}
   */
  public async deleteFolder(workspaceId: string, id: string): Promise<void> {
    if (!workspaceId || !workspaceId.trim()) throw new Error('workspaceId is required');
    if (!id || !id.trim()) throw new Error('folder id is required');
    return this.client.delete<void>(
      `/workspaces/${encodeURIComponent(workspaceId.trim())}/folders/${encodeURIComponent(id.trim())}`
    );
  }
}
