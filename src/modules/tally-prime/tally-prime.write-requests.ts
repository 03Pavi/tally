/**
 * XML builders for TallyPrime write operations (Import Data) and for voucher and report exports.
 *
 * Amount convention (same as the read side): positive = debit, negative = credit.
 * For voucher entries TallyPrime expects ISDEEMEDPOSITIVE=Yes on debit entries (positive amount)
 * and ISDEEMEDPOSITIVE=No on credit entries (negative amount).
 */
import { escapeXml, toTallyDate } from './tally-prime.requests.js';

export interface LedgerWriteFields {
  parent?: string;
  /** Signed: positive = debit opening balance, negative = credit opening balance. */
  openingBalance?: number;
  mailingName?: string;
  addressLines?: string[];
  email?: string;
  phone?: string;
  mobile?: string;
  gstin?: string;
  stateName?: string;
}

export interface VoucherEntryInput {
  ledger: string;
  /** Signed: positive = debit, negative = credit. */
  amount: number;
}

export interface VoucherWriteInput {
  type: string;
  /** YYYY-MM-DD */
  date: string;
  number?: string;
  partyLedger?: string;
  narration?: string;
  reference?: string;
  entries: VoucherEntryInput[];
}

type Action = 'Create' | 'Alter' | 'Delete';

function tag(name: string, value: string | number | undefined): string {
  return value === undefined ? '' : `<${name}>${escapeXml(String(value))}</${name}>`;
}

/** Formats a signed amount with exactly two decimals, as TallyPrime expects. */
export function formatAmount(value: number): string {
  return value.toFixed(2);
}

/** Wraps messages in an Import Data envelope for the given import target ("All Masters" or "Vouchers"). */
export function buildImportRequest(target: 'All Masters' | 'Vouchers', company: string, messagesXml: string): string {
  return (
    '<ENVELOPE>' +
    '<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import Data</TALLYREQUEST><TYPE>Data</TYPE>' +
    `<ID>${target}</ID></HEADER>` +
    '<BODY><DESC><STATICVARIABLES>' +
    `<SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>` +
    '</STATICVARIABLES></DESC>' +
    `<DATA><TALLYMESSAGE>${messagesXml}</TALLYMESSAGE></DATA>` +
    '</BODY></ENVELOPE>'
  );
}

function addressXml(lines: string[] | undefined): string {
  if (lines === undefined || lines.length === 0) return '';
  return `<ADDRESS.LIST TYPE="String">${lines.map((line) => tag('ADDRESS', line)).join('')}</ADDRESS.LIST>`;
}

export function buildLedgerMessage(action: Action, name: string, fields: LedgerWriteFields): string {
  const amount = fields.openingBalance === undefined ? undefined : formatAmount(fields.openingBalance);
  return (
    `<LEDGER NAME="${escapeXml(name)}" ACTION="${action}">` +
    tag('NAME', name) +
    tag('PARENT', fields.parent) +
    tag('OPENINGBALANCE', amount) +
    tag('MAILINGNAME', fields.mailingName) +
    addressXml(fields.addressLines) +
    tag('EMAIL', fields.email) +
    tag('LEDGERPHONE', fields.phone) +
    tag('LEDGERMOBILE', fields.mobile) +
    tag('PARTYGSTIN', fields.gstin) +
    tag('LEDSTATENAME', fields.stateName) +
    '</LEDGER>'
  );
}

export function buildLedgerDeleteMessage(name: string): string {
  return `<LEDGER NAME="${escapeXml(name)}" ACTION="Delete"><NAME>${escapeXml(name)}</NAME></LEDGER>`;
}

export function buildGroupMessage(action: Action, name: string, parent?: string): string {
  return (
    `<GROUP NAME="${escapeXml(name)}" ACTION="${action}">` +
    tag('NAME', name) +
    tag('PARENT', parent) +
    '</GROUP>'
  );
}

export function buildVoucherMessage(action: Action, input: VoucherWriteInput): string {
  const entries = input.entries
    .map(
      (entry) =>
        '<ALLLEDGERENTRIES.LIST>' +
        tag('LEDGERNAME', entry.ledger) +
        tag('ISDEEMEDPOSITIVE', entry.amount > 0 ? 'Yes' : 'No') +
        tag('AMOUNT', formatAmount(entry.amount)) +
        '</ALLLEDGERENTRIES.LIST>'
    )
    .join('');

  return (
    `<VOUCHER VCHTYPE="${escapeXml(input.type)}" ACTION="${action}">` +
    tag('DATE', toTallyDate(input.date)) +
    tag('VOUCHERTYPENAME', input.type) +
    tag('VOUCHERNUMBER', input.number) +
    tag('PARTYLEDGERNAME', input.partyLedger) +
    tag('NARRATION', input.narration) +
    tag('REFERENCE', input.reference) +
    entries +
    '</VOUCHER>'
  );
}

/** Identifies an existing voucher for deletion by date, type and number. */
export function buildVoucherDeleteMessage(type: string, date: string, number: string): string {
  return buildVoucherMessage('Delete', {
    type,
    date,
    number,
    entries: [],
  });
}

/** Voucher header list for a period. Ledger entries are not fetched here. */
export function buildVoucherListRequest(company: string, fromDate: string, toDate: string): string {
  return (
    '<ENVELOPE>' +
    '<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE>' +
    '<ID>TallyPrimeVoucherList</ID></HEADER>' +
    '<BODY><DESC><STATICVARIABLES>' +
    '<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>' +
    `<SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>` +
    `<SVFROMDATE>${toTallyDate(fromDate)}</SVFROMDATE>` +
    `<SVTODATE>${toTallyDate(toDate)}</SVTODATE>` +
    '</STATICVARIABLES>' +
    '<TDL><TDLMESSAGE><COLLECTION NAME="TallyPrimeVoucherList" ISMODIFY="No">' +
    '<TYPE>Voucher</TYPE>' +
    '<FETCH>Date, VoucherTypeName, VoucherNumber, PartyLedgerName, Narration, Reference, Guid</FETCH>' +
    '</COLLECTION></TDLMESSAGE></TDL>' +
    '</DESC></BODY></ENVELOPE>'
  );
}

/** Generic Data (report) export for a named TallyPrime report, such as "Trial Balance". */
export function buildDataReportRequest(
  reportId: string,
  company: string,
  fromDate?: string,
  toDate?: string
): string {
  return (
    '<ENVELOPE>' +
    '<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE>' +
    `<ID>${escapeXml(reportId)}</ID></HEADER>` +
    '<BODY><DESC><STATICVARIABLES>' +
    '<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>' +
    `<SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>` +
    (fromDate === undefined ? '' : `<SVFROMDATE>${toTallyDate(fromDate)}</SVFROMDATE>`) +
    (toDate === undefined ? '' : `<SVTODATE>${toTallyDate(toDate)}</SVTODATE>`) +
    '</STATICVARIABLES></DESC></BODY></ENVELOPE>'
  );
}
