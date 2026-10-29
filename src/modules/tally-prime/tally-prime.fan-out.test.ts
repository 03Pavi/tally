import request from 'supertest';
import express, { type Application } from 'express';
import { createFanOutMiddleware, withCompany } from './tally-prime.fan-out.js';
import { createTallyPrimeRouter } from './tally-prime.routes.js';
import { TallyPrimeController } from './tally-prime.controller.js';
import { TallyPrimeService } from './tally-prime.service.js';
import { TallyPrimeClient } from './tally-prime.client.js';
import { errorHandler } from '../../middleware/error-handler.js';
import { companyFromQuery, setRuntimeDefaultCompany } from './tally-prime.company-context.js';

const TWO_COMPANIES = `<ENVELOPE><BODY><DATA><COLLECTION>
  <COMPANY><NAME>Xsxss</NAME></COMPANY><COMPANY><NAME>Zenmo</NAME></COMPANY>
</COLLECTION></DATA></BODY></ENVELOPE>`;
const ONE_COMPANY = `<ENVELOPE><BODY><DATA><COLLECTION><COMPANY><NAME>Zenmo</NAME></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>`;

function ledgersFor(company: string): string {
  return `<ENVELOPE><BODY><DATA><COLLECTION>
    <LEDGER><NAME>${company} Cash</NAME><PARENT>Cash-in-hand</PARENT><CLOSINGBALANCE>100</CLOSINGBALANCE></LEDGER>
  </COLLECTION></DATA></BODY></ENVELOPE>`;
}

/** A TallyPrime stand-in for these tests: answers company lists and per-company ledgers. */
function fakeTallyPrime(companies: string) {
  return (async (_url: string, init: RequestInit) => {
    const body = String(init.body);
    if (body.includes('TallyPrimeCompanyList')) return new Response(companies, { status: 200 });
    const match = /<SVCURRENTCOMPANY>([^<]*)<\/SVCURRENTCOMPANY>/.exec(body);
    const company = match ? match[1]!.replace(/&amp;/g, '&') : 'none';
    return new Response(ledgersFor(company), { status: 200 });
  }) as unknown as typeof fetch;
}

function buildApp(companies: string): Application {
  const client = new TallyPrimeClient({ baseUrl: 'http://127.0.0.1:9000', timeoutMs: 1000, fetchFn: fakeTallyPrime(companies) });
  const service = new TallyPrimeService(client);
  const app = express();
  app.use(express.json());
  app.use('/tally-prime', companyFromQuery);
  // Dispatch the repeated requests back into this same app, as the live server does.
  app.use('/tally-prime', createFanOutMiddleware(client, () => async (url) => {
    const response = await request(app).get(url);
    return { status: response.status, body: response.body };
  }));
  app.use('/tally-prime', createTallyPrimeRouter(new TallyPrimeController(service)));
  app.use(errorHandler);
  return app;
}

describe('Company fan-out for reads', () => {
  beforeEach(() => setRuntimeDefaultCompany(undefined));

  it('answers each open company when no company is named and several are open', async () => {
    const app = buildApp(TWO_COMPANIES);
    const response = await request(app).get('/tally-prime/ledgers?limit=5');
    expect(response.status).toBe(200);
    expect(response.body.data.map((r: { company: string }) => r.company)).toEqual(['Xsxss', 'Zenmo']);
    expect(response.body.data[0].data.map((l: { name: string }) => l.name)).toEqual(['Xsxss Cash']);
    expect(response.body.data[1].data.map((l: { name: string }) => l.name)).toEqual(['Zenmo Cash']);
    expect(response.body.data[1]).toMatchObject({ status: 200, success: true });
  });

  it('keeps the requested query on every company result', async () => {
    const app = buildApp(TWO_COMPANIES);
    const response = await request(app).get('/tally-prime/ledgers?limit=1');
    expect(response.body.data[0].meta).toEqual({ total: 1, limit: 1, offset: 0 });
  });

  it('answers a single company directly, without grouping', async () => {
    const app = buildApp(ONE_COMPANY);
    const response = await request(app).get('/tally-prime/ledgers');
    expect(response.body.success).toBe(true);
    expect(response.body.data[0].name).toBe('Zenmo Cash');
  });

  it('answers one company when ?company= is given, even if several are open', async () => {
    const app = buildApp(TWO_COMPANIES);
    const response = await request(app).get('/tally-prime/ledgers?company=Xsxss');
    expect(response.body.data[0].name).toBe('Xsxss Cash');
    expect(response.body.data.company).toBeUndefined();
  });

  it('does not fan out writes, which still need an explicit company', async () => {
    const app = buildApp(TWO_COMPANIES);
    const response = await request(app).post('/tally-prime/groups').send({ name: 'X', parent: 'Primary' });
    expect(response.status).not.toBe(200);
    expect(response.body.data).toBeUndefined();
  });

  it('does not fan out company routes', async () => {
    const app = buildApp(TWO_COMPANIES);
    const response = await request(app).get('/tally-prime/companies');
    expect(response.body.data).toBeUndefined();
  });

  it('builds the repeated URL with the company name encoded', () => {
    expect(withCompany('/tally-prime/ledgers?limit=2', 'A & B')).toBe('/tally-prime/ledgers?limit=2&company=A+%26+B');
  });
});
