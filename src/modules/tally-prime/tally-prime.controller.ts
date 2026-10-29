import type { Request, Response } from 'express';
import { TallyPrimeService } from './tally-prime.service.js';
import type {
  BalanceSheetQuery,
  LedgerListQuery,
  ProfitLossQuery,
  VendorListQuery,
  VendorOutstandingQuery,
} from './tally-prime.validators.js';

export class TallyPrimeController {
  private readonly service: TallyPrimeService;

  constructor(service?: TallyPrimeService) {
    this.service = service ?? new TallyPrimeService();
  }

  public health = async (_req: Request, res: Response): Promise<void> => {
    // Process health only. TallyPrime reachability is reported by /connection.
    res.status(200).json({
      success: true,
      data: { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() },
    });
  };

  public connection = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.service.checkConnection();
    res.status(200).json({ success: true, data: result });
  };

  public listLedgers = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as LedgerListQuery;
    const result = await this.service.listLedgers(query);
    res.status(200).json({ success: true, data: result.items, meta: result.meta });
  };

  public getLedger = async (req: Request, res: Response): Promise<void> => {
    const ledger = await this.service.getLedger(String(req.params['name']));
    res.status(200).json({ success: true, data: ledger });
  };

  public listVendors = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as VendorListQuery;
    const result = await this.service.listVendors(query);
    res.status(200).json({ success: true, data: result.items, meta: result.meta });
  };

  public listVendorOutstanding = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as VendorOutstandingQuery;
    const rows = await this.service.listVendorOutstanding(query);
    res.status(200).json({ success: true, data: rows });
  };

  public getVendor = async (req: Request, res: Response): Promise<void> => {
    const vendor = await this.service.getVendor(String(req.params['name']));
    res.status(200).json({ success: true, data: vendor });
  };

  public balanceSheet = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as BalanceSheetQuery;
    const report = await this.service.getBalanceSheet(query.asOfDate);
    res.status(200).json({ success: true, data: report });
  };

  public profitLoss = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ProfitLossQuery;
    const report = await this.service.getProfitLoss(query.fromDate, query.toDate);
    res.status(200).json({ success: true, data: report });
  };
}
