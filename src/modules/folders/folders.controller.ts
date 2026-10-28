import type { Request, Response } from 'express';
import { FoldersService } from './folders.service.js';
import type {
  ValidatedWorkspaceIdParam,
  ValidatedFolderIdParam,
  ValidatedCreateFolderBody,
  ValidatedUpdateFolderBody,
} from './folders.validators.js';

export class FoldersController {
  private readonly foldersService: FoldersService;

  constructor(foldersService?: FoldersService) {
    this.foldersService = foldersService ?? new FoldersService();
  }

  public listFolders = async (req: Request, res: Response): Promise<void> => {
    const { workspaceId } = req.params as unknown as ValidatedWorkspaceIdParam;
    const result = await this.foldersService.listFolders(workspaceId);
    res.status(200).json({ success: true, data: result });
  };

  public createFolder = async (req: Request, res: Response): Promise<void> => {
    const { workspaceId } = req.params as unknown as ValidatedWorkspaceIdParam;
    const body = req.body as ValidatedCreateFolderBody;
    const result = await this.foldersService.createFolder(workspaceId, body);
    res.status(201).json({ success: true, data: result });
  };

  public updateFolder = async (req: Request, res: Response): Promise<void> => {
    const { workspaceId, id } = req.params as unknown as ValidatedFolderIdParam;
    const body = req.body as ValidatedUpdateFolderBody;
    const result = await this.foldersService.updateFolder(workspaceId, id, body);
    res.status(200).json({ success: true, data: result });
  };

  public deleteFolder = async (req: Request, res: Response): Promise<void> => {
    const { workspaceId, id } = req.params as unknown as ValidatedFolderIdParam;
    await this.foldersService.deleteFolder(workspaceId, id);
    res.status(200).json({
      success: true,
      data: { message: 'Folder deleted successfully' },
    });
  };
}
