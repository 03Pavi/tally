export interface Folder {
  id: string;
  name: string;
  workspaceId: string;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ListFoldersResponse {
  folders?: Folder[];
  [key: string]: unknown;
}

export interface CreateFolderPayload {
  name: string;
  parentId?: string;
}

export interface UpdateFolderPayload {
  name: string;
}
