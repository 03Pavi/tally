import { TallyPrimeClient } from './tally-prime.client.js';
import { TallyPrimeError } from './tally-prime.errors.js';
import { parseSignedAmount, balanceNatureOf } from './tally-prime.parsers.js';
import { TallyPrimeService } from './tally-prime.service.js';
import type { ImportResult, RawTallyVoucher } from './tally-prime.write-parsers.js';
import {
  buildGroupMessage,
  buildLedgerDeleteMessage,
  buildLedgerMessage,
  buildVoucherDeleteMessage,
  buildVoucherMessage,
  type LedgerWriteFields,
  type VoucherWriteInput,
} from './tally-prime.write-requests.js';
import type {
  GroupCreateBody,
  GroupPatchBody,
  LedgerCreateBody,
  LedgerPatchBody,
  VoucherCreateBody,
} from './tally-prime.write-validators.js';
import type {
  BalanceNature,
  FinancialReport,
  RawTallyGroup,
  RawTallyLedger,
  TallyPrimeLedger,
} from './tally-prime.types.js';

import { companyFromRequest, runtimeDefaultCompany, setRuntimeDefaultCompany } from './tally-prime.company-context.js';
import { getRuntimeSettings, setRuntimeSettings } from '../../config/runtime-settings.js';
import { normalizeLoopbackUrl } from './tally-prime.client.js';

export type CompanySource = 'request' | 'runtime' | 'configured' | 'single-open';

export type PartyKind = 'vendor' | 'customer';

const PARTY_ROOT: Record<PartyKind, string> = {
  vendor: 'Sundry Creditors',
  customer: 'Sundry Debtors',
};

export interface GroupSummary {
  name: string;
  parent: string | null;
}

export interface VoucherSummary {
  date: string | null;
  type: string | null;
  number: string | null;
  partyLedger: string | null;
  narration: string | null;
  reference: string | null;
  guid: string | null;
}

export interface WriteOutcome {
  created: number;
  altered: number;
  deleted: number;
}

/** Writes that must succeed: TallyPrime's own counters are the only evidence of success. */
function assertAccepted(result: ImportResult, operation: string): WriteOutcome {
  const changed = result.created + result.altered + result.deleted;
  if (result.errors > 0 || changed === 0) {
    throw new TallyPrimeError({
      message: `TallyPrime rejected the ${operation}`,
      status: 422,
      code: 'TALLYPRIME_REJECTED',
      details: result.lineErrors.length > 0 ? result.lineErrors : undefined,
    });
  }
  return { created: result.created, altered: result.altered, deleted: result.deleted };
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Lowercase names of `root` and every group beneath it, from the actual parent links. */
export function subtreeOf(groups: RawTallyGroup[], root: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const group of groups) {
    if (group.parent === null) continue;
    const key = group.parent.toLowerCase();
    children.set(key, [...(children.get(key) ?? []), group.name.toLowerCase()]);
  }
  const result = new Set<string>([root.toLowerCase()]);
  const queue = [root.toLowerCase()];
  while (queue.length > 0) {
    for (const child of children.get(queue.shift()!) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return result;
}

/** True when `candidateParent` is `group` itself or lies beneath it, which would create a cycle. */
function wouldCycle(groups: RawTallyGroup[], group: string, candidateParent: string): boolean {
  const parentOf = new Map(groups.map((g) => [g.name.toLowerCase(), g.parent?.toLowerCase() ?? null]));
  let current: string | null | undefined = candidateParent.toLowerCase();
  const seen = new Set<string>();
  while (current !== null && current !== undefined && !seen.has(current)) {
    if (current === group.toLowerCase()) return true;
    seen.add(current);
    current = parentOf.get(current);
  }
  return false;
}

function ledgerFieldsOf(body: LedgerCreateBody | LedgerPatchBody): LedgerWriteFields {
  return {
    parent: body.parent,
    openingBalance: body.openingBalance,
    mailingName: body.mailingName,
    addressLines: body.addressLines,
    email: body.email,
    phone: body.phone,
    mobile: body.mobile,
    gstin: body.gstin,
    stateName: body.stateName,
  };
}

function toLedger(raw: RawTallyLedger): TallyPrimeLedger {
  const closingBalance = parseSignedAmount(raw.closingBalance);
  return {
    name: raw.name,
    group: raw.parent,
    openingBalance: parseSignedAmount(raw.openingBalance),
    closingBalance,
    balanceNature: balanceNatureOf(closingBalance) as BalanceNature | null,
    currency: raw.currencyName,
  };
}

export class TallyPrimeAdminService {
  private readonly client: TallyPrimeClient;
  private readonly read: TallyPrimeService;

  constructor(client: TallyPrimeClient, read: TallyPrimeService) {
    this.client = client;
    this.read = read;
  }

  // ----- Company -----

  /** Active company and where it came from: request, runtime selection, configuration, or the single open company. */
  public async currentCompany(): Promise<{ name: string | null; source: CompanySource | 'none'; openCompanies?: string[] }> {
    const source: CompanySource = companyFromRequest()
      ? 'request'
      : runtimeDefaultCompany()
        ? 'runtime'
        : this.client.getDefaultCompany()?.trim()
          ? 'configured'
          : 'single-open';
    try {
      return { name: await this.read.resolveCompany(), source };
    } catch (error) {
      // Several companies open, or none: list the open companies so the caller can choose one.
      if (error instanceof TallyPrimeError && (error.code === 'AMBIGUOUS_COMPANY' || error.code === 'NO_COMPANY_AVAILABLE')) {
        const open = await this.client.getCompanies();
        return { name: null, source: 'none', openCompanies: open.map((c) => c.name) };
      }
      throw error;
    }
  }

  /**
   * Open companies in TallyPrime. `active` marks the company the current request uses: the
   * ?company= value, else the runtime selection, else TALLY_PRIME_COMPANY, else the only open company.
   */
  public async listCompanies(): Promise<Array<{ name: string; guid: string | null; active: boolean }>> {
    const explicit =
      companyFromRequest() ??
      runtimeDefaultCompany() ??
      (this.client.getDefaultCompany()?.trim() || undefined);
    const companies = await this.client.getCompanies();
    return companies.map((company) => ({
      name: company.name,
      guid: company.guid,
      active:
        explicit !== undefined
          ? company.name.toLowerCase() === explicit.toLowerCase()
          : companies.length === 1,
    }));
  }

  /** Current admin-adjustable settings. Token values are never returned, only where they come from. */
  public adminConfig(): {
    TALLY_PRIME_URL: string;
    ADMIN_API_TOKEN: { configured: boolean; source: 'runtime' | 'environment' | 'none' };
  } {
    const runtime = getRuntimeSettings();
    const envToken = process.env['ADMIN_API_TOKEN'] ?? '';
    const source: 'runtime' | 'environment' | 'none' = runtime.adminToken
      ? 'runtime'
      : envToken.length >= 32
        ? 'environment'
        : 'none';
    return {
      TALLY_PRIME_URL: this.client.currentUrl(),
      ADMIN_API_TOKEN: { configured: source !== 'none', source },
    };
  }

  /**
   * Changes the TallyPrime URL and/or the admin token for the running process.
   * Returns the names of what changed, never the values.
   */
  public updateAdminConfig(update: { TALLY_PRIME_URL?: string; ADMIN_API_TOKEN?: string }): { changed: string[] } {
    const changed: string[] = [];
    if (update.TALLY_PRIME_URL !== undefined) {
      let normalized: string;
      try {
        normalized = normalizeLoopbackUrl(update.TALLY_PRIME_URL);
      } catch (error) {
        throw new TallyPrimeError({
          message: (error as Error).message,
          status: 400,
          code: 'VALIDATION_ERROR',
        });
      }
      setRuntimeSettings({ tallyPrimeUrl: normalized });
      changed.push('TALLY_PRIME_URL');
    }
    if (update.ADMIN_API_TOKEN !== undefined) {
      setRuntimeSettings({ adminToken: update.ADMIN_API_TOKEN });
      changed.push('ADMIN_API_TOKEN');
    }
    return { changed };
  }

  /** Sets the runtime default company. The name must be open in TallyPrime right now. */
  public async selectCompany(name: string): Promise<{ name: string; source: 'runtime' }> {
    const open = await this.client.getCompanies();
    const match = open.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    if (match === undefined) {
      throw new TallyPrimeError({
        message: `Company "${name}" is not open in TallyPrime`,
        status: 404,
        code: 'COMPANY_NOT_OPEN',
      });
    }
    setRuntimeDefaultCompany(match.name);
    return { name: match.name, source: 'runtime' };
  }

  /** Clears the runtime selection, so the configured or single-open company applies again. */
  public clearCompanySelection(): void {
    setRuntimeDefaultCompany(undefined);
  }

  // ----- Groups -----

  public async listGroups(): Promise<GroupSummary[]> {
    const company = await this.read.resolveCompany();
    return (await this.client.getGroups(company)).map((g) => ({ name: g.name, parent: g.parent }));
  }

  public async getGroup(name: string): Promise<GroupSummary> {
    return findOrThrow(await this.listGroups(), name, 'Group');
  }

  public async createGroup(body: GroupCreateBody): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const groups = await this.client.getGroups(company);
    if (groups.some((g) => sameName(g.name, body.name))) {
      throw conflict('GROUP_EXISTS', 'A group with this name already exists');
    }
    if (!groups.some((g) => sameName(g.name, body.parent)) && !sameName(body.parent, 'Primary')) {
      throw unprocessable('Parent group does not exist');
    }
    const result = await this.client.importMessages(
      'All Masters',
      company,
      buildGroupMessage('Create', body.name, body.parent)
    );
    return assertAccepted(result, 'group creation');
  }

  public async updateGroup(name: string, body: GroupPatchBody): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const groups = await this.client.getGroups(company);
    const target = findOrThrow(groups, name, 'Group');
    if (!groups.some((g) => sameName(g.name, body.parent)) && !sameName(body.parent, 'Primary')) {
      throw unprocessable('Parent group does not exist');
    }
    if (wouldCycle(groups, target.name, body.parent)) {
      throw unprocessable('A group cannot be moved beneath itself');
    }
    const result = await this.client.importMessages(
      'All Masters',
      company,
      buildGroupMessage('Alter', target.name, body.parent)
    );
    return assertAccepted(result, 'group update');
  }

  public async deleteGroup(name: string): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const groups = await this.client.getGroups(company);
    const target = findOrThrow(groups, name, 'Group');
    const result = await this.client.importMessages(
      'All Masters',
      company,
      buildGroupMessage('Delete', target.name)
    );
    return assertAccepted(result, 'group deletion');
  }

  // ----- Ledgers -----

  public async createLedger(body: LedgerCreateBody): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const [groups, ledgers] = await Promise.all([
      this.client.getGroups(company),
      this.client.getLedgers(company),
    ]);
    if (ledgers.some((l) => sameName(l.name, body.name))) {
      throw conflict('LEDGER_EXISTS', 'A ledger with this name already exists');
    }
    if (body.parent === undefined) {
      throw unprocessable('Parent group is required for a ledger');
    }
    const parent = findOrThrow(groups, body.parent, 'Parent group');
    const result = await this.client.importMessages(
      'All Masters',
      company,
      buildLedgerMessage('Create', body.name, { ...ledgerFieldsOf(body), parent: parent.name })
    );
    return assertAccepted(result, 'ledger creation');
  }

  public async getLedger(name: string): Promise<TallyPrimeLedger> {
    return this.read.getLedger(name);
  }

  public async updateLedger(name: string, body: LedgerPatchBody): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const [groups, ledgers] = await Promise.all([
      this.client.getGroups(company),
      this.client.getLedgers(company),
    ]);
    const target = findOrThrow(ledgers, name, 'Ledger');
    const fields = ledgerFieldsOf(body);
    if (body.parent !== undefined) {
      fields.parent = findOrThrow(groups, body.parent, 'Parent group').name;
    }
    const result = await this.client.importMessages(
      'All Masters',
      company,
      buildLedgerMessage('Alter', target.name, fields)
    );
    return assertAccepted(result, 'ledger update');
  }

  public async deleteLedger(name: string): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const target = findOrThrow(await this.client.getLedgers(company), name, 'Ledger');
    const result = await this.client.importMessages('All Masters', company, buildLedgerDeleteMessage(target.name));
    return assertAccepted(result, 'ledger deletion');
  }

  // ----- Vendors and customers (ledgers under a party group) -----

  public async listParties(kind: PartyKind, search?: string): Promise<TallyPrimeLedger[]> {
    const company = await this.read.resolveCompany();
    const [groups, ledgers] = await Promise.all([
      this.client.getGroups(company),
      this.client.getLedgers(company),
    ]);
    const members = subtreeOf(groups, PARTY_ROOT[kind]);
    const term = search?.trim().toLowerCase();
    return ledgers
      .filter((l) => l.parent !== null && members.has(l.parent.toLowerCase()))
      .filter((l) => !term || l.name.toLowerCase().includes(term))
      .map(toLedger);
  }

  public async getParty(kind: PartyKind, name: string): Promise<TallyPrimeLedger> {
    return findOrThrow(await this.listParties(kind), name, kind === 'vendor' ? 'Vendor' : 'Customer');
  }

  public async createParty(kind: PartyKind, body: LedgerCreateBody): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const [groups, ledgers] = await Promise.all([
      this.client.getGroups(company),
      this.client.getLedgers(company),
    ]);
    if (ledgers.some((l) => sameName(l.name, body.name))) {
      throw conflict('LEDGER_EXISTS', 'A ledger with this name already exists');
    }
    const members = subtreeOf(groups, PARTY_ROOT[kind]);
    const parentName = body.parent ?? PARTY_ROOT[kind];
    const parent = findOrThrow(groups, parentName, 'Parent group');
    if (!members.has(parent.name.toLowerCase())) {
      throw unprocessable(`Parent group must be ${PARTY_ROOT[kind]} or one of its sub-groups`);
    }
    const result = await this.client.importMessages(
      'All Masters',
      company,
      buildLedgerMessage('Create', body.name, { ...ledgerFieldsOf(body), parent: parent.name })
    );
    return assertAccepted(result, `${kind} creation`);
  }

  public async updateParty(kind: PartyKind, name: string, body: LedgerPatchBody): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const groups = await this.client.getGroups(company);
    const target = await this.getParty(kind, name);
    const fields = ledgerFieldsOf(body);
    if (body.parent !== undefined) {
      const parent = findOrThrow(groups, body.parent, 'Parent group');
      if (!subtreeOf(groups, PARTY_ROOT[kind]).has(parent.name.toLowerCase())) {
        throw unprocessable(`Parent group must be ${PARTY_ROOT[kind]} or one of its sub-groups`);
      }
      fields.parent = parent.name;
    }
    const result = await this.client.importMessages(
      'All Masters',
      company,
      buildLedgerMessage('Alter', target.name, fields)
    );
    return assertAccepted(result, `${kind} update`);
  }

  public async deleteParty(kind: PartyKind, name: string): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const target = await this.getParty(kind, name);
    const result = await this.client.importMessages('All Masters', company, buildLedgerDeleteMessage(target.name));
    return assertAccepted(result, `${kind} deletion`);
  }

  // ----- Vouchers -----

  public async listVouchers(fromDate: string, toDate: string, type?: string): Promise<VoucherSummary[]> {
    const company = await this.read.resolveCompany();
    const rows = await this.client.getVouchers(company, fromDate, toDate);
    return rows
      .filter((v) => type === undefined || (v.type ?? '').toLowerCase() === type.toLowerCase())
      .map(toVoucherSummary);
  }

  /**
   * Creates a voucher after checking that every ledger exists, that the entries balance, and
   * that no voucher with the same type and number already exists on that date.
   */
  public async createVoucher(body: VoucherCreateBody): Promise<WriteOutcome & { type: string; date: string; number: string | null }> {
    const company = await this.read.resolveCompany();
    const ledgers = await this.client.getLedgers(company);

    const missing = body.entries
      .map((entry) => entry.ledger)
      .concat(body.partyLedger ? [body.partyLedger] : [])
      .filter((name) => !ledgers.some((l) => sameName(l.name, name)));
    if (missing.length > 0) {
      throw new TallyPrimeError({
        message: 'Some ledgers referenced by the voucher do not exist',
        status: 422,
        code: 'VALIDATION_ERROR',
        details: [...new Set(missing)],
      });
    }

    if (body.number !== undefined) {
      const sameDay = await this.client.getVouchers(company, body.date, body.date);
      const duplicate = sameDay.some(
        (v) => (v.type ?? '').toLowerCase() === body.type.toLowerCase() && v.number === body.number
      );
      if (duplicate) {
        throw conflict('DUPLICATE_VOUCHER', 'A voucher with this type and number already exists on this date');
      }
    }

    // Use TallyPrime's canonical ledger names so the import matches exactly.
    const canonical = (name: string) => ledgers.find((l) => sameName(l.name, name))!.name;
    const input: VoucherWriteInput = {
      type: body.type,
      date: body.date,
      number: body.number,
      partyLedger: body.partyLedger ? canonical(body.partyLedger) : undefined,
      narration: body.narration,
      reference: body.reference,
      entries: body.entries.map((entry) => ({ ledger: canonical(entry.ledger), amount: entry.amount })),
    };

    const result = await this.client.importMessages('Vouchers', company, buildVoucherMessage('Create', input));
    const outcome = assertAccepted(result, 'voucher creation');
    return { ...outcome, type: body.type, date: body.date, number: body.number ?? null };
  }

  /** Deletes the single voucher that matches type, number and date. Ambiguous matches are refused. */
  public async deleteVoucher(type: string, number: string, date: string): Promise<WriteOutcome> {
    const company = await this.read.resolveCompany();
    const matches = (await this.client.getVouchers(company, date, date)).filter(
      (v) => (v.type ?? '').toLowerCase() === type.toLowerCase() && v.number === number
    );
    if (matches.length === 0) {
      throw new TallyPrimeError({ message: 'Voucher not found', status: 404, code: 'NOT_FOUND' });
    }
    if (matches.length > 1) {
      throw conflict('AMBIGUOUS_MATCH', 'More than one voucher matches this type, number and date');
    }
    const canonicalType = matches[0]!.type ?? type;
    const result = await this.client.importMessages(
      'Vouchers',
      company,
      buildVoucherDeleteMessage(canonicalType, date, number)
    );
    return assertAccepted(result, 'voucher deletion');
  }

  // ----- Reports -----

  public async trialBalance(fromDate?: string, toDate?: string): Promise<FinancialReport> {
    const company = await this.read.resolveCompany();
    const lines = await this.client.getDataReport('Trial Balance', company, fromDate, toDate);
    return { company, fromDate: fromDate ?? null, toDate: toDate ?? null, lines, totals: null };
  }
}

function toVoucherSummary(raw: RawTallyVoucher): VoucherSummary {
  return { ...raw };
}

function findOrThrow<T extends { name: string }>(items: T[], name: string, label: string): T {
  const matches = items.filter((item) => sameName(item.name, name));
  if (matches.length === 0) {
    throw new TallyPrimeError({ message: `${label} not found`, status: 404, code: 'NOT_FOUND' });
  }
  if (matches.length > 1) {
    throw conflict('AMBIGUOUS_MATCH', `More than one ${label.toLowerCase()} matches this name`);
  }
  return matches[0]!;
}

function conflict(code: string, message: string): TallyPrimeError {
  return new TallyPrimeError({ message, status: 409, code });
}

function unprocessable(message: string): TallyPrimeError {
  return new TallyPrimeError({ message, status: 422, code: 'VALIDATION_ERROR' });
}
