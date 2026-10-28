import request from 'supertest';
import express from 'express';
import { createFoldersRouter } from './folders.routes.js';
import { FoldersController } from './folders.controller.js';
import { FoldersService } from './folders.service.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Folders Feature', () => {
  let mockService: jest.Mocked<FoldersService>;
  let app: express.Application;

  beforeEach(() => {
    mockService = {
      listFolders: jest.fn(),
      createFolder: jest.fn(),
      updateFolder: jest.fn(),
      deleteFolder: jest.fn(),
    } as unknown as jest.Mocked<FoldersService>;

    const controller = new FoldersController(mockService);
    app = express();
    app.use(express.json());
    app.use('/api/workspaces', createFoldersRouter(controller));
    app.use(errorHandler);
  });

  it('GET /api/workspaces/:workspaceId/folders lists folders', async () => {
    mockService.listFolders.mockResolvedValueOnce({ folders: [] });
    const res = await request(app).get('/api/workspaces/ws_1/folders');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.listFolders).toHaveBeenCalledWith('ws_1');
  });

  it('POST /api/workspaces/:workspaceId/folders creates a folder', async () => {
    mockService.createFolder.mockResolvedValueOnce({
      id: 'fld_1',
      name: 'Marketing Forms',
      workspaceId: 'ws_1',
    });

    const res = await request(app)
      .post('/api/workspaces/ws_1/folders')
      .send({ name: 'Marketing Forms' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockService.createFolder).toHaveBeenCalledWith('ws_1', { name: 'Marketing Forms' });
  });

  it('PATCH /api/workspaces/:workspaceId/folders/:id updates a folder', async () => {
    mockService.updateFolder.mockResolvedValueOnce({
      id: 'fld_1',
      name: 'Renamed Folder',
      workspaceId: 'ws_1',
    });

    const res = await request(app)
      .patch('/api/workspaces/ws_1/folders/fld_1')
      .send({ name: 'Renamed Folder' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.updateFolder).toHaveBeenCalledWith('ws_1', 'fld_1', { name: 'Renamed Folder' });
  });

  it('DELETE /api/workspaces/:workspaceId/folders/:id deletes a folder', async () => {
    mockService.deleteFolder.mockResolvedValueOnce(undefined);
    const res = await request(app).delete('/api/workspaces/ws_1/folders/fld_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.deleteFolder).toHaveBeenCalledWith('ws_1', 'fld_1');
  });
});
