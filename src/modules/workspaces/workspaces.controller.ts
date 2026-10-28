import type { Request, Response } from 'express';
import { WorkspacesService } from './workspaces.service.js';
import type {
  ValidatedListWorkspacesQuery,
  ValidatedWorkspaceIdParam,
  ValidatedCreateWorkspaceBody,
  ValidatedUpdateWorkspaceBody,
} from './workspaces.validators.js';

export class WorkspacesController {
  private readonly workspacesService: WorkspacesService;

  constructor(workspacesService?: WorkspacesService) {
    this.workspacesService = workspacesService ?? new WorkspacesService();
  }

  public listWorkspaces = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ValidatedListWorkspacesQuery;
    const result = await this.workspacesService.listWorkspaces(query);
    res.status(200).json({ success: true, data: result });
  };

  public createWorkspace = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ValidatedCreateWorkspaceBody;
    const result = await this.workspacesService.createWorkspace(body);
    res.status(201).json({ success: true, data: result });
  };

  public getWorkspace = async (req: Request, res: Response): Promise<void> => {
    const { workspaceId } = req.params as unknown as ValidatedWorkspaceIdParam;
    const result = await this.workspacesService.getWorkspace(workspaceId);
    res.status(200).json({ success: true, data: result });
  };

  public updateWorkspace = async (req: Request, res: Response): Promise<void> => {
    const { workspaceId } = req.params as unknown as ValidatedWorkspaceIdParam;
    const body = req.body as ValidatedUpdateWorkspaceBody;
    const result = await this.workspacesService.updateWorkspace(workspaceId, body);
    res.status(200).json({ success: true, data: result });
  };

  public deleteWorkspace = async (req: Request, res: Response): Promise<void> => {
    const { workspaceId } = req.params as unknown as ValidatedWorkspaceIdParam;
    await this.workspacesService.deleteWorkspace(workspaceId);
    res.status(200).json({
      success: true,
      data: { message: 'Workspace deleted successfully' },
    });
  };
}
