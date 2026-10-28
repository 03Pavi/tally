import request from 'supertest';
import express from 'express';
import { createFormsRouter } from './forms.routes.js';
import { FormsController } from './forms.controller.js';
import { FormsService } from './forms.service.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Forms Feature', () => {
  let mockService: jest.Mocked<FormsService>;
  let app: express.Application;

  beforeEach(() => {
    mockService = {
      listForms: jest.fn(),
      createForm: jest.fn(),
      getForm: jest.fn(),
      updateForm: jest.fn(),
      deleteForm: jest.fn(),
      listQuestions: jest.fn(),
      listSubmissions: jest.fn(),
      getSubmission: jest.fn(),
      deleteSubmission: jest.fn(),
    } as unknown as jest.Mocked<FormsService>;

    const controller = new FormsController(mockService);
    app = express();
    app.use(express.json());
    app.use('/api/forms', createFormsRouter(controller));
    app.use(errorHandler);
  });

  it('GET /api/forms lists forms', async () => {
    mockService.listForms.mockResolvedValueOnce({
      items: [],
      page: 1,
      limit: 50,
      total: 0,
      hasMore: false,
    });
    const res = await request(app).get('/api/forms?page=1&limit=25');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.listForms).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  it('POST /api/forms creates a new form', async () => {
    const mockCreated = {
      id: 'f_new',
      name: 'New Form',
      workspaceId: 'ws_1',
      status: 'DRAFT' as const,
      numberOfSubmissions: 0,
      isClosed: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      blocks: [],
    };
    mockService.createForm.mockResolvedValueOnce(mockCreated);

    const res = await request(app)
      .post('/api/forms')
      .send({ status: 'DRAFT', blocks: [] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('f_new');
    expect(mockService.createForm).toHaveBeenCalledWith({ status: 'DRAFT', blocks: [] });
  });

  it('PATCH /api/forms/:formId updates an existing form', async () => {
    const mockUpdated = {
      id: 'f_1',
      name: 'Updated Name',
      workspaceId: 'ws_1',
      status: 'PUBLISHED' as const,
      numberOfSubmissions: 0,
      isClosed: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    mockService.updateForm.mockResolvedValueOnce(mockUpdated);

    const res = await request(app)
      .patch('/api/forms/f_1')
      .send({ name: 'Updated Name', status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.updateForm).toHaveBeenCalledWith('f_1', {
      name: 'Updated Name',
      status: 'PUBLISHED',
    });
  });

  it('DELETE /api/forms/:formId moves form to trash', async () => {
    mockService.deleteForm.mockResolvedValueOnce(undefined);
    const res = await request(app).delete('/api/forms/f_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.deleteForm).toHaveBeenCalledWith('f_1');
  });

  it('DELETE /api/forms/:formId/submissions/:submissionId deletes submission', async () => {
    mockService.deleteSubmission.mockResolvedValueOnce(undefined);
    const res = await request(app).delete('/api/forms/f_1/submissions/sub_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.deleteSubmission).toHaveBeenCalledWith('f_1', 'sub_1');
  });
});
