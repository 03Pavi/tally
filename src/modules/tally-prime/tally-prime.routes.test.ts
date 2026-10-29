import request from 'supertest';
import express, { type Application } from 'express';
import { createTallyPrimeRouter } from './tally-prime.routes.js';
import { TallyPrimeController } from './tally-prime.controller.js';
import { TallyPrimeService } from './tally-prime.service.js';
import { TallyPrimeClient } from './tally-prime.client.js';
import { errorHandler } from '../../middleware/error-handler.js';
import { createTallyPrimeAdminRouter } from './tally-prime.admin.routes.js';
import { TallyPrimeAdminController } from './tally-prime.admin.controller.js';
import { TallyPrimeAdminService } from './tally-prime.admin.service.js';

const COMPANIES_XML = `<ENVELOPE><BODY><DATA><COLLECTION><COMPANY><NAME>Zenmo</NAME></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>`;
const GROUPS_XML = `<ENVELOPE><BODY><DATA><COLLECTION>
  <GROUP><NAME>Sundry Creditors</NAME><PARENT>Primary</PARENT></GROUP>
</COLLECTION></DATA></BODY></ENVELOPE>`;
const LEDGERS_XML = `<ENVELOPE><BODY><DATA><COLLECTION>
  <LEDGER><NAME>ABC Traders</NAME><PARENT>Sundry Creditors</PARENT><CLOSINGBALANCE>-15000</CLOSINGBALANCE></LEDGER>
  <LEDGER><NAME>Cash</NAME><PARENT>Cash-in-hand</PARENT><CLOSINGBALANCE>5000</CLOSINGBALANCE></LEDGER>
</COLLECTION></DATA></BODY></ENVELOPE>`;

function buildApp(fetchFn: typeof fetch): Application {
  const client = new TallyPrimeClient({ baseUrl: 'http://127.0.0.1:9000', timeoutMs: 1000, fetchFn, defaultCompany: 'Zenmo' });
  const controller = new TallyPrimeController(new TallyPrimeService(client));
  const app = express();
  app.use(express.json());
  app.use('/tally-prime', createTallyPrimeRouter(controller));
  app.use('/tally-prime', createTallyPrimeAdminRouter(new TallyPrimeAdminController(new TallyPrimeAdminService(client, new TallyPrimeService(client)))));
  app.use(errorHandler);
  return app;
}

function xmlFetch(overrides: { ledgers?: string; fail?: unknown } = {}): typeof fetch {
  return (async (_url: string, init: RequestInit) => {
    if (overrides.fail !== undefined) throw overrides.fail;
    const body = String(init.body);
    let xml = LEDGERS_XML;
    if (body.includes('<ID>TallyPrimeCompanyList</ID>')) xml = COMPANIES_XML;
    else if (body.includes('<TYPE>Group</TYPE>')) xml = GROUPS_XML;
    else if (body.includes('<TYPE>Ledger</TYPE>')) xml = overrides.ledgers ?? LEDGERS_XML;
    return new Response(xml, { status: 200 });
  }) as unknown as typeof fetch;
}

describe('TallyPrime routes', () => {
  it('GET /tally-prime/health reports process health without contacting TallyPrime', async () => {
    const fetchFn = jest.fn(xmlFetch());
    const response = await request(buildApp(fetchFn as unknown as typeof fetch)).get('/tally-prime/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { status: 'ok' } });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('GET /tally-prime/connection returns connected true after a real request', async () => {
    const response = await request(buildApp(xmlFetch())).get('/tally-prime/connection');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { connected: true, message: 'TallyPrime is reachable', companyCount: 1 },
    });
  });

  it('GET /tally-prime/connection returns 503 with a safe message when TallyPrime is down', async () => {
    const response = await request(buildApp(xmlFetch({ fail: new TypeError('fetch failed') }))).get(
      '/tally-prime/connection'
    );
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('TALLYPRIME_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toMatch(/stack|<ENVELOPE/);
  });

  it('GET /tally-prime/companies is served by the admin router, not the read router', async () => {
    const response = await request(buildApp(xmlFetch())).get('/tally-prime/companies');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ name: 'Zenmo', guid: null, active: true }]);
  });

  it('GET /tally-prime/ledgers returns paginated ledgers with meta', async () => {
    const response = await request(buildApp(xmlFetch())).get('/tally-prime/ledgers?limit=1&offset=0');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta).toEqual({ total: 2, limit: 1, offset: 0 });
  });

  it('rejects an invalid limit with 400', async () => {
    const response = await request(buildApp(xmlFetch())).get('/tally-prime/ledgers?limit=0');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /tally-prime/ledgers/:name returns 404 for a missing ledger', async () => {
    const response = await request(buildApp(xmlFetch())).get('/tally-prime/ledgers/Missing%20Ltd');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('routes vendors/outstanding to the outstanding handler, not to vendors/:name', async () => {
    const response = await request(buildApp(xmlFetch())).get('/tally-prime/vendors/outstanding');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      { name: 'ABC Traders', group: 'Sundry Creditors', closingBalance: -15000, balanceNature: 'credit', payable: 15000 },
    ]);
  });

  it('GET /tally-prime/vendors/:name returns the vendor', async () => {
    const response = await request(buildApp(xmlFetch())).get('/tally-prime/vendors/ABC%20Traders');
    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('ABC Traders');
  });

  it('rejects impossible calendar dates', async () => {
    const response = await request(buildApp(xmlFetch())).get('/tally-prime/reports/balance-sheet?asOfDate=2026-02-30');
    expect(response.status).toBe(400);
  });

  it('rejects a reversed profit & loss range', async () => {
    const response = await request(buildApp(xmlFetch())).get(
      '/tally-prime/reports/profit-loss?fromDate=2026-03-31&toDate=2025-04-01'
    );
    expect(response.status).toBe(400);
  });

  it('rejects a profit & loss request with only one date', async () => {
    const response = await request(buildApp(xmlFetch())).get('/tally-prime/reports/profit-loss?fromDate=2025-04-01');
    expect(response.status).toBe(400);
  });

  it('maps a TallyPrime timeout to 504 without exposing internals', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    const response = await request(buildApp(xmlFetch({ fail: timeout }))).get('/tally-prime/vendors');
    expect(response.status).toBe(504);
    expect(response.body.error.code).toBe('UPSTREAM_GATEWAY_TIMEOUT');
  });
});
