import type { Request, Response, NextFunction } from 'express';
import { TallyApiError } from '../client/tally.client.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Check if error is from Tally client
  if (err instanceof TallyApiError) {
    if (err.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }

    res.status(err.mappedStatus).json({
      success: false,
      error: {
        code: mapStatusToErrorCode(err.mappedStatus),
        message: err.message,
        upstreamStatus: err.status,
      },
    });
    return;
  }

  // Handle configuration or validation initialization error
  if (err.message && err.message.includes('TALLY_API_KEY')) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIGURATION_ERROR',
        message: 'Tally service configuration is invalid or missing required credentials',
      },
    });
    return;
  }

  // General internal server error (never leak stack trace in production)
  const isProduction = process.env['NODE_ENV'] === 'production';
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected internal error occurred' : err.message,
    },
  });
}

function mapStatusToErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 429:
      return 'RATE_LIMITED';
    case 502:
      return 'UPSTREAM_GATEWAY_ERROR';
    case 504:
      return 'UPSTREAM_GATEWAY_TIMEOUT';
    default:
      return 'SERVER_ERROR';
  }
}
