import request from 'supertest';
import express, { type Application } from 'express';
import { requireAdmin } from '../../middleware/admin-auth.js';
import { errorHandler } from '../../middleware/error-handler.js';
import { TallyPrimeAdminController } from './tally-prime.admin.controller.js';
import { createTallyPrimeAdminRouter } from './tally-prime.admin.routes.js';
import { TallyPrimeAdminService } from './tally-prime.admin.service.js';
import { createTallyPrimeRouter } from './tally-prime.routes.js';
import { TallyPrimeController } from './tally-prime.controller.js';
import { TallyPrimeClient } from './tally-prime.client.js';
import { TallyPrimeService } from './tally-prime.service.js';
import { clearIdempotencyStore } from './tally-prime.idempotency.js';
import { parseImportResult } from './tally-prime.write-parsers.js';
import { companyFromQuery } from './tally-prime.company-context.js';
import { resetRuntimeSettings } from '../../config/runtime-settings.js';
import { setRuntimeDefaultCompany } from './tally-prime.company-context.js';

const TOKEN = 'test-admin-token-0123456789abcdefghij';
const AUTH = { Authorization: `Bearer ${TOKEN}` };

const COMPANIES = `<ENVELOPE><BODY><DATA><COLLECTION><COMPANY><NAME>Zenmo</NAME></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>`;

const COMPANIES_TWO = `<ENVELOPE><BODY><DATA><COLLECTION><COMPANY><NAME>Xsxss</NAME></COMPANY><COMPANY><NAME>Zenmo</NAME></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>`;

const GROUPS = `<ENVELOPE><BODY><DATA><COLLECTION>
  <GROUP><NAME>Primary</NAME><PARENT></PARENT></GROUP>
  <GROUP><NAME>Sundry Creditors</NAME><PARENT>Primary</PARENT></GROUP>
  <GROUP><NAME>Sub Vendors</NAME><PARENT>Sundry Creditors</PARENT></GROUP>
  <GROUP><NAME>Sundry Debtors</NAME><PARENT>Primary</PARENT></GROUP>
  <GROUP><NAME>Current Assets</NAME><PARENT>Primary</PARENT></GROUP>
  <GROUP><NAME>Cash-in-hand</NAME><PARENT>Current Assets</PARENT></GROUP>
  <GROUP><NAME>Current Liabilities</NAME><PARENT>Primary</PARENT></GROUP>
  <GROUP><NAME>Indirect Expenses</NAME><PARENT>Primary</PARENT></GROUP>
</COLLECTION></DATA></BODY></ENVELOPE>`;

const LEDGERS = `<ENVELOPE><BODY><DATA><COLLECTION>
  <LEDGER><NAME>ABC Traders</NAME><PARENT>Sundry Creditors</PARENT><CLOSINGBALANCE>-15000</CLOSINGBALANCE></LEDGER>
  <LEDGER><NAME>Customer One</NAME><PARENT>Sundry Debtors</PARENT><CLOSINGBALANCE>200</CLOSINGBALANCE></LEDGER>
  <LEDGER><NAME>Office Rent</NAME><PARENT>Indirect Expenses</PARENT><CLOSINGBALANCE>0</CLOSINGBALANCE></LEDGER>
  <LEDGER><NAME>Accrued Expenses</NAME><PARENT>Current Liabilities</PARENT><CLOSINGBALANCE>0</CLOSINGBALANCE></LEDGER>
  <LEDGER><NAME>Cash</NAME><PARENT>Cash-in-hand</PARENT><CLOSINGBALANCE>5000</CLOSINGBALANCE></LEDGER>
</COLLECTION></DATA></BODY></ENVELOPE>`;

const VOUCHERS = `<ENVELOPE><BODY><DATA><COLLECTION>
  <VOUCHER><DATE>20260331</DATE><VOUCHERTYPENAME>Journal</VOUCHERTYPENAME><VOUCHERNUMBER>J-1</VOUCHERNUMBER><GUID>g1</GUID></VOUCHER>
</COLLECTION></DATA></BODY></ENVELOPE>`;

function importOk(created = 1): string {
  return `<ENVELOPE><HEADER><VERSION>1</VERSION></HEADER><BODY><DATA><IMPORTRESULT>
    <CREATED>${created}</CREATED><ALTERED>0</ALTERED><DELETED>0</DELETED><ERRORS>0</ERRORS>
  </IMPORTRESULT></DATA></BODY></ENVELOPE>`;
}

function importRejected(message: string): string {
  return `<ENVELOPE><BODY><DATA><IMPORTRESULT>
    <CREATED>0</CREATED><ALTERED>0</ALTERED><DELETED>0</DELETED><ERRORS>1</ERRORS>
  </IMPORTRESULT><LINEERROR>${message}</LINEERROR></DATA></BODY></ENVELOPE>`;
}

interface Harness {
  app: Application;
  requests: string[];
  imports: string[];
  /** URL of every request sent to TallyPrime, in order. */
  urls: string[];
}

interface HarnessOptions {
  importReply?: (xml: string) => string | Error;
  vouchers?: string;
  ledgers?: string;
  /** When false, the client has no configured company, so the single-open rule applies. */
  configured?: boolean;
  /** 'two' lists two open companies instead of Zenmo alone. */
  companies?: 'two';
}

function clearRuntimeDefault(): void {
  setRuntimeDefaultCompany(undefined);
}

function harness(options: HarnessOptions = {}): Harness {
  const requests: string[] = [];
  const imports: string[] = [];
  const urls: string[] = [];
  const fetchFn = jest.fn(async (url: string, init: RequestInit) => {
    urls.push(String(url));
    const body = String(init.body);
    requests.push(body);
    if (body.includes('Import Data')) {
      imports.push(body);
      const reply = options.importReply ? options.importReply(body) : importOk();
      if (reply instanceof Error) throw reply;
      return new Response(reply, { status: 200 });
    }
    let xml = options.companies === 'two' && body.includes('TallyPrimeCompanyList') ? COMPANIES_TWO : COMPANIES;
    if (body.includes('<TYPE>Group</TYPE>')) xml = GROUPS;
    else if (body.includes('<TYPE>Ledger</TYPE>')) xml = options.ledgers ?? LEDGERS;
    else if (body.includes('<TYPE>Voucher</TYPE>')) xml = options.vouchers ?? VOUCHERS;
    return new Response(xml, { status: 200 });
  }) as unknown as typeof fetch;

  // No explicit baseUrl: the client resolves its URL at request time, so runtime changes apply.
  const client = new TallyPrimeClient({
    timeoutMs: 1000,
    fetchFn,
    defaultCompany: options.configured === false ? undefined : 'Zenmo',
  });
  const read = new TallyPrimeService(client);
  const admin = new TallyPrimeAdminService(client, read);

  const app = express();
  app.use(express.json());
  app.use('/tally-prime', requireAdmin);
  app.use('/tally-prime', companyFromQuery);
  app.use('/tally-prime', createTallyPrimeRouter(new TallyPrimeController(read)));
  app.use('/tally-prime', createTallyPrimeAdminRouter(new TallyPrimeAdminController(admin)));
  app.use(errorHandler);
  return { app, requests, imports, urls };
}

const balancedVoucher = {
  type: 'Journal',
  date: '2026-03-31',
  narration: 'Accrual',
  entries: [
    { ledger: 'Office Rent', amount: 10000 },
    { ledger: 'Accrued Expenses', amount: -10000 },
  ],
};

describe('Admin authentication', () => {
  const original = process.env['ADMIN_API_TOKEN'];

  beforeEach(() => {
    process.env['ADMIN_API_TOKEN'] = TOKEN;
    clearIdempotencyStore();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (original === undefined) delete process.env['ADMIN_API_TOKEN'];
    else process.env['ADMIN_API_TOKEN'] = original;
    jest.restoreAllMocks();
  });

  it('refuses requests without a token', async () => {
    const { app } = harness();
    const response = await request(app).get('/tally-prime/groups');
    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it('refuses a wrong token', async () => {
    const { app } = harness();
    const response = await request(app).get('/tally-prime/groups').set('Authorization', 'Bearer wrong');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('disables the admin API when ADMIN_API_TOKEN is unset or too short', async () => {
    delete process.env['ADMIN_API_TOKEN'];
    const { app } = harness();
    const unset = await request(app).get('/tally-prime/groups').set(AUTH);
    expect(unset.status).toBe(503);
    expect(unset.body.error.code).toBe('ADMIN_AUTH_NOT_CONFIGURED');

    process.env['ADMIN_API_TOKEN'] = 'short';
    const short = await request(app).get('/tally-prime/groups').set(AUTH);
    expect(short.status).toBe(503);
  });

  it('keeps the health probe open without a token', async () => {
    const { app } = harness();
    const response = await request(app).get('/tally-prime/health');
    expect(response.status).toBe(200);
  });

  it('never writes the token into the audit log', async () => {
    const { app } = harness();
    await request(app).post('/tally-prime/groups').set(AUTH).send({ name: 'Audit Test', parent: 'Primary' });
    const logged = (console.info as jest.Mock).mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('"operation":"group.create"');
    expect(logged).not.toContain(TOKEN);
    expect(logged).toMatch(/"actor":"admin:[0-9a-f]{8}"/);
  });
});

describe('Runtime admin config', () => {
  const NEW_TOKEN = 'rotated-admin-token-0123456789abcdefghij';

  beforeEach(() => {
    process.env['ADMIN_API_TOKEN'] = TOKEN;
    resetRuntimeSettings();
    clearIdempotencyStore();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetRuntimeSettings();
    jest.restoreAllMocks();
  });

  it('changes the TallyPrime URL and the next request uses it', async () => {
    const { app, urls } = harness();
    const put = await request(app)
      .put('/tally-prime/admin/config')
      .set(AUTH)
      .send({ TALLY_PRIME_URL: 'http://127.0.0.1:9555' });
    expect(put.status).toBe(200);
    expect(put.body.data.changed).toEqual(['TALLY_PRIME_URL']);
    expect(put.body.data.current.TALLY_PRIME_URL).toBe('http://127.0.0.1:9555');

    await request(app).get('/tally-prime/ledgers?company=Zenmo&limit=1').set(AUTH);
    expect(urls[urls.length - 1]).toBe('http://127.0.0.1:9555');
  });

  it('refuses a non-loopback TallyPrime URL and changes nothing', async () => {
    const { app, urls } = harness();
    const before = (await request(app).get('/tally-prime/admin/config').set(AUTH)).body.data.TALLY_PRIME_URL;
    const response = await request(app)
      .put('/tally-prime/admin/config')
      .set(AUTH)
      .send({ TALLY_PRIME_URL: 'http://192.168.1.20:9000' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const current = await request(app).get('/tally-prime/admin/config').set(AUTH);
    expect(current.body.data.TALLY_PRIME_URL).toBe(before);
    expect(urls).toHaveLength(0);
  });

  it('rotates the admin token: the old token stops working at once, the new one works', async () => {
    const { app } = harness();
    const put = await request(app).put('/tally-prime/admin/config').set(AUTH).send({ ADMIN_API_TOKEN: NEW_TOKEN });
    expect(put.status).toBe(200);
    expect(put.body.data.changed).toEqual(['ADMIN_API_TOKEN']);

    expect((await request(app).get('/tally-prime/admin/config').set(AUTH)).status).toBe(401);
    const withNew = await request(app).get('/tally-prime/admin/config').set('Authorization', `Bearer ${NEW_TOKEN}`);
    expect(withNew.status).toBe(200);
    expect(withNew.body.data.ADMIN_API_TOKEN).toEqual({ configured: true, source: 'runtime' });
  });

  it('never returns a token value', async () => {
    const { app } = harness();
    await request(app).put('/tally-prime/admin/config').set(AUTH).send({ ADMIN_API_TOKEN: NEW_TOKEN });
    const response = await request(app).get('/tally-prime/admin/config').set('Authorization', `Bearer ${NEW_TOKEN}`);
    expect(JSON.stringify(response.body)).not.toContain(NEW_TOKEN);
    expect(JSON.stringify(response.body)).not.toContain(TOKEN);
  });

  it('refuses a short or spaced token', async () => {
    const { app } = harness();
    expect((await request(app).put('/tally-prime/admin/config').set(AUTH).send({ ADMIN_API_TOKEN: 'short' })).status).toBe(400);
    expect(
      (await request(app).put('/tally-prime/admin/config').set(AUTH).send({ ADMIN_API_TOKEN: 'has a space in it 0123456789abcdefghijk' })).status
    ).toBe(400);
  });

  it('requires an empty body to be refused and needs the admin token to change settings', async () => {
    const { app } = harness();
    expect((await request(app).put('/tally-prime/admin/config').set(AUTH).send({})).status).toBe(400);
    expect((await request(app).put('/tally-prime/admin/config').send({ TALLY_PRIME_URL: 'http://127.0.0.1:9000' })).status).toBe(401);
  });
});

describe('Admin writes', () => {
  beforeEach(() => {
    process.env['ADMIN_API_TOKEN'] = TOKEN;
    clearIdempotencyStore();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('vouchers', () => {
    it('rejects an unbalanced voucher without contacting TallyPrime to import it', async () => {
      const { app, imports } = harness();
      const response = await request(app)
        .post('/tally-prime/vouchers')
        .set(AUTH)
        .send({ ...balancedVoucher, entries: [{ ledger: 'Office Rent', amount: 100 }, { ledger: 'Accrued Expenses', amount: -90 }] });
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body.error.details)).toMatch(/must be equal/);
      expect(imports).toHaveLength(0);
    });

    it('rejects a voucher that references a missing ledger and lists the names', async () => {
      const { app, imports } = harness();
      const response = await request(app)
        .post('/tally-prime/vouchers')
        .set(AUTH)
        .send({ ...balancedVoucher, entries: [{ ledger: 'Ghost Ltd', amount: 50 }, { ledger: 'Office Rent', amount: -50 }] });
      expect(response.status).toBe(422);
      expect(response.body.error.details).toEqual(['Ghost Ltd']);
      expect(imports).toHaveLength(0);
    });

    it('posts a balanced voucher with debit/credit flags and two-decimal amounts', async () => {
      const { app, imports } = harness();
      const response = await request(app).post('/tally-prime/vouchers').set(AUTH).send(balancedVoucher);
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({ created: true, type: 'Journal', date: '2026-03-31', number: null });
      expect(response.body.data.counts).toEqual({ created: 1, altered: 0, deleted: 0 });

      const xml = imports[0]!;
      expect(xml).toContain('<VOUCHER VCHTYPE="Journal" ACTION="Create">');
      expect(xml).toContain('<AMOUNT>10000.00</AMOUNT>');
      expect(xml).toContain('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>');
      expect(xml).toContain('<AMOUNT>-10000.00</AMOUNT>');
      expect(xml).toContain('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
    });

    it('does not report success when TallyPrime rejects the voucher', async () => {
      const { app } = harness({ importReply: () => importRejected('Voucher date is out of the financial year') });
      const response = await request(app).post('/tally-prime/vouchers').set(AUTH).send(balancedVoucher);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('TALLYPRIME_REJECTED');
      expect(response.body.error.details).toEqual(['Voucher date is out of the financial year']);
      expect(response.body.data).toBeUndefined();
    });

    it('refuses a duplicate voucher number on the same date and type', async () => {
      const { app, imports } = harness();
      const response = await request(app)
        .post('/tally-prime/vouchers')
        .set(AUTH)
        .send({ ...balancedVoucher, number: 'J-1' });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('DUPLICATE_VOUCHER');
      expect(imports).toHaveLength(0);
    });

    it('replays a retried request with the same Idempotency-Key without posting twice', async () => {
      const { app, imports } = harness();
      const first = await request(app)
        .post('/tally-prime/vouchers')
        .set(AUTH)
        .set('Idempotency-Key', 'order-42')
        .send(balancedVoucher);
      const second = await request(app)
        .post('/tally-prime/vouchers')
        .set(AUTH)
        .set('Idempotency-Key', 'order-42')
        .send(balancedVoucher);
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect(second.body).toEqual(first.body);
      expect(imports).toHaveLength(1);
    });

    it('refuses an Idempotency-Key reused with a different body', async () => {
      const { app } = harness();
      await request(app).post('/tally-prime/vouchers').set(AUTH).set('Idempotency-Key', 'k-1').send(balancedVoucher);
      const other = await request(app)
        .post('/tally-prime/vouchers')
        .set(AUTH)
        .set('Idempotency-Key', 'k-1')
        .send({ ...balancedVoucher, narration: 'Different' });
      expect(other.status).toBe(409);
      expect(other.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('lets a client retry after a rejected attempt with the same key', async () => {
      let attempts = 0;
      const { app, imports } = harness({
        importReply: () => (++attempts === 1 ? importRejected('Temporary lock') : importOk()),
      });
      const failed = await request(app)
        .post('/tally-prime/vouchers')
        .set(AUTH)
        .set('Idempotency-Key', 'retry-me')
        .send(balancedVoucher);
      expect(failed.status).toBe(422);
      const retried = await request(app)
        .post('/tally-prime/vouchers')
        .set(AUTH)
        .set('Idempotency-Key', 'retry-me')
        .send(balancedVoucher);
      expect(retried.status).toBe(201);
      expect(imports).toHaveLength(2);
    });

    it('rejects an invalid Idempotency-Key', async () => {
      const { app } = harness();
      const response = await request(app)
        .post('/tally-prime/vouchers')
        .set(AUTH)
        .set('Idempotency-Key', 'bad key!')
        .send(balancedVoucher);
      expect(response.status).toBe(400);
    });

    it('lists vouchers for a period and filters by type', async () => {
      const { app } = harness();
      const response = await request(app)
        .get('/tally-prime/vouchers?fromDate=2026-04-01&toDate=2026-04-30&type=Journal')
        .set(AUTH);
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([
        expect.objectContaining({ date: '2026-03-31', type: 'Journal', number: 'J-1' }),
      ]);
    });

    it('rejects a voucher list range longer than 366 days', async () => {
      const { app } = harness();
      const response = await request(app)
        .get('/tally-prime/vouchers?fromDate=2024-01-01&toDate=2026-01-01')
        .set(AUTH);
      expect(response.status).toBe(400);
    });

    it('deletes a voucher only with confirm=true and an exact match', async () => {
      const { app, imports } = harness();
      const refused = await request(app).delete('/tally-prime/vouchers/Journal/J-1?date=2026-03-31').set(AUTH);
      expect(refused.status).toBe(400);
      expect(imports).toHaveLength(0);

      const deleted = await request(app)
        .delete('/tally-prime/vouchers/Journal/J-1?date=2026-03-31&confirm=true')
        .set(AUTH);
      expect(deleted.status).toBe(200);
      expect(imports[0]).toContain('ACTION="Delete"');
    });

    it('reports 404 when no voucher matches the delete request', async () => {
      const { app, imports } = harness();
      const response = await request(app)
        .delete('/tally-prime/vouchers/Journal/J-99?date=2026-03-31&confirm=true')
        .set(AUTH);
      expect(response.status).toBe(404);
      expect(imports).toHaveLength(0);
    });
  });

  describe('ledgers and groups', () => {
    it('creates a ledger under an existing group with escaped text', async () => {
      const { app, imports } = harness();
      const response = await request(app)
        .post('/tally-prime/ledgers')
        .set(AUTH)
        .send({ name: 'Bright & <Co>', parent: 'Sundry Creditors', openingBalance: -5000, gstin: '27AAAPL1234C1ZV' });
      expect(response.status).toBe(201);
      const xml = imports[0]!;
      expect(xml).toContain('ACTION="Create"');
      expect(xml).toContain('Bright &amp; &lt;Co&gt;');
      expect(xml).toContain('<OPENINGBALANCE>-5000.00</OPENINGBALANCE>');
      expect(xml).toContain('<PARTYGSTIN>27AAAPL1234C1ZV</PARTYGSTIN>');
    });

    it('refuses a ledger whose parent group does not exist', async () => {
      const { app, imports } = harness();
      const response = await request(app)
        .post('/tally-prime/ledgers')
        .set(AUTH)
        .send({ name: 'Orphan', parent: 'No Such Group' });
      expect(response.status).toBe(404);
      expect(imports).toHaveLength(0);
    });

    it('refuses a duplicate ledger name', async () => {
      const { app, imports } = harness();
      const response = await request(app).post('/tally-prime/ledgers').set(AUTH).send({ name: 'cash', parent: 'Cash-in-hand' });
      expect(response.status).toBe(409);
      expect(imports).toHaveLength(0);
    });

    it('refuses unknown fields and invalid GSTIN', async () => {
      const { app } = harness();
      const unknown = await request(app).post('/tally-prime/ledgers').set(AUTH).send({ name: 'X', parent: 'Cash-in-hand', balance: 5 });
      expect(unknown.status).toBe(400);
      const gstin = await request(app)
        .post('/tally-prime/ledgers')
        .set(AUTH)
        .send({ name: 'X', parent: 'Cash-in-hand', gstin: 'NOT-A-GSTIN' });
      expect(gstin.status).toBe(400);
    });

    it('rejects an amount with more than two decimals', async () => {
      const { app } = harness();
      const response = await request(app)
        .post('/tally-prime/ledgers')
        .set(AUTH)
        .send({ name: 'X', parent: 'Cash-in-hand', openingBalance: 1.005 });
      expect(response.status).toBe(400);
    });

    it('requires confirm=true to delete a ledger, then deletes it', async () => {
      const { app, imports } = harness();
      const refused = await request(app).delete('/tally-prime/ledgers/Cash').set(AUTH);
      expect(refused.status).toBe(400);
      const deleted = await request(app).delete('/tally-prime/ledgers/Cash?confirm=true').set(AUTH);
      expect(deleted.status).toBe(200);
      expect(imports[0]).toContain('ACTION="Delete"');
    });

    it('returns TallyPrime business errors on ledger deletion as 422', async () => {
      const { app } = harness({ importReply: () => importRejected('Ledger has transactions and cannot be deleted') });
      const response = await request(app).delete('/tally-prime/ledgers/Cash?confirm=true').set(AUTH);
      expect(response.status).toBe(422);
      expect(response.body.error.details).toEqual(['Ledger has transactions and cannot be deleted']);
    });

    it('refuses to move a group beneath its own descendant', async () => {
      const { app, imports } = harness();
      const response = await request(app)
        .patch('/tally-prime/groups/Sundry Creditors')
        .set(AUTH)
        .send({ parent: 'Sub Vendors' });
      expect(response.status).toBe(422);
      expect(imports).toHaveLength(0);
    });

    it('creates a group under an existing parent', async () => {
      const { app, imports } = harness();
      const response = await request(app)
        .post('/tally-prime/groups')
        .set(AUTH)
        .send({ name: 'Vendor Advances', parent: 'Current Assets' });
      expect(response.status).toBe(201);
      expect(imports[0]).toContain('<GROUP NAME="Vendor Advances" ACTION="Create">');
    });
  });

  describe('vendors and customers', () => {
    it('refuses a vendor whose parent is outside the vendor group', async () => {
      const { app, imports } = harness();
      const response = await request(app)
        .post('/tally-prime/vendors')
        .set(AUTH)
        .send({ name: 'Wrong Parent', parent: 'Cash-in-hand' });
      expect(response.status).toBe(422);
      expect(imports).toHaveLength(0);
    });

    it('creates a vendor under Sundry Creditors by default', async () => {
      const { app, imports } = harness();
      const response = await request(app).post('/tally-prime/vendors').set(AUTH).send({ name: 'New Vendor' });
      expect(response.status).toBe(201);
      expect(imports[0]).toContain('<PARENT>Sundry Creditors</PARENT>');
    });

    it('does not update a customer through the vendor route', async () => {
      const { app, imports } = harness();
      const response = await request(app).patch('/tally-prime/vendors/Customer One').set(AUTH).send({ email: 'a@b.co' });
      expect(response.status).toBe(404);
      expect(imports).toHaveLength(0);
    });

    it('lists customer balances as receivables', async () => {
      const { app } = harness();
      const response = await request(app).get('/tally-prime/customers/outstanding').set(AUTH);
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([
        expect.objectContaining({ name: 'Customer One', closingBalance: 200, receivable: 200 }),
      ]);
    });
  });

  describe('company and unsupported operations', () => {
    it('selects an open company as the runtime default, matched case-insensitively', async () => {
      clearRuntimeDefault();
      const { app, imports } = harness({ configured: false });
      const selected = await request(app).post('/tally-prime/companies/select').set(AUTH).send({ name: 'zenmo' });
      expect(selected.status).toBe(200);
      expect(selected.body.data).toEqual({ name: 'Zenmo', source: 'runtime' });

      const current = await request(app).get('/tally-prime/companies/current').set(AUTH);
      expect(current.body.data).toEqual({ name: 'Zenmo', source: 'runtime' });
      expect(imports).toHaveLength(0);
      clearRuntimeDefault();
    });

    it('refuses to select a company that is not open, and changes nothing', async () => {
      clearRuntimeDefault();
      const { app } = harness({ configured: false });
      const response = await request(app).post('/tally-prime/companies/select').set(AUTH).send({ name: 'Other Ltd' });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('COMPANY_NOT_OPEN');
      const current = await request(app).get('/tally-prime/companies/current').set(AUTH);
      expect(current.body.data.source).toBe('single-open');
    });

    it('lists open companies and marks the one this request uses', async () => {
    clearRuntimeDefault();
    const { app } = harness({ configured: false });
    const response = await request(app).get('/tally-prime/companies?company=Zenmo').set(AUTH);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ name: 'Zenmo', guid: null, active: true }]);
  });

  it('refuses the company list without the admin token', async () => {
    const { app } = harness();
    expect((await request(app).get('/tally-prime/companies')).status).toBe(401);
  });

  it('shows the open companies, with no active one, when several are open', async () => {
    clearRuntimeDefault();
    const { app } = harness({ configured: false, companies: 'two' });
    const response = await request(app).get('/tally-prime/companies/current').set(AUTH);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ name: null, source: 'none', openCompanies: ['Xsxss', 'Zenmo'] });
  });

  it('applies ?company= to a single request and reports the request source', async () => {
      clearRuntimeDefault();
      const { app } = harness({ configured: false });
      const response = await request(app).get('/tally-prime/companies/current?company=Zenmo').set(AUTH);
      expect(response.body.data).toEqual({ name: 'Zenmo', source: 'request' });
    });

    it('refuses ?company= naming a company that is not open', async () => {
      const { app } = harness();
      const response = await request(app).get('/tally-prime/ledgers?company=Other%20Ltd').set(AUTH);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('COMPANY_NOT_OPEN');
    });

    it('rejects an empty ?company= parameter', async () => {
      const { app } = harness();
      const response = await request(app).get('/tally-prime/ledgers?company=').set(AUTH);
      expect(response.status).toBe(400);
    });

    it('clears the runtime selection', async () => {
      clearRuntimeDefault();
      const { app } = harness({ configured: false });
      await request(app).post('/tally-prime/companies/select').set(AUTH).send({ name: 'Zenmo' });
      const cleared = await request(app).delete('/tally-prime/companies/select').set(AUTH);
      expect(cleared.status).toBe(200);
      const current = await request(app).get('/tally-prime/companies/current').set(AUTH);
      expect(current.body.data.source).toBe('single-open');
    });

    it('answers 501 for stock summary and bill-wise reports', async () => {
      const { app } = harness();
      expect((await request(app).get('/tally-prime/reports/stock-summary').set(AUTH)).status).toBe(501);
      expect((await request(app).get('/tally-prime/reports/receivables-payables').set(AUTH)).status).toBe(501);
    });
  });

  describe('TallyPrime failures', () => {
    it('reports an unavailable TallyPrime as 503 on writes', async () => {
      const { app } = harness({ importReply: () => Object.assign(new TypeError('fetch failed'), {}) });
      const response = await request(app).post('/tally-prime/groups').set(AUTH).send({ name: 'X1', parent: 'Primary' });
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('TALLYPRIME_UNAVAILABLE');
    });

    it('reports a malformed import response as 502 and never as success', async () => {
      const { app } = harness({ importReply: () => '<html>proxy error</html>' });
      const response = await request(app).post('/tally-prime/groups').set(AUTH).send({ name: 'X2', parent: 'Primary' });
      expect(response.status).toBe(502);
      expect(response.body.data).toBeUndefined();
    });

    it('reports a timed-out import as 504', async () => {
      const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
      const { app } = harness({ importReply: () => timeout });
      const response = await request(app).post('/tally-prime/groups').set(AUTH).send({ name: 'X3', parent: 'Primary' });
      expect(response.status).toBe(504);
    });

    it('turns a malformed JSON body into 400 without a stack trace', async () => {
      const { app } = harness();
      const response = await request(app)
        .post('/tally-prime/groups')
        .set(AUTH)
        .set('Content-Type', 'application/json')
        .send('{"name": ');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(JSON.stringify(response.body)).not.toMatch(/at |stack/i);
    });
  });
});

describe('Import response parsing', () => {
  it('treats ERRORS > 0 as a rejection, with the LINEERROR text', () => {
    const result = parseImportResult(importRejected('Bad date'));
    expect(result).toMatchObject({ created: 0, errors: 1, lineErrors: ['Bad date'] });
  });

  it('reads counters from a RESPONSE element as well as IMPORTRESULT', () => {
    const xml = '<ENVELOPE><BODY><DATA><RESPONSE><CREATED>1</CREATED><ALTERED>0</ALTERED><DELETED>0</DELETED><ERRORS>0</ERRORS></RESPONSE></DATA></BODY></ENVELOPE>';
    expect(parseImportResult(xml)).toMatchObject({ created: 1, errors: 0 });
  });
});
