import request from 'supertest';
import express from 'express';
import { createAnalyticsRouter } from './analytics.routes.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Analytics Feature', () => {
  let mockService: jest.Mocked<AnalyticsService>;
  let app: express.Application;

  beforeEach(() => {
    mockService = {
      getMetrics: jest.fn(),
      getVisits: jest.fn(),
      getSubmissionsAnalytics: jest.fn(),
      getDimensions: jest.fn(),
      getDropOff: jest.fn(),
    } as unknown as jest.Mocked<AnalyticsService>;

    const controller = new AnalyticsController(mockService);
    app = express();
    app.use(express.json());
    app.use('/api/analytics', createAnalyticsRouter(controller));
    app.use(errorHandler);
  });

  it('GET /api/analytics/forms/:formId/metrics returns metrics', async () => {
    mockService.getMetrics.mockResolvedValueOnce({ visits: 100, submissions: 40 });
    const res = await request(app).get('/api/analytics/forms/f_1/metrics?period=30d');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.getMetrics).toHaveBeenCalledWith('f_1', '30d');
  });

  it('GET /api/analytics/forms/:formId/visits returns visits', async () => {
    mockService.getVisits.mockResolvedValueOnce({ period: '7d', visits: [] });
    const res = await request(app).get('/api/analytics/forms/f_1/visits?period=7d');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.getVisits).toHaveBeenCalledWith('f_1', '7d');
  });

  it('GET /api/analytics/forms/:formId/submissions returns submission counts', async () => {
    mockService.getSubmissionsAnalytics.mockResolvedValueOnce({ period: '24h', submissions: [] });
    const res = await request(app).get('/api/analytics/forms/f_1/submissions?period=24h');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.getSubmissionsAnalytics).toHaveBeenCalledWith('f_1', '24h');
  });

  it('GET /api/analytics/forms/:formId/dimensions returns dimension data', async () => {
    mockService.getDimensions.mockResolvedValueOnce({ period: 'all', dimensions: {} });
    const res = await request(app).get('/api/analytics/forms/f_1/dimensions?period=all');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.getDimensions).toHaveBeenCalledWith('f_1', 'all');
  });

  it('GET /api/analytics/forms/:formId/drop-off returns drop off stats', async () => {
    mockService.getDropOff.mockResolvedValueOnce({ period: 'today', dropOff: [] });
    const res = await request(app).get('/api/analytics/forms/f_1/drop-off?period=today');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.getDropOff).toHaveBeenCalledWith('f_1', 'today');
  });

  it('returns 400 when period is invalid', async () => {
    const res = await request(app).get('/api/analytics/forms/f_1/metrics?period=invalid_period');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
