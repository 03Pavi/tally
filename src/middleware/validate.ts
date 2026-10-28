import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export type RequestPart = 'query' | 'params' | 'body';

export function validate(schema: ZodSchema, part: RequestPart = 'query') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const zodError = result.error as ZodError;
      const issues = zodError.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: issues,
        },
      });
      return;
    }

    // Replace the part with parsed & coerced values
    (req as unknown as Record<string, unknown>)[part] = result.data;
    next();
  };
}
