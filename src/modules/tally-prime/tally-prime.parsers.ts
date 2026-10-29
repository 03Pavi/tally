import { XMLParser } from 'fast-xml-parser';
import { TallyPrimeError } from './tally-prime.errors.js';
import type {
  BalanceNature,
  RawTallyGroup,
  RawTallyLedger,
  ReportLine,
  TallyPrimeCompany,
} from './tally-prime.types.js';

type XmlNode = Record<string, unknown>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

function malformed(detail: string): TallyPrimeError {
  return new TallyPrimeError({
    message: `TallyPrime returned an unexpected response: ${detail}`,
    status: 502,
    code: 'UPSTREAM_GATEWAY_ERROR',
  });
}

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

/** Reads element text, including text held under `#text` when the element also has attributes. */
export function textOf(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number') return String(value);
  if (isNode(value) && '#text' in value) return textOf(value['#text']);
  return null;
}

/**
 * Parses a TallyPrime amount into a signed number.
 * Positive = debit, negative = credit. A trailing "Dr" is positive and "Cr" is negative.
 * Returns null for empty or non-numeric values. Never guesses.
 */
export function parseSignedAmount(value: unknown): number | null {
  const text = textOf(value);
  if (text === null) return null;

  let sign = 1;
  let numeric = text.replace(/[₹$€£,\s]/g, '');
  if (/cr$/i.test(numeric)) {
    sign = -1;
    numeric = numeric.replace(/cr$/i, '');
  } else if (/dr$/i.test(numeric)) {
    numeric = numeric.replace(/dr$/i, '');
  }

  if (!/^-?\d+(\.\d+)?$/.test(numeric)) return null;
  const amount = Number(numeric);
  return Number.isFinite(amount) ? sign * amount : null;
}

export function balanceNatureOf(amount: number | null): BalanceNature | null {
  if (amount === null || amount === 0) return null;
  return amount > 0 ? 'debit' : 'credit';
}

/**
 * Parses an XML body and returns the ENVELOPE node.
 * Throws UPSTREAM_GATEWAY_ERROR when the body is not an ENVELOPE document.
 */
export function parseEnvelope(xml: string): XmlNode {
  let document: unknown;
  try {
    document = xmlParser.parse(xml);
  } catch {
    throw malformed('response is not well-formed XML');
  }
  if (!isNode(document) || !('ENVELOPE' in document)) {
    throw malformed('ENVELOPE element not found');
  }
  // An empty element (<ENVELOPE></ENVELOPE>) parses as an empty string, which means no content.
  const envelope = document['ENVELOPE'];
  if (envelope === '') return {};
  if (!isNode(envelope)) {
    throw malformed('ENVELOPE element not found');
  }
  return envelope;
}

/** Rejects TallyPrime's LINEERROR responses. The error text itself is never returned to clients. */
export function assertNoLineError(xml: string): void {
  if (/<LINEERROR>/i.test(xml)) {
    throw new TallyPrimeError({
      message: 'TallyPrime rejected the request',
      status: 502,
      code: 'UPSTREAM_GATEWAY_ERROR',
    });
  }
}

/** Returns the DATA > COLLECTION node of a collection export. An empty collection is valid. */
function collectionOf(xml: string): XmlNode {
  assertNoLineError(xml);
  const envelope = parseEnvelope(xml);
  const body = envelope['BODY'];
  if (!isNode(body) || !isNode(body['DATA'])) {
    throw malformed('BODY/DATA element not found');
  }
  const collection = body['DATA']['COLLECTION'];
  return isNode(collection) ? collection : {};
}

function nameOf(node: XmlNode): string | null {
  return textOf(node['NAME']) ?? textOf(node['@_NAME']);
}

export function parseCompanies(xml: string): TallyPrimeCompany[] {
  const companies: TallyPrimeCompany[] = [];
  for (const item of asArray(collectionOf(xml)['COMPANY'])) {
    if (!isNode(item)) continue;
    const name = nameOf(item);
    if (name === null) continue;
    companies.push({ name, guid: textOf(item['GUID']) });
  }
  return companies;
}

export function parseGroups(xml: string): RawTallyGroup[] {
  const groups: RawTallyGroup[] = [];
  for (const item of asArray(collectionOf(xml)['GROUP'])) {
    if (!isNode(item)) continue;
    const name = nameOf(item);
    if (name === null) continue;
    groups.push({ name, parent: textOf(item['PARENT']) });
  }
  return groups;
}

function addressLinesOf(node: XmlNode): string[] {
  const addressList = node['ADDRESS.LIST'];
  if (isNode(addressList)) {
    return asArray(addressList['ADDRESS']).map(textOf).filter((line): line is string => line !== null);
  }
  const single = textOf(addressList);
  return single === null ? [] : [single];
}

export function parseLedgers(xml: string): RawTallyLedger[] {
  const ledgers: RawTallyLedger[] = [];
  for (const item of asArray(collectionOf(xml)['LEDGER'])) {
    if (!isNode(item)) continue;
    const name = nameOf(item);
    if (name === null) continue;
    ledgers.push({
      name,
      parent: textOf(item['PARENT']),
      openingBalance: textOf(item['OPENINGBALANCE']),
      closingBalance: textOf(item['CLOSINGBALANCE']),
      currencyName: textOf(item['CURRENCYNAME']),
      partyGstin: textOf(item['PARTYGSTIN']),
      mailingName: textOf(item['MAILINGNAME']),
      addressLines: addressLinesOf(item),
      email: textOf(item['EMAIL']),
      phone: textOf(item['LEDGERPHONE']),
      mobile: textOf(item['LEDGERMOBILE']),
    });
  }
  return ledgers;
}

/**
 * Collects display rows from a TallyPrime Data (report) export.
 * A row is any object carrying DSPDISPNAME, either directly or inside DSPACCNAME.
 * Closing Dr/Cr amounts are read from that same object. Throws when no rows are found,
 * because an empty parse cannot be told apart from an unexpected report structure.
 */
export function parseReportLines(xml: string): ReportLine[] {
  assertNoLineError(xml);
  const envelope = parseEnvelope(xml);
  // TallyPrime answers an empty report with an empty ENVELOPE. That is a valid empty result.
  if (Object.keys(envelope).length === 0) {
    return [];
  }
  const lines: ReportLine[] = [];
  collectReportRows(envelope, lines);
  if (lines.length === 0) {
    throw malformed('report contained no recognizable rows');
  }
  return lines;
}

function collectReportRows(node: unknown, lines: ReportLine[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectReportRows(item, lines);
    return;
  }
  if (!isNode(node)) return;

  const accountName = node['DSPACCNAME'];
  const directName = textOf(node['DSPDISPNAME']);
  const nestedName = isNode(accountName) ? textOf(accountName['DSPDISPNAME']) : null;
  const name = directName ?? nestedName;

  if (name !== null) {
    lines.push({
      name,
      closingDebit: parseSignedAmount(node['DSPCLDRAMTA']),
      closingCredit: parseSignedAmount(node['DSPCLCRAMTA']),
    });
  }

  for (const [key, value] of Object.entries(node)) {
    // The name came from DSPACCNAME, so that child must not produce a second row.
    if (key === 'DSPACCNAME' && directName === null && nestedName !== null) continue;
    collectReportRows(value, lines);
  }
}
