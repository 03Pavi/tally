import { TallyPrimeError } from './tally-prime.errors.js';
import { parseEnvelope, textOf } from './tally-prime.parsers.js';

export interface ImportResult {
  created: number;
  altered: number;
  deleted: number;
  errors: number;
  /** TallyPrime LINEERROR messages, trimmed. These describe the business rejection. */
  lineErrors: string[];
}

export interface RawTallyVoucher {
  date: string | null;
  type: string | null;
  number: string | null;
  partyLedger: string | null;
  narration: string | null;
  reference: string | null;
  guid: string | null;
}

type XmlNode = Record<string, unknown>;

const MAX_LINE_ERROR_LENGTH = 300;

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function count(value: unknown): number {
  const parsed = Number(textOf(value) ?? '0');
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Depth-first search for the first object that has one of the given keys.
 * Returns the object stored under that key (e.g. IMPORTRESULT itself), or the containing object
 * when the key holds a value rather than an element (e.g. CREATED).
 */
function findNode(node: unknown, keys: string[]): XmlNode | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findNode(item, keys);
      if (found) return found;
    }
    return null;
  }
  if (!isNode(node)) return null;
  for (const key of keys) {
    if (key in node) {
      const value = node[key];
      return isNode(value) ? value : node;
    }
  }
  for (const value of Object.values(node)) {
    const found = findNode(value, keys);
    if (found) return found;
  }
  return null;
}

/** Collects every LINEERROR text in the response, in document order. */
function collectLineErrors(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap((item) => collectLineErrors(item));
  if (!isNode(node)) return [];
  const own = asArray(node['LINEERROR'])
    .map((item) => textOf(item))
    .filter((text): text is string => text !== null);
  const nested = Object.entries(node)
    .filter(([key]) => key !== 'LINEERROR')
    .flatMap(([, value]) => collectLineErrors(value));
  return [...own, ...nested];
}

/**
 * Reads the Import Data result. A business rejection (ERRORS > 0, or LINEERROR and no creations)
 * is returned as data so the caller can decide. The caller must never report success from this
 * unless `created + altered + deleted > 0` and `errors === 0`.
 */
export function parseImportResult(xml: string): ImportResult {
  const envelope = parseEnvelope(xml);
  const result = findNode(envelope, ['IMPORTRESULT', 'RESPONSE', 'ERRORS', 'CREATED', 'LINEERROR']);
  if (result === null) {
    throw new TallyPrimeError({
      message: 'TallyPrime returned an unexpected import response',
      status: 502,
      code: 'UPSTREAM_GATEWAY_ERROR',
    });
  }

  // LINEERROR may sit beside the counters rather than inside them, so search the whole response.
  const lineErrors = collectLineErrors(envelope)
    .map((text) => text.slice(0, MAX_LINE_ERROR_LENGTH));

  return {
    created: count(result['CREATED']),
    altered: count(result['ALTERED']),
    deleted: count(result['DELETED']),
    errors: count(result['ERRORS']),
    lineErrors,
  };
}

/** Converts YYYYMMDD from TallyPrime into YYYY-MM-DD, or returns null when it does not match. */
function isoFromTally(value: string | null): string | null {
  if (value === null || !/^\d{8}$/.test(value)) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function parseVouchers(xml: string): RawTallyVoucher[] {
  const envelope = parseEnvelope(xml);
  const body = envelope['BODY'];
  if (!isNode(body) || !isNode(body['DATA'])) {
    throw new TallyPrimeError({
      message: 'TallyPrime returned an unexpected voucher response',
      status: 502,
      code: 'UPSTREAM_GATEWAY_ERROR',
    });
  }
  const collection = body['DATA']['COLLECTION'];
  const items = isNode(collection) ? asArray(collection['VOUCHER']) : [];

  const vouchers: RawTallyVoucher[] = [];
  for (const item of items) {
    if (!isNode(item)) continue;
    vouchers.push({
      date: isoFromTally(textOf(item['DATE'])),
      type: textOf(item['VOUCHERTYPENAME']),
      number: textOf(item['VOUCHERNUMBER']),
      partyLedger: textOf(item['PARTYLEDGERNAME']),
      narration: textOf(item['NARRATION']),
      reference: textOf(item['REFERENCE']),
      guid: textOf(item['GUID']),
    });
  }
  return vouchers;
}
