import request from 'supertest';
import express from 'express';
import { createUsersRouter } from './users.routes.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Users Feature', () => {
  let mockService: jest.Mocked<UsersService>;
  let app: express.Application;

  beforeEach(() => {
    mockService = {
      getCurrentUser: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    const controller = new UsersController(mockService);
    app = express();
    app.use(express.json());
    app.use('/api/users', createUsersRouter(controller));
    app.use(errorHandler);
  });

  it('GET /api/users/me returns authenticated user details', async () => {
    mockService.getCurrentUser.mockResolvedValueOnce({
      id: 'usr_1',
      fullName: 'Alice Bob',
      email: 'alice@example.com',
      organizationId: 'org_1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      subscriptionPlan: 'PRO',
    });

    const res = await request(app).get('/api/users/me?timezone=UTC');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('alice@example.com');
    expect(mockService.getCurrentUser).toHaveBeenCalledWith({ timezone: 'UTC' });
  });
});
