import { TallyPrimeClient } from './tally-prime.client.js';
import { TallyPrimeService, vendorGroupNames } from './tally-prime.service.js';
import { TallyPrimeError } from './tally-prime.errors.js';
import {
  parseCompanies,
  parseGroups,
  parseLedgers,
  parseReportLines,
  parseSignedAmount,
} from './tally-prime.parsers.js';
import {
  buildBalanceSheetRequest,
  buildLedgerListRequest,
  buildProfitLossRequest,
} from './tally-prime.requests.js';

const COMPANIES_XML = `<ENVELOPE><HEADER><VERSION>1</VERSION></HEADER><BODY><DATA>
  <COLLECTION>
    <COMPANY NAME="Zenmo"><NAME>Zenmo</NAME><GUID>guid-1</GUID></COMPANY>
  </COLLECTION>
</DATA></BODY></ENVELOPE>`;

const GROUPS_XML = `<ENVELOPE><BODY><DATA><COLLECTION>
  <GROUP NAME="Sundry Creditors"><NAME>Sundry Creditors</NAME><PARENT>Primary</PARENT></GROUP>
  <GROUP NAME="Sub Vendors"><NAME>Sub Vendors</NAME><PARENT>Sundry Creditors</PARENT></GROUP>
  <GROUP NAME="Sundry Debtors"><NAME>Sundry Debtors</NAME><PARENT>Primary</PARENT></GROUP>
</COLLECTION></DATA></BODY></ENVELOPE>`;

const LEDGERS_XML = `<ENVELOPE><BODY><DATA><COLLECTION>
  <LEDGER NAME="ABC Traders">
    <NAME>ABC Traders</NAME><PARENT>Sundry Creditors</PARENT>
    <OPENINGBALANCE>0</OPENINGBALANCE><CLOSINGBALANCE>-15000.00</CLOSINGBALANCE>
    <PARTYGSTIN>27AAAPL1234C1ZV</PARTYGSTIN>
    <ADDRESS.LIST><ADDRESS>Plot 12</ADDRESS><ADDRESS>Pune</ADDRESS></ADDRESS.LIST>
  </LEDGER>
  <LEDGER NAME="Vendor Two">
    <NAME>Vendor Two</NAME><PARENT>Sub Vendors</PARENT>
    <OPENINGBALANCE></OPENINGBALANCE><CLOSINGBALANCE>500.00 Dr</CLOSINGBALANCE>
  </LEDGER>
  <LEDGER NAME="Cash"><NAME>Cash</NAME><PARENT>Cash-in-hand</PARENT><CLOSINGBALANCE>5000</CLOSINGBALANCE></LEDGER>
  <LEDGER NAME="Customer"><NAME>Customer</NAME><PARENT>Sundry Debtors</PARENT><CLOSINGBALANCE>-200</CLOSINGBALANCE></LEDGER>
</COLLECTION></DATA></BODY></ENVELOPE>`;

const BALANCE_SHEET_XML = `<ENVELOPE><BODY><DATA><TALLYMESSAGE>
  <DSPACCINFO><DSPDISPNAME>Cash-in-hand</DSPDISPNAME><DSPCLDRAMTA>5000.00</DSPCLDRAMTA></DSPACCINFO>
  <DSPACCNAME><DSPDISPNAME>Capital Account</DSPDISPNAME></DSPACCNAME><DSPCLCRAMTA>20000.00</DSPCLCRAMTA>
</TALLYMESSAGE></DATA></BODY></ENVELOPE>`;

/** Answers each TallyPrime request type with its fixture. Records every request body. */
function fakeTallyPrime(overrides: Partial<Record<'companies' | 'groups' | 'ledgers' | 'report', string>> = {}) {
  const requests: string[] = [];
  const fetchFn = jest.fn(async (_url: string, init: RequestInit) => {
    const body = String(init.body);
    requests.push(body);
    let xml: string;
    if (body.includes('<ID>TallyPrimeCompanyList</ID>')) xml = overrides.companies ?? COMPANIES_XML;
    else if (body.includes('<TYPE>Group</TYPE>')) xml = overrides.groups ?? GROUPS_XML;
    else if (body.includes('<TYPE>Ledger</TYPE>')) xml = overrides.ledgers ?? LEDGERS_XML;
    else xml = overrides.report ?? BALANCE_SHEET_XML;
    return new Response(xml, { status: 200 });
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, requests };
}

function serviceFor(fetchFn: typeof fetch, defaultCompany?: string): TallyPrimeService {
  const client = new TallyPrimeClient({
    baseUrl: 'http://127.0.0.1:9000',
    timeoutMs: 1000,
    fetchFn,
    defaultCompany,
  });
  return new TallyPrimeService(client);
}

describe('TallyPrime parsers', () => {
  it('reads signed amounts: plain numbers keep their sign, Dr is positive, Cr is negative', () => {
    expect(parseSignedAmount('-15000.00')).toBe(-15000);
    expect(parseSignedAmount('5000')).toBe(5000);
    expect(parseSignedAmount('500.00 Dr')).toBe(500);
    expect(parseSignedAmount('1,200.50 Cr')).toBe(-1200.5);
    expect(parseSignedAmount('')).toBeNull();
    expect(parseSignedAmount('abc')).toBeNull();
    expect(parseSignedAmount(undefined)).toBeNull();
  });

  it('parses company names and GUIDs without inventing missing values', () => {
    expect(parseCompanies(COMPANIES_XML)).toEqual([{ name: 'Zenmo', guid: 'guid-1' }]);
    const escaped = '<ENVELOPE><BODY><DATA><COLLECTION><COMPANY><NAME>Zenmo &amp; Co</NAME></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>';
    expect(parseCompanies(escaped)).toEqual([{ name: 'Zenmo & Co', guid: null }]);
  });

  it('returns an empty company list for an empty collection', () => {
    const xml = '<ENVELOPE><BODY><DATA><COLLECTION></COLLECTION></DATA></BODY></ENVELOPE>';
    expect(parseCompanies(xml)).toEqual([]);
  });

  it('parses ledgers with group, balances, GSTIN and address lines; null where absent', () => {
    const ledgers = parseLedgers(LEDGERS_XML);
    expect(ledgers[0]).toMatchObject({
      name: 'ABC Traders',
      parent: 'Sundry Creditors',
      closingBalance: '-15000.00',
      partyGstin: '27AAAPL1234C1ZV',
      addressLines: ['Plot 12', 'Pune'],
    });
    expect(ledgers[1]).toMatchObject({ name: 'Vendor Two', partyGstin: null, addressLines: [] });
  });

  it('rejects a non-XML body as malformed', () => {
    expect(() => parseGroups('<html>oops')).toThrow(TallyPrimeError);
  });

  it('rejects a response without DATA as malformed', () => {
    expect(() => parseCompanies('<ENVELOPE><BODY></BODY></ENVELOPE>')).toThrow(TallyPrimeError);
  });

  it('turns a LINEERROR response into a rejected request without exposing its text', () => {
    const xml = '<ENVELOPE><LINEERROR>Company "Secret Ltd" is not open</LINEERROR></ENVELOPE>';
    let caught: unknown;
    try {
      parseCompanies(xml);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TallyPrimeError);
    expect((caught as TallyPrimeError).message).toBe('TallyPrime rejected the request');
    expect((caught as TallyPrimeError).message).not.toContain('Secret');
  });

  it('parses report rows and fails when a report has no recognizable rows', () => {
    expect(parseReportLines(BALANCE_SHEET_XML)).toHaveLength(2);
    expect(parseReportLines(BALANCE_SHEET_XML)).toEqual(
      expect.arrayContaining([
        { name: 'Cash-in-hand', closingDebit: 5000, closingCredit: null },
        { name: 'Capital Account', closingDebit: null, closingCredit: 20000 },
      ])
    );
    expect(() => parseReportLines('<ENVELOPE><BODY><DATA></DATA></BODY></ENVELOPE>')).toThrow(TallyPrimeError);
    // An empty ENVELOPE is how TallyPrime answers a report with no data for the period.
    expect(parseReportLines('<ENVELOPE></ENVELOPE>')).toEqual([]);
  });
});

describe('TallyPrime request builders', () => {
  it('converts as-of and period dates to TallyPrime YYYYMMDD format', () => {
    expect(buildBalanceSheetRequest('Zenmo', '2026-03-31')).toContain('<SVTODATE>20260331</SVTODATE>');
    expect(buildProfitLossRequest('Zenmo', '2025-04-01', '2026-03-31')).toContain(
      '<SVFROMDATE>20250401</SVFROMDATE>'
    );
  });

  it('omits date variables when no date is requested', () => {
    expect(buildBalanceSheetRequest('Zenmo')).not.toContain('SVTODATE');
    expect(buildProfitLossRequest('Zenmo')).not.toContain('SVFROMDATE');
  });

  it('escapes company names inside the XML', () => {
    expect(buildLedgerListRequest('A & B <Ltd>')).toContain('A &amp; B &lt;Ltd&gt;');
  });
});

describe('TallyPrimeClient transport', () => {
  it('rejects a non-loopback URL', () => {
    expect(() => new TallyPrimeClient({ baseUrl: 'http://192.168.1.10:9000', timeoutMs: 1000 })).toThrow(
      expect.objectContaining({ code: 'CONFIGURATION_ERROR' })
    );
  });

  it('rejects an https URL', () => {
    expect(() => new TallyPrimeClient({ baseUrl: 'https://127.0.0.1:9000', timeoutMs: 1000 })).toThrow(
      TallyPrimeError
    );
  });

  it('maps a refused connection to TALLYPRIME_UNAVAILABLE', async () => {
    const fetchFn = jest.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const client = new TallyPrimeClient({ baseUrl: 'http://127.0.0.1:9000', timeoutMs: 1000, fetchFn });
    await expect(client.executeXml('<ENVELOPE/>')).rejects.toMatchObject({
      code: 'TALLYPRIME_UNAVAILABLE',
      status: 503,
    });
  });

  it('maps a timeout to 504 UPSTREAM_GATEWAY_TIMEOUT', async () => {
    const fetchFn = jest.fn(async () => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    }) as unknown as typeof fetch;
    const client = new TallyPrimeClient({ baseUrl: 'http://127.0.0.1:9000', timeoutMs: 1000, fetchFn });
    await expect(client.executeXml('<ENVELOPE/>')).rejects.toMatchObject({
      code: 'UPSTREAM_GATEWAY_TIMEOUT',
      status: 504,
    });
  });

  it('does not leak the upstream body on an HTTP error', async () => {
    const fetchFn = jest.fn(async () => new Response('<secret>internal</secret>', { status: 500 })) as unknown as typeof fetch;
    const client = new TallyPrimeClient({ baseUrl: 'http://127.0.0.1:9000', timeoutMs: 1000, fetchFn });
    const error = await client.executeXml('<ENVELOPE/>').catch((e: unknown) => e as TallyPrimeError);
    expect(error).toMatchObject({ code: 'UPSTREAM_GATEWAY_ERROR', status: 502, upstreamStatus: 500 });
    expect(error.message).not.toContain('secret');
  });
});

describe('TallyPrimeService', () => {
  it('reports a real connection and the company count', async () => {
    const { fetchFn } = fakeTallyPrime();
    await expect(serviceFor(fetchFn).checkConnection()).resolves.toEqual({
      connected: true,
      message: 'TallyPrime is reachable',
      companyCount: 1,
    });
  });

  it('fails with NO_COMPANY_AVAILABLE when no company is open', async () => {
    const { fetchFn } = fakeTallyPrime({
      companies: '<ENVELOPE><BODY><DATA><COLLECTION></COLLECTION></DATA></BODY></ENVELOPE>',
    });
    await expect(serviceFor(fetchFn).listLedgers({ limit: 100, offset: 0 })).rejects.toMatchObject({
      code: 'NO_COMPANY_AVAILABLE',
      status: 409,
    });
  });

  it('fails with AMBIGUOUS_COMPANY when several companies are open and none is configured', async () => {
    const { fetchFn } = fakeTallyPrime({
      companies: `<ENVELOPE><BODY><DATA><COLLECTION>
        <COMPANY><NAME>A</NAME></COMPANY><COMPANY><NAME>B</NAME></COMPANY>
      </COLLECTION></DATA></BODY></ENVELOPE>`,
    });
    await expect(serviceFor(fetchFn).listLedgers({ limit: 100, offset: 0 })).rejects.toMatchObject({
      code: 'AMBIGUOUS_COMPANY',
    });
  });

  it('refuses a configured company that is not open in TallyPrime', async () => {
    const { fetchFn } = fakeTallyPrime();
    await expect(serviceFor(fetchFn, 'Other Ltd').listLedgers({ limit: 100, offset: 0 })).rejects.toMatchObject({
      code: 'COMPANY_NOT_OPEN',
      status: 404,
    });
  });

  it('checks the configured company against TallyPrime before reading data', async () => {
    const { fetchFn, requests } = fakeTallyPrime();
    await serviceFor(fetchFn, 'zenmo').listLedgers({ limit: 100, offset: 0 });
    expect(requests.some((r) => r.includes('TallyPrimeCompanyList'))).toBe(true);
  });

  it('filters ledgers by search and group, then paginates', async () => {
    const { fetchFn } = fakeTallyPrime();
    const result = await serviceFor(fetchFn, 'Zenmo').listLedgers({
      search: 'a',
      group: 'Sundry Creditors',
      limit: 10,
      offset: 0,
    });
    expect(result.items.map((l) => l.name)).toEqual(['ABC Traders']);
    expect(result.meta).toEqual({ total: 1, limit: 10, offset: 0 });
  });

  it('keeps debit and credit signs and derives balanceNature', async () => {
    const { fetchFn } = fakeTallyPrime();
    const result = await serviceFor(fetchFn, 'Zenmo').listLedgers({ limit: 100, offset: 0 });
    const byName = Object.fromEntries(result.items.map((l) => [l.name, l]));
    expect(byName['ABC Traders']).toMatchObject({ closingBalance: -15000, balanceNature: 'credit', currency: null });
    expect(byName['Vendor Two']).toMatchObject({ closingBalance: 500, balanceNature: 'debit' });
    expect(byName['Customer']).toMatchObject({ closingBalance: -200, balanceNature: 'credit' });
  });

  it('returns vendors from the Sundry Creditors hierarchy only', async () => {
    const { fetchFn } = fakeTallyPrime();
    const result = await serviceFor(fetchFn, 'Zenmo').listVendors({ limit: 100, offset: 0 });
    expect(result.items.map((v) => v.name)).toEqual(['ABC Traders', 'Vendor Two']);
    expect(result.items[0]).toMatchObject({
      gstin: '27AAAPL1234C1ZV',
      mailingDetails: { address: 'Plot 12, Pune', email: null, phone: null, mobile: null },
    });
  });

  it('resolves the vendor group hierarchy from group parents', () => {
    const groups = [
      { name: 'Sundry Creditors', parent: 'Primary' },
      { name: 'Sub Vendors', parent: 'Sundry Creditors' },
      { name: 'Deep Vendors', parent: 'Sub Vendors' },
      { name: 'Sundry Debtors', parent: 'Primary' },
    ];
    expect([...vendorGroupNames(groups)].sort()).toEqual(['deep vendors', 'sub vendors', 'sundry creditors']);
  });

  it('returns a single vendor by exact name', async () => {
    const { fetchFn } = fakeTallyPrime();
    await expect(serviceFor(fetchFn, 'Zenmo').getVendor('ABC Traders')).resolves.toMatchObject({
      name: 'ABC Traders',
      closingBalance: -15000,
    });
  });

  it('does not return a ledger that is not a vendor as a vendor', async () => {
    const { fetchFn } = fakeTallyPrime();
    await expect(serviceFor(fetchFn, 'Zenmo').getVendor('Cash')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('reports NOT_FOUND for a missing ledger', async () => {
    const { fetchFn } = fakeTallyPrime();
    await expect(serviceFor(fetchFn, 'Zenmo').getLedger('Nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reports AMBIGUOUS_MATCH when two ledgers share a name', async () => {
    const { fetchFn } = fakeTallyPrime({
      ledgers: `<ENVELOPE><BODY><DATA><COLLECTION>
        <LEDGER><NAME>Dup</NAME><PARENT>Sundry Creditors</PARENT></LEDGER>
        <LEDGER><NAME>dup</NAME><PARENT>Sundry Creditors</PARENT></LEDGER>
      </COLLECTION></DATA></BODY></ENVELOPE>`,
    });
    await expect(serviceFor(fetchFn, 'Zenmo').getLedger('DUP')).rejects.toMatchObject({
      code: 'AMBIGUOUS_MATCH',
      status: 409,
    });
  });

  it('computes payable as the negated closing balance and filters onlyOutstanding', async () => {
    const { fetchFn } = fakeTallyPrime();
    const all = await serviceFor(fetchFn, 'Zenmo').listVendorOutstanding({ onlyOutstanding: false });
    expect(all.find((v) => v.name === 'ABC Traders')).toMatchObject({ payable: 15000, balanceNature: 'credit' });
    expect(all.find((v) => v.name === 'Vendor Two')).toMatchObject({ payable: -500, balanceNature: 'debit' });

    const outstanding = await serviceFor(fetchFn, 'Zenmo').listVendorOutstanding({ onlyOutstanding: true });
    expect(outstanding).toHaveLength(2);
  });

  it('passes asOfDate through to the ledger request', async () => {
    const { fetchFn, requests } = fakeTallyPrime();
    await serviceFor(fetchFn, 'Zenmo').listVendorOutstanding({ asOfDate: '2026-03-31', onlyOutstanding: false });
    expect(requests.some((r) => r.includes('<SVTODATE>20260331</SVTODATE>'))).toBe(true);
  });

  it('returns balance sheet lines with totals null and the company name', async () => {
    const { fetchFn } = fakeTallyPrime();
    const report = await serviceFor(fetchFn, 'Zenmo').getBalanceSheet('2026-03-31');
    expect(report).toMatchObject({ company: 'Zenmo', asOfDate: '2026-03-31', totals: null });
    expect(report.lines).toHaveLength(2);
  });

  it('propagates a malformed report as an error instead of an empty report', async () => {
    const { fetchFn } = fakeTallyPrime({ report: '<ENVELOPE><BODY><DATA/></BODY></ENVELOPE>' });
    await expect(serviceFor(fetchFn, 'Zenmo').getBalanceSheet()).rejects.toMatchObject({
      code: 'UPSTREAM_GATEWAY_ERROR',
    });
  });
});
