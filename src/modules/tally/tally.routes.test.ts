import request from 'supertest';
import express, { type Application } from 'express';
import { createTallyRouter } from './tally.routes.js';
import { TallyController } from './tally.controller.js';
import { TallyService } from './tally.service.js';
import { TallyApiError } from './tally.client.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Tally Express API Routes', () => {
  let app: Application;
  let mockService: jest.Mocked<TallyService>;

  beforeEach(() => {
    mockService = {
      listForms: jest.fn(),
      getForm: jest.fn(),
      listQuestions: jest.fn(),
      listSubmissions: jest.fn(),
      getSubmission: jest.fn(),
      getCurrentUser: jest.fn(),
    } as unknown as jest.Mocked<TallyService>;

    const controller = new TallyController(mockService);
    const router = createTallyRouter(controller);

    app = express();
    app.use(express.json());
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.use('/api/tally', router);
    app.use((_req, res) => {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
    });
    app.use(errorHandler);
  });

  describe('GET /health', () => {
    it('returns status ok', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/tally/forms', () => {
    it('returns 200 with forms list on valid request', async () => {
      mockService.listForms.mockResolvedValueOnce({
        items: [],
        page: 1,
        limit: 50,
        total: 0,
        hasMore: false,
      });

      const response = await request(app).get('/api/tally/forms?page=1&limit=25');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(mockService.listForms).toHaveBeenCalledWith({ page: 1, limit: 25 });
    });

    it('returns 400 when query parameter limit exceeds 500', async () => {
      const response = await request(app).get('/api/tally/forms?limit=1000');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].message).toContain('Limit cannot exceed 500');
    });

    it('returns 400 when page is less than 1', async () => {
      const response = await request(app).get('/api/tally/forms?page=0');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/tally/forms/:formId', () => {
    it('returns 200 with form details on success', async () => {
      mockService.getForm.mockResolvedValueOnce({
        id: 'form123',
        name: 'My Form',
        workspaceId: 'ws1',
        status: 'PUBLISHED',
        numberOfSubmissions: 2,
        isClosed: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const response = await request(app).get('/api/tally/forms/form123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('form123');
      expect(mockService.getForm).toHaveBeenCalledWith('form123');
    });

    it('returns 400 on invalid formId characters', async () => {
      const response = await request(app).get('/api/tally/forms/invalid%20id%20with%20spaces');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when upstream form is not found', async () => {
      mockService.getForm.mockRejectedValueOnce(
        new TallyApiError({
          message: 'Requested Tally resource not found',
          status: 404,
          mappedStatus: 404,
        })
      );

      const response = await request(app).get('/api/tally/forms/not_found_form');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/tally/forms/:formId/questions', () => {
    it('returns 200 with question list', async () => {
      mockService.listQuestions.mockResolvedValueOnce({
        questions: [],
        hasResponses: false,
      });

      const response = await request(app).get('/api/tally/forms/form123/questions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockService.listQuestions).toHaveBeenCalledWith('form123');
    });
  });

  describe('GET /api/tally/forms/:formId/submissions', () => {
    it('returns 200 with submissions list on valid query', async () => {
      mockService.listSubmissions.mockResolvedValueOnce({
        page: 1,
        limit: 50,
        hasMore: false,
        questions: [],
        submissions: [],
      });

      const response = await request(app).get(
        '/api/tally/forms/form123/submissions?filter=completed&startDate=2026-01-01T00:00:00Z'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockService.listSubmissions).toHaveBeenCalledWith('form123', {
        filter: 'completed',
        startDate: '2026-01-01T00:00:00Z',
      });
    });

    it('returns 400 on invalid filter parameter', async () => {
      const response = await request(app).get('/api/tally/forms/form123/submissions?filter=invalid_filter');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 on invalid date format', async () => {
      const response = await request(app).get('/api/tally/forms/form123/submissions?startDate=not-a-date');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/tally/forms/:formId/submissions/:submissionId', () => {
    it('returns 200 with submission details', async () => {
      mockService.getSubmission.mockResolvedValueOnce({
        questions: [],
        submission: {
          id: 'sub123',
          formId: 'form123',
          isCompleted: true,
          submittedAt: '2026-01-01T00:00:00Z',
          responses: [],
        },
      });

      const response = await request(app).get('/api/tally/forms/form123/submissions/sub123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.submission.id).toBe('sub123');
      expect(mockService.getSubmission).toHaveBeenCalledWith('form123', 'sub123');
    });
  });

  describe('GET /api/tally/me', () => {
    it('returns authenticated user information', async () => {
      mockService.getCurrentUser.mockResolvedValueOnce({
        id: 'user1',
        email: 'user@example.com',
        organizationId: 'org1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        subscriptionPlan: 'PRO',
      });

      const response = await request(app).get('/api/tally/me?timezone=UTC');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('user@example.com');
      expect(mockService.getCurrentUser).toHaveBeenCalledWith({ timezone: 'UTC' });
    });
  });

  describe('Upstream Error and Rate Limiting Mapping', () => {
    it('returns 429 and propagates Retry-After header when rate limited', async () => {
      mockService.listForms.mockRejectedValueOnce(
        new TallyApiError({
          message: 'Tally API rate limit reached (100 requests per minute)',
          status: 429,
          mappedStatus: 429,
          retryAfterSeconds: 30,
        })
      );

      const response = await request(app).get('/api/tally/forms');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBe('30');
      expect(response.body.error.code).toBe('RATE_LIMITED');
    });

    it('returns 502 Bad Gateway when upstream server credentials fail (401 from Tally)', async () => {
      mockService.listForms.mockRejectedValueOnce(
        new TallyApiError({
          message: 'Tally API authentication failed. Please check server credentials.',
          status: 401,
          mappedStatus: 502,
        })
      );

      const response = await request(app).get('/api/tally/forms');

      expect(response.status).toBe(502);
      expect(response.body.error.code).toBe('UPSTREAM_GATEWAY_ERROR');
      expect(response.body.error.message).toContain('credentials');
    });

    it('returns 502 Bad Gateway on upstream server error (500 from Tally)', async () => {
      mockService.listForms.mockRejectedValueOnce(
        new TallyApiError({
          message: 'Tally API server error',
          status: 500,
          mappedStatus: 502,
        })
      );

      const response = await request(app).get('/api/tally/forms');

      expect(response.status).toBe(502);
      expect(response.body.error.code).toBe('UPSTREAM_GATEWAY_ERROR');
    });
  });
});
