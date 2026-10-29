import { getEnv } from '../../config/env.js';
import { TallyPrimeError } from './tally-prime.errors.js';
import {
  buildBalanceSheetRequest,
  buildCompanyListRequest,
  buildGroupListRequest,
  buildLedgerListRequest,
  buildProfitLossRequest,
} from './tally-prime.requests.js';
import { assertNoLineError, parseCompanies, parseGroups, parseLedgers, parseReportLines } from './tally-prime.parsers.js';
import {
  buildDataReportRequest,
  buildImportRequest,
  buildVoucherListRequest,
} from './tally-prime.write-requests.js';
import { parseImportResult, parseVouchers } from './tally-prime.write-parsers.js';
import type { ImportResult, RawTallyVoucher } from './tally-prime.write-parsers.js';
import type { RawTallyGroup, RawTallyLedger, ReportLine, TallyPrimeCompany } from './tally-prime.types.js';

export interface TallyPrimeClientOptions {
  /** Integration server URL. Must be loopback (localhost, 127.0.0.1 or ::1). */
  baseUrl?: string;
  /** Company used when TALLY_PRIME_COMPANY is not set and the caller passes none. */
  defaultCompany?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const DEFAULT_URL = 'http://127.0.0.1:9000';
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * HTTP transport for TallyPrime's XML integration server.
 * TallyPrime runs on the same PC as this API, so the URL is restricted to loopback.
 */
export class TallyPrimeClient {
  private readonly baseUrl: string;
  private readonly defaultCompany?: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: TallyPrimeClientOptions = {}) {
    const env = options.baseUrl === undefined || options.timeoutMs === undefined ? getEnvSafe() : null;

    const rawUrl = options.baseUrl ?? env?.TALLY_PRIME_URL ?? DEFAULT_URL;
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw configurationError('TALLY_PRIME_URL is not a valid URL');
    }
    if (parsed.protocol !== 'http:' || !LOOPBACK_HOSTS.has(parsed.hostname)) {
      throw configurationError('TALLY_PRIME_URL must use http and a loopback host (localhost or 127.0.0.1)');
    }

    this.baseUrl = parsed.origin + parsed.pathname.replace(/\/+$/, '');
    this.defaultCompany = options.defaultCompany ?? env?.TALLY_PRIME_COMPANY;
    this.timeoutMs = options.timeoutMs ?? env?.TALLY_PRIME_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  public getDefaultCompany(): string | undefined {
    return this.defaultCompany;
  }

  /**
   * Posts an XML request and returns the raw response body.
   * Connection failures are classified as TALLYPRIME_UNAVAILABLE (nothing listening, or the
   * integration server is disabled) and TALLYPRIME_TIMEOUT, so callers can tell them apart.
   */
  public async executeXml(xml: string): Promise<string> {
    const body = await this.postXml(xml);
    assertNoLineError(body);
    return body;
  }

  /**
   * Posts XML and returns the body without checking for LINEERROR. Import responses report
   * business rejections that way, so the caller must read them with parseImportResult.
   */
  public async postXml(xml: string): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchFn(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=utf-8', Accept: 'text/xml' },
        body: xml,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw mapTransportError(error);
    }

    if (!response.ok) {
      // The upstream body is dropped: it may contain raw internal detail.
      await response.text().catch(() => '');
      throw new TallyPrimeError({
        message: `TallyPrime integration server returned HTTP ${response.status}`,
        status: 502,
        code: 'UPSTREAM_GATEWAY_ERROR',
        upstreamStatus: response.status,
      });
    }

    const body = await response.text().catch(() => {
      throw new TallyPrimeError({
        message: 'TallyPrime returned an unreadable response',
        status: 502,
        code: 'UPSTREAM_GATEWAY_ERROR',
      });
    });
    if (body.trim() === '') {
      throw new TallyPrimeError({
        message: 'TallyPrime returned an empty response',
        status: 502,
        code: 'UPSTREAM_GATEWAY_ERROR',
      });
    }
    return body;
  }

  public async getCompanies(): Promise<TallyPrimeCompany[]> {
    return parseCompanies(await this.executeXml(buildCompanyListRequest()));
  }

  public async getGroups(company: string): Promise<RawTallyGroup[]> {
    return parseGroups(await this.executeXml(buildGroupListRequest(company)));
  }

  public async getLedgers(company: string, asOfDate?: string): Promise<RawTallyLedger[]> {
    return parseLedgers(await this.executeXml(buildLedgerListRequest(company, asOfDate)));
  }

  public async getBalanceSheet(company: string, asOfDate?: string): Promise<ReportLine[]> {
    return parseReportLines(await this.executeXml(buildBalanceSheetRequest(company, asOfDate)));
  }

  public async getProfitLoss(company: string, fromDate?: string, toDate?: string): Promise<ReportLine[]> {
    return parseReportLines(await this.executeXml(buildProfitLossRequest(company, fromDate, toDate)));
  }

  /** Posts an Import Data request and returns TallyPrime's counters and line errors. */
  public async importMessages(
    target: 'All Masters' | 'Vouchers',
    company: string,
    messagesXml: string
  ): Promise<ImportResult> {
    const body = await this.postXml(buildImportRequest(target, company, messagesXml));
    return parseImportResult(body);
  }

  public async getVouchers(company: string, fromDate: string, toDate: string): Promise<RawTallyVoucher[]> {
    return parseVouchers(await this.executeXml(buildVoucherListRequest(company, fromDate, toDate)));
  }

  /** Generic Data report export, for example "Trial Balance". Rows are parsed as report lines. */
  public async getDataReport(
    reportId: string,
    company: string,
    fromDate?: string,
    toDate?: string
  ): Promise<ReportLine[]> {
    return parseReportLines(await this.executeXml(buildDataReportRequest(reportId, company, fromDate, toDate)));
  }
}

function configurationError(message: string): TallyPrimeError {
  return new TallyPrimeError({ message, status: 500, code: 'CONFIGURATION_ERROR' });
}

function mapTransportError(error: unknown): TallyPrimeError {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new TallyPrimeError({
      message: 'TallyPrime did not respond within the configured timeout',
      status: 504,
      code: 'UPSTREAM_GATEWAY_TIMEOUT',
    });
  }
  // ECONNREFUSED: nothing listens on the port. TallyPrime is closed, or its integration
  // server is disabled or set to a different port. Both are reported the same way.
  return new TallyPrimeError({
    message:
      'TallyPrime is not reachable on the configured local integration port. Check that TallyPrime is running and its integration server is enabled.',
    status: 503,
    code: 'TALLYPRIME_UNAVAILABLE',
  });
}

function getEnvSafe(): ReturnType<typeof getEnv> | null {
  try {
    return getEnv();
  } catch {
    return null;
  }
}
