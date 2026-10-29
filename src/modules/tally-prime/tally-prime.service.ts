import { TallyPrimeClient } from './tally-prime.client.js';
import { TallyPrimeError } from './tally-prime.errors.js';
import { companyFromRequest, runtimeDefaultCompany } from './tally-prime.company-context.js';
import { balanceNatureOf, parseSignedAmount } from './tally-prime.parsers.js';
import type {
  FinancialReport,
  PaginationMeta,
  RawTallyGroup,
  RawTallyLedger,
  TallyPrimeCompany,
  TallyPrimeLedger,
  TallyPrimeVendor,
  TallyPrimeVendorOutstanding,
} from './tally-prime.types.js';

/** Primary group under which TallyPrime keeps supplier (vendor) ledgers. */
const VENDOR_ROOT_GROUP = 'sundry creditors';

export interface ListLedgersQuery {
  search?: string;
  group?: string;
  limit: number;
  offset: number;
}

export interface ListVendorsQuery {
  search?: string;
  limit: number;
  offset: number;
}

export interface VendorOutstandingQuery {
  search?: string;
  asOfDate?: string;
  onlyOutstanding: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export class TallyPrimeService {
  private readonly client: TallyPrimeClient;

  constructor(client?: TallyPrimeClient) {
    this.client = client ?? new TallyPrimeClient();
  }

  /**
   * Checks connectivity with a real request to TallyPrime. Throws the adapter's
   * error when TallyPrime cannot be reached. Never reports success without a response.
   */
  public async checkConnection(): Promise<{ connected: true; message: string; companyCount: number }> {
    const companies = await this.client.getCompanies();
    return {
      connected: true,
      message: 'TallyPrime is reachable',
      companyCount: companies.length,
    };
  }

  public async listCompanies(): Promise<TallyPrimeCompany[]> {
    return this.client.getCompanies();
  }

  /**
   * Resolves the company for accounting requests. Uses TALLY_PRIME_COMPANY when set.
   * Otherwise uses the single open company. Fails explicitly when none or several are open.
   */
  public async resolveCompany(): Promise<string> {
    // An explicit choice (request parameter, runtime default, or TALLY_PRIME_COMPANY) must be open.
    const explicit =
      companyFromRequest() ??
      runtimeDefaultCompany() ??
      (this.client.getDefaultCompany()?.trim() || undefined);

    const companies = await this.client.getCompanies();

    if (explicit !== undefined) {
      const match = companies.find((c) => c.name.toLowerCase() === explicit.toLowerCase());
      if (match === undefined) {
        throw new TallyPrimeError({
          message: `Company "${explicit}" is not open in TallyPrime`,
          status: 404,
          code: 'COMPANY_NOT_OPEN',
        });
      }
      return match.name;
    }

    if (companies.length === 0) {
      throw new TallyPrimeError({
        message: 'No company is open in TallyPrime',
        status: 409,
        code: 'NO_COMPANY_AVAILABLE',
      });
    }
    if (companies.length > 1) {
      throw new TallyPrimeError({
        message: 'Several companies are open in TallyPrime. Pass ?company=<name>, select one with POST /tally-prime/companies/select, or set TALLY_PRIME_COMPANY.',
        status: 409,
        code: 'AMBIGUOUS_COMPANY',
      });
    }
    return companies[0]!.name;
  }

  public async listLedgers(query: ListLedgersQuery): Promise<Paginated<TallyPrimeLedger>> {
    const company = await this.resolveCompany();
    const raw = await this.client.getLedgers(company);

    const group = query.group?.trim().toLowerCase();
    const filtered = filterBySearch(raw, query.search).filter(
      (ledger) => group === undefined || group === '' || ledger.parent?.toLowerCase() === group
    );
    return paginate(filtered.map(toLedger), query.limit, query.offset);
  }

  public async getLedger(name: string): Promise<TallyPrimeLedger> {
    const company = await this.resolveCompany();
    const raw = await this.client.getLedgers(company);
    return toLedger(findExactlyOne(raw, name, 'Ledger'));
  }

  public async listVendors(query: ListVendorsQuery): Promise<Paginated<TallyPrimeVendor>> {
    const { vendors } = await this.loadVendorLedgers();
    const filtered = filterBySearch(vendors, query.search);
    return paginate(filtered.map(toVendor), query.limit, query.offset);
  }

  public async getVendor(name: string): Promise<TallyPrimeVendor> {
    const { vendors } = await this.loadVendorLedgers();
    return toVendor(findExactlyOne(vendors, name, 'Vendor'));
  }

  /**
   * Vendor ledger closing balances. These are ledger totals as of `asOfDate`, not invoice-wise
   * (bill-wise) outstanding. Bill-wise data is not exposed in this phase.
   */
  public async listVendorOutstanding(
    query: VendorOutstandingQuery
  ): Promise<TallyPrimeVendorOutstanding[]> {
    const company = await this.resolveCompany();
    const groups = await this.client.getGroups(company);
    const raw = await this.client.getLedgers(company, query.asOfDate);
    const vendorGroups = vendorGroupNames(groups);

    const vendors = raw.filter((ledger) => isVendor(ledger, vendorGroups));
    const rows = filterBySearch(vendors, query.search).map((ledger): TallyPrimeVendorOutstanding => {
      const closingBalance = parseSignedAmount(ledger.closingBalance);
      return {
        name: ledger.name,
        group: ledger.parent,
        closingBalance,
        balanceNature: balanceNatureOf(closingBalance),
        payable: closingBalance === null ? null : -closingBalance,
      };
    });

    return query.onlyOutstanding
      ? rows.filter((row) => row.closingBalance !== null && row.closingBalance !== 0)
      : rows;
  }

  public async getBalanceSheet(asOfDate?: string): Promise<FinancialReport> {
    const company = await this.resolveCompany();
    const lines = await this.client.getBalanceSheet(company, asOfDate);
    return { company, asOfDate: asOfDate ?? null, lines, totals: null };
  }

  public async getProfitLoss(fromDate?: string, toDate?: string): Promise<FinancialReport> {
    const company = await this.resolveCompany();
    const lines = await this.client.getProfitLoss(company, fromDate, toDate);
    return { company, fromDate: fromDate ?? null, toDate: toDate ?? null, lines, totals: null };
  }

  private async loadVendorLedgers(): Promise<{ company: string; vendors: RawTallyLedger[] }> {
    const company = await this.resolveCompany();
    const groups = await this.client.getGroups(company);
    const raw = await this.client.getLedgers(company);
    const vendorGroups = vendorGroupNames(groups);
    return { company, vendors: raw.filter((ledger) => isVendor(ledger, vendorGroups)) };
  }
}

/**
 * Returns lowercase names of the vendor root group and every group beneath it,
 * following the actual parent hierarchy TallyPrime reports.
 */
export function vendorGroupNames(groups: RawTallyGroup[]): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const group of groups) {
    if (group.parent === null) continue;
    const parentKey = group.parent.toLowerCase();
    const children = childrenOf.get(parentKey) ?? [];
    children.push(group.name.toLowerCase());
    childrenOf.set(parentKey, children);
  }

  const result = new Set<string>([VENDOR_ROOT_GROUP]);
  const queue = [VENDOR_ROOT_GROUP];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return result;
}

function isVendor(ledger: RawTallyLedger, vendorGroups: Set<string>): boolean {
  return ledger.parent !== null && vendorGroups.has(ledger.parent.toLowerCase());
}

function toLedger(raw: RawTallyLedger): TallyPrimeLedger {
  const closingBalance = parseSignedAmount(raw.closingBalance);
  return {
    name: raw.name,
    group: raw.parent,
    openingBalance: parseSignedAmount(raw.openingBalance),
    closingBalance,
    balanceNature: balanceNatureOf(closingBalance),
    currency: raw.currencyName,
  };
}

function toVendor(raw: RawTallyLedger): TallyPrimeVendor {
  return {
    ...toLedger(raw),
    mailingDetails: {
      address: raw.addressLines.length > 0 ? raw.addressLines.join(', ') : null,
      email: raw.email,
      phone: raw.phone,
      mobile: raw.mobile,
    },
    gstin: raw.partyGstin,
  };
}

function filterBySearch<T extends { name: string }>(items: T[], search?: string): T[] {
  const term = search?.trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => item.name.toLowerCase().includes(term));
}

function findExactlyOne<T extends { name: string }>(items: T[], name: string, kind: string): T {
  const target = name.trim().toLowerCase();
  const matches = items.filter((item) => item.name.trim().toLowerCase() === target);
  if (matches.length === 0) {
    throw new TallyPrimeError({ message: `${kind} not found`, status: 404, code: 'NOT_FOUND' });
  }
  if (matches.length > 1) {
    throw new TallyPrimeError({
      message: `Multiple ${kind.toLowerCase()}s match this name. Use a more specific name.`,
      status: 409,
      code: 'AMBIGUOUS_MATCH',
    });
  }
  return matches[0]!;
}

function paginate<T>(items: T[], limit: number, offset: number): Paginated<T> {
  return {
    items: items.slice(offset, offset + limit),
    meta: { total: items.length, limit, offset },
  };
}
