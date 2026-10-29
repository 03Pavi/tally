/**
 * Types for the TallyPrime mediator.
 *
 * Monetary convention (applies to every amount field):
 * - Amounts are numbers in the company's currency, signed as TallyPrime exports them:
 *   positive = debit balance, negative = credit balance. `balanceNature` states the same in words.
 * - `null` means the value was absent or not numeric in the TallyPrime response. It is never guessed.
 */

export type BalanceNature = 'debit' | 'credit';

/** Raw ledger fields as read from a TallyPrime collection export (strings, unparsed). */
export interface RawTallyLedger {
  name: string;
  parent: string | null;
  openingBalance: string | null;
  closingBalance: string | null;
  currencyName: string | null;
  partyGstin: string | null;
  mailingName: string | null;
  addressLines: string[];
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

export interface RawTallyGroup {
  name: string;
  parent: string | null;
}

export interface TallyPrimeCompany {
  name: string;
  /** TallyPrime company GUID, when TallyPrime returns one. */
  guid: string | null;
}

export interface TallyPrimeLedger {
  name: string;
  /** Immediate parent group, for example "Sundry Creditors". */
  group: string | null;
  /** Opening balance for the requested period. Signed: + debit, - credit. */
  openingBalance: number | null;
  /** Closing balance as of `asOfDate`, or the current period. Signed: + debit, - credit. */
  closingBalance: number | null;
  balanceNature: BalanceNature | null;
  /** Currency name as stored on the ledger, or null. */
  currency: string | null;
}

export interface TallyPrimeMailingDetails {
  /** Address lines joined with ", ". Null when TallyPrime has no address. */
  address: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

export interface TallyPrimeVendor extends TallyPrimeLedger {
  mailingDetails: TallyPrimeMailingDetails;
  /** GSTIN as stored on the ledger. Never derived or validated by the mediator. */
  gstin: string | null;
}

export interface TallyPrimeVendorOutstanding {
  name: string;
  group: string | null;
  /**
   * Ledger closing balance as of `asOfDate`. This is the ledger total, not the
   * invoice-wise (bill-wise) outstanding. Signed: + debit, - credit.
   */
  closingBalance: number | null;
  balanceNature: BalanceNature | null;
  /**
   * Amount owed to the vendor: the negated closing balance. Positive = payable,
   * negative = debit (advance or excess payment). Null when the closing balance is unknown.
   */
  payable: number | null;
}

export interface ReportLine {
  name: string;
  /** Closing debit amount on the report line, when TallyPrime shows one. */
  closingDebit: number | null;
  /** Closing credit amount on the report line, when TallyPrime shows one. */
  closingCredit: number | null;
}

export interface FinancialReport {
  company: string;
  /** Balance Sheet as-of date, YYYY-MM-DD. Null when not requested. */
  asOfDate?: string | null;
  /** Profit & Loss period, YYYY-MM-DD. Null when not requested. */
  fromDate?: string | null;
  toDate?: string | null;
  /**
   * Report rows, grouped by XML element type. This is not guaranteed to match TallyPrime's display
   * order, and the hierarchy is not reconstructed because the row structure has not been verified
   * against a live export.
   */
  lines: ReportLine[];
  /** Report totals are not extracted in this phase. Always null. */
  totals: null;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}
