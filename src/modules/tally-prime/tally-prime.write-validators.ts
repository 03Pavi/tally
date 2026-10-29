import { z } from 'zod';
import { isoDateSchema } from './tally-prime.validators.js';

export const VOUCHER_TYPES = ['Sales', 'Purchase', 'Receipt', 'Payment', 'Contra', 'Journal'] as const;

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE_PATTERN = /^[0-9+()\- ]{6,20}$/;

const nameSchema = z.string().trim().min(1, 'Name is required').max(200, 'Name cannot exceed 200 characters');

/** Money amounts: finite, at most two decimals, and within a sane magnitude. */
export const amountSchema = z
  .number({ invalid_type_error: 'Amount must be a number' })
  .finite('Amount must be finite')
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Amount may have at most two decimals')
  .refine((value) => Math.abs(value) < 1e12, 'Amount is out of range');

const optionalText = (max: number) => z.string().trim().max(max).optional();

const ledgerFields = {
  parent: nameSchema.optional(),
  openingBalance: amountSchema.optional(),
  mailingName: optionalText(200),
  addressLines: z.array(z.string().trim().min(1).max(200)).max(5).optional(),
  email: z.string().trim().email('Email is invalid').max(254).optional(),
  phone: z.string().trim().regex(PHONE_PATTERN, 'Phone number is invalid').optional(),
  mobile: z.string().trim().regex(PHONE_PATTERN, 'Mobile number is invalid').optional(),
  gstin: z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'GSTIN format is invalid').optional(),
  stateName: optionalText(100),
};

/** Body for creating a ledger. Unknown fields are rejected. */
export const ledgerCreateSchema = z.object({ name: nameSchema, ...ledgerFields }).strict();

/** Body for updating a ledger. Renaming is not supported. At least one field is required. */
export const ledgerPatchSchema = z
  .object(ledgerFields)
  .strict()
  .refine((value) => Object.values(value).some((v) => v !== undefined), 'At least one field is required');

/** Party (vendor or customer) creation uses the ledger shape. The parent group is checked in the service. */
export const partyCreateSchema = ledgerCreateSchema;
export const partyPatchSchema = ledgerPatchSchema;

export const groupCreateSchema = z.object({ name: nameSchema, parent: nameSchema }).strict();
export const groupPatchSchema = z.object({ parent: nameSchema }).strict();

export const voucherEntrySchema = z
  .object({
    ledger: nameSchema,
    /** Signed: positive = debit, negative = credit. Zero entries are not allowed. */
    amount: amountSchema.refine((value) => value !== 0, 'Entry amount cannot be zero'),
  })
  .strict();

export const voucherCreateSchema = z
  .object({
    type: z.enum(VOUCHER_TYPES, { errorMap: () => ({ message: `Voucher type must be one of ${VOUCHER_TYPES.join(', ')}` }) }),
    date: isoDateSchema,
    number: z.string().trim().min(1).max(50).optional(),
    partyLedger: nameSchema.optional(),
    narration: optionalText(500),
    reference: optionalText(100),
    entries: z.array(voucherEntrySchema).min(2, 'A voucher needs at least two entries').max(200),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Compare in integer cents so binary floating-point error cannot hide an imbalance.
    const totalCents = value.entries.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0);
    if (totalCents !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debit and credit totals must be equal (entries must sum to zero)',
        path: ['entries'],
      });
    }
  });

export const nameParamsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300, 'Name cannot exceed 300 characters'),
});

/**
 * Runtime admin settings. Changes live in memory only and reset on restart.
 * The token must be at least 32 characters with no spaces, so it fits in a Bearer header.
 */
export const adminConfigSchema = z
  .object({
    TALLY_PRIME_URL: z.string().trim().min(1).max(300).optional(),
    ADMIN_API_TOKEN: z
      .string()
      .min(32, 'ADMIN_API_TOKEN must be at least 32 characters')
      .max(256)
      .regex(/^\S+$/, 'ADMIN_API_TOKEN cannot contain spaces')
      .optional(),
  })
  .strict()
  .refine((value) => value.TALLY_PRIME_URL !== undefined || value.ADMIN_API_TOKEN !== undefined, 'Send TALLY_PRIME_URL, ADMIN_API_TOKEN, or both');

export const confirmQuerySchema = z.object({
  confirm: z.literal('true', { errorMap: () => ({ message: 'Destructive operation requires confirm=true' }) }),
});

export const voucherDeleteParamsSchema = z.object({
  type: z.enum(VOUCHER_TYPES),
  number: z.string().trim().min(1).max(50),
});

export const voucherDeleteQuerySchema = confirmQuerySchema.extend({ date: isoDateSchema });

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'Idempotency-Key may contain letters, digits, _ and - only');

export type LedgerCreateBody = z.infer<typeof ledgerCreateSchema>;
export type LedgerPatchBody = z.infer<typeof ledgerPatchSchema>;
export type GroupCreateBody = z.infer<typeof groupCreateSchema>;
export type GroupPatchBody = z.infer<typeof groupPatchSchema>;
export type VoucherCreateBody = z.infer<typeof voucherCreateSchema>;
