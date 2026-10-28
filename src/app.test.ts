import request from 'supertest';
import { createApp } from './app.js';

describe('App Integration & Swagger Documentation', () => {
  const app = createApp();

  it('GET /health returns 200 with uptime and status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.uptime).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('GET /api-docs.json returns valid OpenAPI 3 specification', async () => {
    const response = await request(app).get('/api-docs.json');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.info.title).toBe('Tally API Integration Service');
    expect(response.body.paths['/health']).toBeDefined();
    expect(response.body.paths['/api/users/me']).toBeDefined();
    expect(response.body.paths['/api/forms']).toBeDefined();
    expect(response.body.paths['/api/forms/{formId}']).toBeDefined();
    expect(response.body.paths['/api/workspaces']).toBeDefined();
    expect(response.body.paths['/api/webhooks']).toBeDefined();
    expect(response.body.paths['/api/analytics/forms/{formId}/metrics']).toBeDefined();
    expect(response.body.components.schemas.User).toBeDefined();
    expect(response.body.components.schemas.Form).toBeDefined();
    expect(response.body.components.schemas.Submission).toBeDefined();
  });

  it('GET /api-docs/ serves Swagger UI documentation page', async () => {
    const response = await request(app).get('/api-docs/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('id="swagger-ui"');
    expect(response.text).toContain('swagger-ui-bundle.js');
  });

  it('GET /non-existent-route returns 404 with error payload', async () => {
    const response = await request(app).get('/unmatched-random-route');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
