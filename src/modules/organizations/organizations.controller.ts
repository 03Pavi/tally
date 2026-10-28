import type { Request, Response } from 'express';
import { OrganizationsService } from './organizations.service.js';
import type {
  ValidatedOrganizationIdParam,
  ValidatedRemoveOrganizationUserParam,
  ValidatedCancelOrganizationInviteParam,
  ValidatedCreateOrganizationInviteBody,
} from './organizations.validators.js';

export class OrganizationsController {
  private readonly organizationsService: OrganizationsService;

  constructor(organizationsService?: OrganizationsService) {
    this.organizationsService = organizationsService ?? new OrganizationsService();
  }

  public listUsers = async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = req.params as unknown as ValidatedOrganizationIdParam;
    const result = await this.organizationsService.listUsers(organizationId);
    res.status(200).json({
      success: true,
      data: result,
    });
  };

  public removeUser = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, userId } = req.params as unknown as ValidatedRemoveOrganizationUserParam;
    await this.organizationsService.removeUser(organizationId, userId);
    res.status(200).json({
      success: true,
      data: { message: 'User removed from organization successfully' },
    });
  };

  public listInvites = async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = req.params as unknown as ValidatedOrganizationIdParam;
    const result = await this.organizationsService.listInvites(organizationId);
    res.status(200).json({
      success: true,
      data: result,
    });
  };

  public createInvite = async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = req.params as unknown as ValidatedOrganizationIdParam;
    const body = req.body as ValidatedCreateOrganizationInviteBody;
    const result = await this.organizationsService.createInvite(organizationId, body);
    res.status(201).json({
      success: true,
      data: result,
    });
  };

  public cancelInvite = async (req: Request, res: Response): Promise<void> => {
    const { organizationId, inviteId } = req.params as unknown as ValidatedCancelOrganizationInviteParam;
    await this.organizationsService.cancelInvite(organizationId, inviteId);
    res.status(200).json({
      success: true,
      data: { message: 'Organization invite cancelled successfully' },
    });
  };
}
