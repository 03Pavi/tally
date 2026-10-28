import request from 'supertest';
import express from 'express';
import { createWorkspacesRouter } from './workspaces.routes.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Workspaces Feature', () => {
  let mockService: jest.Mocked<WorkspacesService>;
  let app: express.Application;

  beforeEach(() => {
    mockService = {
      listWorkspaces: jest.fn(),
      createWorkspace: jest.fn(),
      getWorkspace: jest.fn(),
      updateWorkspace: jest.fn(),
      deleteWorkspace: jest.fn(),
    } as unknown as jest.Mocked<WorkspacesService>;

    const controller = new WorkspacesController(mockService);
    app = express();
    app.use(express.json());
    app.use('/api/workspaces', createWorkspacesRouter(controller));
    app.use(errorHandler);
  });

  it('GET /api/workspaces lists workspaces', async () => {
    mockService.listWorkspaces.mockResolvedValueOnce({ workspaces: [] });
    const res = await request(app).get('/api/workspaces?page=1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.listWorkspaces).toHaveBeenCalledWith({ page: 1 });
  });

  it('POST /api/workspaces creates workspace', async () => {
    mockService.createWorkspace.mockResolvedValueOnce({
      id: 'ws_new',
      name: 'Engineering',
    });

    const res = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Engineering' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('ws_new');
    expect(mockService.createWorkspace).toHaveBeenCalledWith({ name: 'Engineering' });
  });

  it('GET /api/workspaces/:workspaceId fetches workspace', async () => {
    mockService.getWorkspace.mockResolvedValueOnce({
      id: 'ws_1',
      name: 'Product',
    });

    const res = await request(app).get('/api/workspaces/ws_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.getWorkspace).toHaveBeenCalledWith('ws_1');
  });

  it('PATCH /api/workspaces/:workspaceId updates workspace', async () => {
    mockService.updateWorkspace.mockResolvedValueOnce({
      id: 'ws_1',
      name: 'New Product Name',
    });

    const res = await request(app)
      .patch('/api/workspaces/ws_1')
      .send({ name: 'New Product Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.updateWorkspace).toHaveBeenCalledWith('ws_1', { name: 'New Product Name' });
  });

  it('DELETE /api/workspaces/:workspaceId deletes workspace', async () => {
    mockService.deleteWorkspace.mockResolvedValueOnce(undefined);
    const res = await request(app).delete('/api/workspaces/ws_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.deleteWorkspace).toHaveBeenCalledWith('ws_1');
  });
});
