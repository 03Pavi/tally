import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { TallyPrimeController } from './tally-prime.controller.js';
import {
  balanceSheetQuerySchema,
  ledgerListQuerySchema,
  nameParamSchema,
  profitLossQuerySchema,
  vendorListQuerySchema,
  vendorOutstandingQuerySchema,
} from './tally-prime.validators.js';

export function createTallyPrimeRouter(controller: TallyPrimeController = new TallyPrimeController()): Router {
  const router = Router();

  // Health and connection
  router.get('/health', asyncHandler(controller.health));
  router.get('/connection', asyncHandler(controller.connection));

  // Ledgers
  router.get('/ledgers', validate(ledgerListQuerySchema, 'query'), asyncHandler(controller.listLedgers));
  router.get('/ledgers/:name', validate(nameParamSchema, 'params'), asyncHandler(controller.getLedger));

  // Vendors. The static `outstanding` route is registered before `:name`, so it is never read as a vendor name.
  router.get('/vendors', validate(vendorListQuerySchema, 'query'), asyncHandler(controller.listVendors));
  router.get(
    '/vendors/outstanding',
    validate(vendorOutstandingQuerySchema, 'query'),
    asyncHandler(controller.listVendorOutstanding)
  );
  router.get('/vendors/:name', validate(nameParamSchema, 'params'), asyncHandler(controller.getVendor));

  // Financial reports
  router.get(
    '/reports/balance-sheet',
    validate(balanceSheetQuerySchema, 'query'),
    asyncHandler(controller.balanceSheet)
  );
  router.get(
    '/reports/profit-loss',
    validate(profitLossQuerySchema, 'query'),
    asyncHandler(controller.profitLoss)
  );

  return router;
}

export const tallyPrimeRouter = createTallyPrimeRouter();
