import type { Request, Response, NextFunction } from 'express';
import { TallyPrimeError } from '../modules/tally-prime/tally-prime.errors.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // TallyPrime adapter errors carry safe, client-ready messages
  if (err instanceof TallyPrimeError) {
    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Malformed JSON (400) and oversized bodies (413) come from the body parser and carry a status
  const parserStatus = (err as { status?: number }).status;
  if (parserStatus === 400 || parserStatus === 413) {
    res.status(parserStatus).json({
      success: false,
      error: {
        code: parserStatus === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        message: parserStatus === 413 ? 'Request body is too large' : 'Request body is not valid JSON',
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
