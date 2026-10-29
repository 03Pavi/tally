import type { NextFunction, Request, Response } from 'express';
import type { TallyPrimeClient } from './tally-prime.client.js';
import { companyFromRequest, runtimeDefaultCompany } from './tally-prime.company-context.js';

/**
 * When a read request names no company and several companies are open, the API answers with the
 * same read for every open company, grouped by company name. Each company's result comes from the
 * route itself (the request is repeated with ?company=<name>), so it has the same shape and checks.
 *
 * Only GET reads fan out. Writes still need an explicit company, so nothing is changed in an
 * unclear company. Company management and connection routes are not fanned out.
 */

export interface FanOutResult {
  company: string;
  status: number;
  success: boolean;
  data: unknown;
  meta?: unknown;
  error?: unknown;
}

/** Performs one GET against this same server and returns its status and parsed JSON body. */
export type Dispatch = (url: string) => Promise<{ status: number; body: Record<string, unknown> }>;

const NOT_FANNED_OUT = new Set(['/health', '/connection']);

export function withCompany(originalUrl: string, company: string): string {
  const url = new URL(originalUrl, 'http://local');
  url.searchParams.set('company', company);
  return `${url.pathname}${url.search}`;
}

export const dispatchToSelf: (base: string) => Dispatch = (base) => async (url) => {
  const response = await fetch(`${base}${url}`, { headers: { accept: 'application/json' } });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
};

export function createFanOutMiddleware(
  client: TallyPrimeClient,
  dispatchFor: (base: string) => Dispatch = dispatchToSelf
) {
  return async function fanOutCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Company and admin routes are never repeated per company (they need the admin token themselves).
    const isCompanyRoute = req.path === '/companies' || req.path.startsWith('/companies/');
    const isAdminRoute = req.path.startsWith('/admin/');
    if (req.method !== 'GET' || isCompanyRoute || isAdminRoute || NOT_FANNED_OUT.has(req.path)) {
      next();
      return;
    }

    // An explicit company, of any kind, means a single answer.
    const explicit =
      req.query['company'] !== undefined ||
      companyFromRequest() !== undefined ||
      runtimeDefaultCompany() !== undefined ||
      (client.getDefaultCompany()?.trim() ?? '') !== '';
    if (explicit) {
      next();
      return;
    }

    let companies;
    try {
      companies = await client.getCompanies();
    } catch {
      // TallyPrime unreachable: let the route report the error itself.
      next();
      return;
    }
    if (companies.length < 2) {
      next();
      return;
    }

    const dispatch = dispatchFor(`${req.protocol}://${req.get('host')}`);
    const results: FanOutResult[] = [];
    // One company at a time: TallyPrime handles a single request per company at a time.
    for (const company of companies) {
      const { status, body } = await dispatch(withCompany(req.originalUrl, company.name));
      results.push({
        company: company.name,
        status,
        success: body['success'] === true,
        data: body['data'] ?? null,
        ...(body['meta'] !== undefined ? { meta: body['meta'] } : {}),
        ...(body['error'] !== undefined ? { error: body['error'] } : {}),
      });
    }
    res.status(200).json({ success: true, data: results });
  };
}
