export interface WorkspaceMember {
  id: string;
  email: string;
  role?: string;
  [key: string]: unknown;
}

export interface Workspace {
  id: string;
  name: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  members?: WorkspaceMember[];
  [key: string]: unknown;
}

export interface ListWorkspacesQuery {
  page?: number;
}

export interface ListWorkspacesResponse {
  workspaces?: Workspace[];
  items?: Workspace[];
  page?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface CreateWorkspacePayload {
  name: string;
}

export interface UpdateWorkspacePayload {
  name: string;
}
