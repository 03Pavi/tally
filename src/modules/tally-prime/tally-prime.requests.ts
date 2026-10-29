/**
 * Builders for TallyPrime XML integration requests.
 * Export requests use the standard ENVELOPE / HEADER / BODY structure with
 * `$$SysName:XML` output. Static variables carry the company and date period.
 */

export const LEDGER_FIELDS = [
  'Name',
  'Parent',
  'OpeningBalance',
  'ClosingBalance',
  'Address.List',
  'Email',
  'LedgerPhone',
  'LedgerMobile',
  'PartyGSTIN',
] as const;

export const GROUP_FIELDS = ['Name', 'Parent'] as const;

/** Earliest date used as the start of a cumulative period for closing-balance requests. */
const PERIOD_START = '19000101';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Converts a validated YYYY-MM-DD string to TallyPrime's YYYYMMDD static-variable format. */
export function toTallyDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

interface StaticVariables {
  company?: string;
  fromDate?: string;
  toDate?: string;
}

function staticVariables(vars: StaticVariables): string {
  const parts = ['<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>'];
  if (vars.company !== undefined) {
    parts.push(`<SVCURRENTCOMPANY>${escapeXml(vars.company)}</SVCURRENTCOMPANY>`);
  }
  if (vars.fromDate !== undefined) {
    parts.push(`<SVFROMDATE>${vars.fromDate}</SVFROMDATE>`);
  }
  if (vars.toDate !== undefined) {
    parts.push(`<SVTODATE>${vars.toDate}</SVTODATE>`);
  }
  return parts.join('');
}

function collectionRequest(
  id: string,
  objectType: 'Company' | 'Ledger' | 'Group',
  fields: readonly string[],
  vars: StaticVariables
): string {
  return (
    '<ENVELOPE>' +
    '<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE>' +
    `<ID>${id}</ID></HEADER>` +
    '<BODY><DESC>' +
    `<STATICVARIABLES>${staticVariables(vars)}</STATICVARIABLES>` +
    '<TDL><TDLMESSAGE>' +
    `<COLLECTION NAME="${id}" ISMODIFY="No">` +
    `<TYPE>${objectType}</TYPE>` +
    `<FETCH>${fields.join(', ')}</FETCH>` +
    '</COLLECTION></TDLMESSAGE></TDL>' +
    '</DESC></BODY></ENVELOPE>'
  );
}

function reportRequest(reportId: string, vars: StaticVariables): string {
  return (
    '<ENVELOPE>' +
    '<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE>' +
    `<ID>${reportId}</ID></HEADER>` +
    '<BODY><DESC>' +
    `<STATICVARIABLES>${staticVariables(vars)}</STATICVARIABLES>` +
    '</DESC></BODY></ENVELOPE>'
  );
}

/** Lists companies loaded in TallyPrime. Needs no company selection. */
export function buildCompanyListRequest(): string {
  return collectionRequest('TallyPrimeCompanyList', 'Company', ['Name', 'GUID'], {});
}

/**
 * Lists ledger masters. `asOfDate` (YYYY-MM-DD) asks for closing balances as of that date.
 * Without it, TallyPrime returns balances for the company's current period.
 */
export function buildLedgerListRequest(company: string, asOfDate?: string): string {
  const vars: StaticVariables = { company };
  if (asOfDate !== undefined) {
    vars.fromDate = PERIOD_START;
    vars.toDate = toTallyDate(asOfDate);
  }
  return collectionRequest('TallyPrimeLedgerList', 'Ledger', LEDGER_FIELDS, vars);
}

/** Lists account groups, used to resolve the group hierarchy (for example Sundry Creditors). */
export function buildGroupListRequest(company: string): string {
  return collectionRequest('TallyPrimeGroupList', 'Group', GROUP_FIELDS, { company });
}

/** Balance Sheet report. `asOfDate` is the as-of date; without it TallyPrime uses its default. */
export function buildBalanceSheetRequest(company: string, asOfDate?: string): string {
  const vars: StaticVariables = { company };
  if (asOfDate !== undefined) {
    vars.toDate = toTallyDate(asOfDate);
  }
  return reportRequest('Balance Sheet', vars);
}

/** Profit & Loss report. Dates are optional; without them TallyPrime uses its default period. */
export function buildProfitLossRequest(company: string, fromDate?: string, toDate?: string): string {
  const vars: StaticVariables = { company };
  if (fromDate !== undefined) vars.fromDate = toTallyDate(fromDate);
  if (toDate !== undefined) vars.toDate = toTallyDate(toDate);
  return reportRequest('Profit and Loss', vars);
}
