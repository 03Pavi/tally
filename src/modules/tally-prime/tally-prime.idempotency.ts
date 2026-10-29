import { createHash } from 'node:crypto';
import { TallyPrimeError } from './tally-prime.errors.js';

/**
 * In-memory idempotency store for voucher creation.
 *
 * A client that retries a POST with the same Idempotency-Key and the same body gets the original
 * response back and TallyPrime is not called again. The same key with a different body is refused.
 *
 * Limitations: the store lives in this process only. A restart or a second instance forgets keys,
 * so the duplicate-number check in the service is the second line of defence.
 */

const TTL_MS = 24 * 60 * 60 * 1000;

interface Entry {
  fingerprint: string;
  state: 'in_progress' | 'done';
  status?: number;
  body?: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function fingerprintOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function purgeExpired(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

export type IdempotencyStart =
  | { kind: 'new' }
  | { kind: 'replay'; status: number; body: unknown };

/**
 * Registers a request. Returns `new` when the caller should run the operation, or `replay`
 * with the stored response. Throws 409 when the key is reused with a different body or while
 * the original request is still running.
 */
export function startIdempotent(key: string, fingerprint: string, now = Date.now()): IdempotencyStart {
  purgeExpired(now);
  const existing = store.get(key);
  if (!existing) {
    store.set(key, { fingerprint, state: 'in_progress', expiresAt: now + TTL_MS });
    return { kind: 'new' };
  }
  if (existing.fingerprint !== fingerprint) {
    throw new TallyPrimeError({
      message: 'Idempotency-Key was already used with a different request body',
      status: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
  }
  if (existing.state === 'in_progress') {
    throw new TallyPrimeError({
      message: 'A request with this Idempotency-Key is still being processed',
      status: 409,
      code: 'REQUEST_IN_PROGRESS',
    });
  }
  return { kind: 'replay', status: existing.status!, body: existing.body };
}

export function completeIdempotent(key: string, status: number, body: unknown, now = Date.now()): void {
  const existing = store.get(key);
  if (!existing) return;
  store.set(key, { ...existing, state: 'done', status, body, expiresAt: now + TTL_MS });
}

/** Clears a key after a failed attempt so the client can retry. Only failures reach this. */
export function abandonIdempotent(key: string): void {
  store.delete(key);
}

/** Test helper. Not used by the application. */
export function clearIdempotencyStore(): void {
  store.clear();
}
