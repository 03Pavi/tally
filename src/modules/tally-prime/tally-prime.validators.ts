import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts YYYY-MM-DD only, and rejects dates that do not exist (for example 2026-02-30). */
export const isoDateSchema = z
  .string()
  .regex(ISO_DATE, 'Date must use the YYYY-MM-DD format')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day!));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
  }, 'Date is not a valid calendar date');

const searchSchema = z.string().trim().max(200, 'Search cannot exceed 200 characters').optional();

function intParam(defaultValue: number, min: number, max: number, label: string) {
  return z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (val === undefined || val === '') return defaultValue;
      const parsed = Number(val);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be an integer between ${min} and ${max}`,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

const limitSchema = intParam(100, 1, 500, 'Limit');
const offsetSchema = intParam(0, 0, Number.MAX_SAFE_INTEGER, 'Offset');

export const ledgerListQuerySchema = z.object({
  search: searchSchema,
  group: z.string().trim().max(200, 'Group cannot exceed 200 characters').optional(),
  limit: limitSchema,
  offset: offsetSchema,
});

export const vendorListQuerySchema = z.object({
  search: searchSchema,
  limit: limitSchema,
  offset: offsetSchema,
});

export const vendorOutstandingQuerySchema = z.object({
  search: searchSchema,
  asOfDate: isoDateSchema.optional(),
  onlyOutstanding: z
    .enum(['true', 'false'], { errorMap: () => ({ message: 'onlyOutstanding must be true or false' }) })
    .optional()
    .transform((val) => val === 'true'),
});

export const nameParamSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300, 'Name cannot exceed 300 characters'),
});

export const balanceSheetQuerySchema = z.object({
  asOfDate: isoDateSchema.optional(),
});

export const profitLossQuerySchema = z
  .object({
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.fromDate === undefined) !== (value.toDate === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fromDate and toDate must be provided together',
        path: ['toDate'],
      });
      return;
    }
    if (value.fromDate !== undefined && value.toDate !== undefined && value.fromDate > value.toDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fromDate must be on or before toDate',
        path: ['fromDate'],
      });
    }
  });

export type LedgerListQuery = z.infer<typeof ledgerListQuerySchema>;
export type VendorListQuery = z.infer<typeof vendorListQuerySchema>;
export type VendorOutstandingQuery = z.infer<typeof vendorOutstandingQuerySchema>;
export type BalanceSheetQuery = z.infer<typeof balanceSheetQuerySchema>;
export type ProfitLossQuery = z.infer<typeof profitLossQuerySchema>;
