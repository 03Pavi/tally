import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { TallyPrimeAdminController } from './tally-prime.admin.controller.js';
import { TallyPrimeAdminService } from './tally-prime.admin.service.js';
import { TallyPrimeClient } from './tally-prime.client.js';
import { TallyPrimeService } from './tally-prime.service.js';
import { isoDateSchema } from './tally-prime.validators.js';
import {
  VOUCHER_TYPES,
  adminConfigSchema,
  confirmQuerySchema,
  groupCreateSchema,
  groupPatchSchema,
  ledgerCreateSchema,
  ledgerPatchSchema,
  nameParamsSchema,
  partyCreateSchema,
  partyPatchSchema,
  voucherCreateSchema,
  voucherDeleteParamsSchema,
  voucherDeleteQuerySchema,
} from './tally-prime.write-validators.js';

const MAX_VOUCHER_RANGE_DAYS = 366;

const companySelectBody = z.object({ name: z.string().trim().min(1, 'Company name is required').max(200) }).strict();

const voucherListQuery = z
  .object({
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
    type: z.enum(VOUCHER_TYPES).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.fromDate > value.toDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fromDate must be on or before toDate', path: ['fromDate'] });
    }
    const days = (Date.parse(value.toDate) - Date.parse(value.fromDate)) / 86400000;
    if (days > MAX_VOUCHER_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Date range cannot exceed ${MAX_VOUCHER_RANGE_DAYS} days`,
        path: ['toDate'],
      });
    }
  });

const optionalDateRangeQuery = z
  .object({ fromDate: isoDateSchema.optional(), toDate: isoDateSchema.optional() })
  .superRefine((value, ctx) => {
    if ((value.fromDate === undefined) !== (value.toDate === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fromDate and toDate must be provided together' });
    }
    if (value.fromDate !== undefined && value.toDate !== undefined && value.fromDate > value.toDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fromDate must be on or before toDate' });
    }
  });

const searchQuery = z.object({ search: z.string().trim().max(200).optional() });

/**
 * Administrative TallyPrime routes. Mounted under /tally-prime after the admin token check, so
 * every route here requires a valid bearer token. Static paths are registered before parameterized
 * ones, and destructive routes require confirm=true.
 */
export function createTallyPrimeAdminRouter(
  controller: TallyPrimeAdminController = new TallyPrimeAdminController(
    new TallyPrimeAdminService(new TallyPrimeClient(), new TallyPrimeService())
  )
): Router {
  const router = Router();
  const c = controller;

  // Company
  // Runtime admin settings (in memory, effective immediately)
  router.get('/admin/config', asyncHandler(c.getAdminConfig));
  router.put('/admin/config', validate(adminConfigSchema, 'body'), asyncHandler(c.updateAdminConfig));

  router.get('/companies', asyncHandler(c.listCompanies));
  router.get('/companies/current', asyncHandler(c.currentCompany));
  router.post('/companies/select', validate(companySelectBody, 'body'), asyncHandler(c.selectCompany));
  router.delete('/companies/select', asyncHandler(c.clearCompanySelection));

  // Groups
  router.get('/groups', asyncHandler(c.listGroups));
  router.post('/groups', validate(groupCreateSchema, 'body'), asyncHandler(c.createGroup));
  router.get('/groups/:name', validate(nameParamsSchema, 'params'), asyncHandler(c.getGroup));
  router.patch(
    '/groups/:name',
    validate(nameParamsSchema, 'params'),
    validate(groupPatchSchema, 'body'),
    asyncHandler(c.updateGroup)
  );
  router.delete(
    '/groups/:name',
    validate(nameParamsSchema, 'params'),
    validate(confirmQuerySchema, 'query'),
    asyncHandler(c.deleteGroup)
  );

  // Ledgers. The ledger list and the read-only ledger lookups live in the read router.
  router.post('/ledgers', validate(ledgerCreateSchema, 'body'), asyncHandler(c.createLedger));
  router.patch(
    '/ledgers/:name',
    validate(nameParamsSchema, 'params'),
    validate(ledgerPatchSchema, 'body'),
    asyncHandler(c.updateLedger)
  );
  router.delete(
    '/ledgers/:name',
    validate(nameParamsSchema, 'params'),
    validate(confirmQuerySchema, 'query'),
    asyncHandler(c.deleteLedger)
  );

  // Vendors. Reads (list, outstanding, by name) stay in the read router.
  router.post('/vendors', validate(partyCreateSchema, 'body'), asyncHandler(c.createParty('vendor')));
  router.patch(
    '/vendors/:name',
    validate(nameParamsSchema, 'params'),
    validate(partyPatchSchema, 'body'),
    asyncHandler(c.updateParty('vendor'))
  );
  router.delete(
    '/vendors/:name',
    validate(nameParamsSchema, 'params'),
    validate(confirmQuerySchema, 'query'),
    asyncHandler(c.deleteParty('vendor'))
  );

  // Customers. Static `outstanding` is registered before `:name`.
  router.get('/customers', validate(searchQuery, 'query'), asyncHandler(c.listParties('customer')));
  router.get('/customers/outstanding', asyncHandler(c.customerOutstanding));
  router.post('/customers', validate(partyCreateSchema, 'body'), asyncHandler(c.createParty('customer')));
  router.get('/customers/:name', validate(nameParamsSchema, 'params'), asyncHandler(c.getParty('customer')));
  router.patch(
    '/customers/:name',
    validate(nameParamsSchema, 'params'),
    validate(partyPatchSchema, 'body'),
    asyncHandler(c.updateParty('customer'))
  );
  router.delete(
    '/customers/:name',
    validate(nameParamsSchema, 'params'),
    validate(confirmQuerySchema, 'query'),
    asyncHandler(c.deleteParty('customer'))
  );

  // Vouchers
  router.get('/vouchers', validate(voucherListQuery, 'query'), asyncHandler(c.listVouchers));
  router.post('/vouchers', validate(voucherCreateSchema, 'body'), asyncHandler(c.createVoucher));
  router.delete(
    '/vouchers/:type/:number',
    validate(voucherDeleteParamsSchema, 'params'),
    validate(voucherDeleteQuerySchema, 'query'),
    asyncHandler(c.deleteVoucher)
  );

  // Reports
  router.get('/reports/trial-balance', validate(optionalDateRangeQuery, 'query'), asyncHandler(c.trialBalance));
  router.get(
    '/reports/cash-bank',
    asyncHandler(c.unsupported('Cash and bank summary', 'not implemented in this release'))
  );
  router.get(
    '/reports/receivables-payables',
    asyncHandler(c.unsupported('Bill-wise receivables and payables', 'bill-wise report parsing is not implemented'))
  );
  router.get(
    '/reports/stock-summary',
    asyncHandler(c.unsupported('Stock summary', 'inventory is not implemented in this release'))
  );

  return router;
}
