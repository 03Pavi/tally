import request from 'supertest';
import express from 'express';
import { createOrganizationsRouter } from './organizations.routes.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Organizations Feature', () => {
  let mockService: jest.Mocked<OrganizationsService>;
  let app: express.Application;

  beforeEach(() => {
    mockService = {
      listUsers: jest.fn(),
      removeUser: jest.fn(),
      listInvites: jest.fn(),
      createInvite: jest.fn(),
      cancelInvite: jest.fn(),
    } as unknown as jest.Mocked<OrganizationsService>;

    const controller = new OrganizationsController(mockService);
    app = express();
    app.use(express.json());
    app.use('/api/organizations', createOrganizationsRouter(controller));
    app.use(errorHandler);
  });

  it('GET /api/organizations/:organizationId/users lists users', async () => {
    mockService.listUsers.mockResolvedValueOnce({ users: [] });
    const res = await request(app).get('/api/organizations/org_123/users');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.listUsers).toHaveBeenCalledWith('org_123');
  });

  it('DELETE /api/organizations/:organizationId/users/:userId removes a user', async () => {
    mockService.removeUser.mockResolvedValueOnce(undefined);
    const res = await request(app).delete('/api/organizations/org_123/users/usr_456');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.removeUser).toHaveBeenCalledWith('org_123', 'usr_456');
  });

  it('GET /api/organizations/:organizationId/invites lists invites', async () => {
    mockService.listInvites.mockResolvedValueOnce({ invites: [] });
    const res = await request(app).get('/api/organizations/org_123/invites');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.listInvites).toHaveBeenCalledWith('org_123');
  });

  it('POST /api/organizations/:organizationId/invites creates invites', async () => {
    mockService.createInvite.mockResolvedValueOnce({
      id: 'inv_1',
      email: 'test@example.com',
      organizationId: 'org_123',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/organizations/org_123/invites')
      .send({ workspaceIds: ['ws_1'], emails: 'test@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockService.createInvite).toHaveBeenCalledWith('org_123', {
      workspaceIds: ['ws_1'],
      emails: 'test@example.com',
    });
  });

  it('DELETE /api/organizations/:organizationId/invites/:inviteId cancels an invite', async () => {
    mockService.cancelInvite.mockResolvedValueOnce(undefined);
    const res = await request(app).delete('/api/organizations/org_123/invites/inv_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.cancelInvite).toHaveBeenCalledWith('org_123', 'inv_1');
  });
});
