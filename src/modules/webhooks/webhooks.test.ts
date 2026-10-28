import request from 'supertest';
import express from 'express';
import { createWebhooksRouter } from './webhooks.routes.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { errorHandler } from '../../middleware/error-handler.js';

describe('Webhooks Feature', () => {
  let mockService: jest.Mocked<WebhooksService>;
  let app: express.Application;

  beforeEach(() => {
    mockService = {
      listWebhooks: jest.fn(),
      createWebhook: jest.fn(),
      updateWebhook: jest.fn(),
      deleteWebhook: jest.fn(),
      listEvents: jest.fn(),
      retryEvent: jest.fn(),
    } as unknown as jest.Mocked<WebhooksService>;

    const controller = new WebhooksController(mockService);
    app = express();
    app.use(express.json());
    app.use('/api/webhooks', createWebhooksRouter(controller));
    app.use(errorHandler);
  });

  it('GET /api/webhooks lists webhooks', async () => {
    mockService.listWebhooks.mockResolvedValueOnce({ webhooks: [] });
    const res = await request(app).get('/api/webhooks?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.listWebhooks).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('POST /api/webhooks creates a webhook', async () => {
    mockService.createWebhook.mockResolvedValueOnce({
      id: 'wh_1',
      formId: 'f_1',
      url: 'https://example.com/webhook',
      eventTypes: ['FORM_SUBMISSION'],
    });

    const res = await request(app)
      .post('/api/webhooks')
      .send({
        formId: 'f_1',
        url: 'https://example.com/webhook',
        eventTypes: ['FORM_SUBMISSION'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockService.createWebhook).toHaveBeenCalledWith({
      formId: 'f_1',
      url: 'https://example.com/webhook',
      eventTypes: ['FORM_SUBMISSION'],
    });
  });

  it('PATCH /api/webhooks/:webhookId updates a webhook', async () => {
    mockService.updateWebhook.mockResolvedValueOnce({
      id: 'wh_1',
      formId: 'f_1',
      url: 'https://example.com/new-webhook',
      eventTypes: ['FORM_SUBMISSION'],
      isEnabled: true,
    });

    const res = await request(app)
      .patch('/api/webhooks/wh_1')
      .send({ url: 'https://example.com/new-webhook', isEnabled: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.updateWebhook).toHaveBeenCalledWith('wh_1', {
      url: 'https://example.com/new-webhook',
      isEnabled: true,
    });
  });

  it('DELETE /api/webhooks/:webhookId deletes a webhook', async () => {
    mockService.deleteWebhook.mockResolvedValueOnce(undefined);
    const res = await request(app).delete('/api/webhooks/wh_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.deleteWebhook).toHaveBeenCalledWith('wh_1');
  });

  it('GET /api/webhooks/:webhookId/events lists webhook delivery events', async () => {
    mockService.listEvents.mockResolvedValueOnce({ events: [] });
    const res = await request(app).get('/api/webhooks/wh_1/events?page=1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.listEvents).toHaveBeenCalledWith('wh_1', { page: 1 });
  });

  it('POST /api/webhooks/:webhookId/events/:eventId retries a webhook event', async () => {
    mockService.retryEvent.mockResolvedValueOnce({ id: 'evt_1', status: 'PENDING' });
    const res = await request(app).post('/api/webhooks/wh_1/events/evt_1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockService.retryEvent).toHaveBeenCalledWith('wh_1', 'evt_1');
  });
});
