import type { Request, Response } from 'express';
import { UsersService } from './users.service.js';
import type { ValidatedGetCurrentUserQuery } from './users.validators.js';

export class UsersController {
  private readonly usersService: UsersService;

  constructor(usersService?: UsersService) {
    this.usersService = usersService ?? new UsersService();
  }

  public getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ValidatedGetCurrentUserQuery;
    const user = await this.usersService.getCurrentUser(query);
    res.status(200).json({
      success: true,
      data: user,
    });
  };
}
