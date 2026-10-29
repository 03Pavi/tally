import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Bearer-token authentication for the TallyPrime admin API.
 *
 * The expected token is read from ADMIN_API_TOKEN at request time. It must be at least 32
 * characters. If it is missing or too short, every protected request is refused with 503,
 * so write operations are never open by default.
 *
 * Authorization: a valid token grants the admin role. Tokens are not stored in the code
 * and are compared as SHA-256 digests in constant time. The audit actor is a short,
 * non-reversible fingerprint of the token, never the token itself.
 */

const MIN_TOKEN_LENGTH = 32;

export const ADMIN_ACTOR_LOCAL = 'res.locals.adminActor';

/**
 * Decides which TallyPrime requests need the admin token.
 * Writes (POST, PATCH, PUT, DELETE) and company management (/companies, including the list)
 * always need it. Other GET requests are public read access.
 */
export function needsAdminToken(method: string, path: string): boolean {
  if (method !== 'GET') return true;
  return path === '/companies' || path.startsWith('/companies/');
}

/** Applies requireAdmin only to the requests that need it. */
export function requireAdminWhereNeeded(req: Request, res: Response, next: NextFunction): void {
  if (needsAdminToken(req.method, req.path)) {
    requireAdmin(req, res, next);
    return;
  }
  next();
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Liveness probe stays open so process monitors can check the service.
  if (req.method === 'GET' && req.path === '/health') {
    next();
    return;
  }

  const configured = process.env['ADMIN_API_TOKEN'] ?? '';
  if (configured.length < MIN_TOKEN_LENGTH) {
    res.status(503).json({
      success: false,
      error: {
        code: 'ADMIN_AUTH_NOT_CONFIGURED',
        message: 'Admin API is disabled: ADMIN_API_TOKEN is missing or shorter than 32 characters',
      },
    });
    return;
  }

  const header = req.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Bearer token required' },
    });
    return;
  }

  if (!timingSafeEqual(digest(match[1]!), digest(configured))) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid admin token' },
    });
    return;
  }

  res.locals['adminActor'] = `admin:${digest(configured).toString('hex').slice(0, 8)}`;
  next();
}

export function adminActorOf(res: Response): string {
  return (res.locals['adminActor'] as string | undefined) ?? 'unknown';
}
