import request from 'supertest';
import { createApp } from './app.js';

describe('App Integration & Swagger Documentation', () => {
  const app = createApp();
  const ADMIN_TOKEN = 'app-test-admin-token-0123456789abcdefghij';
  const previousToken = process.env['ADMIN_API_TOKEN'];

  beforeAll(() => {
    process.env['ADMIN_API_TOKEN'] = ADMIN_TOKEN;
  });

  afterAll(() => {
    if (previousToken === undefined) delete process.env['ADMIN_API_TOKEN'];
    else process.env['ADMIN_API_TOKEN'] = previousToken;
  });

  it('lets normal users read TallyPrime data without a token', async () => {
    const response = await request(app).get('/tally-prime/reports/stock-summary');
    // Any status other than 401 means the request was not refused for a missing token
    expect(response.status).not.toBe(401);
  });

  it('requires the admin token for writes', async () => {
    const response = await request(app).post('/tally-prime/groups').send({ name: 'X', parent: 'Primary' });
    expect(response.status).toBe(401);
  });

  it('requires the admin token for company management, including the list', async () => {
    expect((await request(app).get('/tally-prime/companies')).status).toBe(401);
    expect((await request(app).get('/tally-prime/companies/current')).status).toBe(401);
    expect((await request(app).post('/tally-prime/companies/select').send({ name: 'Zenmo' })).status).toBe(401);
  });

  it('accepts the admin token on writes', async () => {
    const response = await request(app)
      .post('/tally-prime/groups')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'X', parent: 'No Such Parent' });
    // Authenticated: the request reaches validation and TallyPrime, so it is not 401
    expect(response.status).not.toBe(401);
  });

  it('GET / redirects to /api-docs', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(302);
    expect(response.headers['location']).toBe('/api-docs');
  });

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
    expect(response.body.info.title).toBe('TallyPrime Mediator API');
    expect(response.body.paths['/health']).toBeDefined();
    const paths = Object.keys(response.body.paths);
    expect(paths.filter((path) => path.startsWith('/api/'))).toEqual([]);
    expect(paths.filter((path) => path.startsWith('/tally-prime')).length).toBeGreaterThan(0);
    expect(response.body.paths['/tally-prime/vendors/outstanding']).toBeDefined();
    expect(response.body.paths['/tally-prime/vouchers']).toBeDefined();
    expect(response.body.components.schemas.TallyPrimeLedger).toBeDefined();
  });

  it('GET /api-docs/ serves Swagger UI documentation page', async () => {
    const response = await request(app).get('/api-docs/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('id="swagger-ui"');
    expect(response.text).toContain('swagger-ui-bundle.js');
  });

  it('removed Tally.so routes return 404', async () => {
    const response = await request(app).get('/api/users/me');
    expect(response.status).toBe(404);
  });

  it('GET /non-existent-route returns 404 with error payload', async () => {
    const response = await request(app).get('/unmatched-random-route');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
