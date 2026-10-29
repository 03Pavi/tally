import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/**
 * Which company the current request works on.
 *
 * Resolution order (first match wins):
 *   1. `company` query parameter on the request
 *   2. the runtime default set with POST /tally-prime/companies/select
 *   3. TALLY_PRIME_COMPANY
 *   4. the single company open in TallyPrime (refused when several are open)
 *
 * Every explicit choice must be a company TallyPrime currently has open. The name is checked
 * against TallyPrime's own list, so an unknown name is refused rather than guessed.
 */

const requestCompany = new AsyncLocalStorage<string | undefined>();
let runtimeCompany: string | undefined;

/** Company named by the current request, if any. */
export function companyFromRequest(): string | undefined {
  return requestCompany.getStore();
}

/** Runtime default set through the select endpoint. Resets when the process restarts. */
export function runtimeDefaultCompany(): string | undefined {
  return runtimeCompany;
}

export function setRuntimeDefaultCompany(name: string | undefined): void {
  runtimeCompany = name;
}

/** Express middleware: takes the `company` query parameter and applies it to the whole request. */
export function companyFromQuery(req: Request, res: Response, next: NextFunction): void {
  const raw = req.query['company'];
  if (raw === undefined) {
    next();
    return;
  }
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name === '' || name.length > 200) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: [{ field: 'company', message: 'company must be a company name of 1 to 200 characters' }],
      },
    });
    return;
  }
  requestCompany.run(name, () => next());
}
