import type { Request, Response } from 'express';
import { adminActorOf } from '../../middleware/admin-auth.js';
import { TallyPrimeError } from './tally-prime.errors.js';
import { auditLog } from './tally-prime.audit.js';
import { TallyPrimeAdminService, type PartyKind } from './tally-prime.admin.service.js';
import {
  completeIdempotent,
  abandonIdempotent,
  fingerprintOf,
  startIdempotent,
} from './tally-prime.idempotency.js';
import {
  idempotencyKeySchema,
  type GroupCreateBody,
  type GroupPatchBody,
  type LedgerCreateBody,
  type LedgerPatchBody,
  type VoucherCreateBody,
} from './tally-prime.write-validators.js';

/**
 * Runs an administrative operation and writes one audit entry for it.
 * The entry records the actor, operation, target and outcome. Bodies and tokens are never logged.
 */
async function audited<T>(
  res: Response,
  operation: string,
  target: string,
  run: () => Promise<T>
): Promise<T> {
  const actor = adminActorOf(res);
  try {
    const result = await run();
    auditLog({ actor, operation, target, outcome: 'success', status: 200 });
    return result;
  } catch (error) {
    const known = error instanceof TallyPrimeError ? error : null;
    auditLog({
      actor,
      operation,
      target,
      outcome: known && known.status < 500 ? 'rejected' : 'failed',
      status: known?.status ?? 500,
      code: known?.code,
    });
    throw error;
  }
}

function dataOk(res: Response, status: number, data: unknown): void {
  res.status(status).json({ success: true, data });
}

export class TallyPrimeAdminController {
  private readonly admin: TallyPrimeAdminService;

  constructor(admin: TallyPrimeAdminService) {
    this.admin = admin;
  }

  // ----- Company -----

  public listCompanies = async (_req: Request, res: Response): Promise<void> => {
    dataOk(res, 200, await this.admin.listCompanies());
  };

  public currentCompany = async (_req: Request, res: Response): Promise<void> => {
    dataOk(res, 200, await this.admin.currentCompany());
  };

  public selectCompany = async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body as { name: string };
    const selected = await audited(res, 'company.select', `company:${name}`, () => this.admin.selectCompany(name));
    dataOk(res, 200, selected);
  };

  public clearCompanySelection = async (_req: Request, res: Response): Promise<void> => {
    await audited(res, 'company.clear', 'company', async () => this.admin.clearCompanySelection());
    dataOk(res, 200, { cleared: true });
  };

  // ----- Groups -----

  public listGroups = async (_req: Request, res: Response): Promise<void> => {
    dataOk(res, 200, await this.admin.listGroups());
  };

  public getGroup = async (req: Request, res: Response): Promise<void> => {
    dataOk(res, 200, await this.admin.getGroup(String(req.params['name'])));
  };

  public createGroup = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as GroupCreateBody;
    await audited(res, 'group.create', `group:${body.name}`, () => this.admin.createGroup(body));
    dataOk(res, 201, { created: true, name: body.name, parent: body.parent });
  };

  public updateGroup = async (req: Request, res: Response): Promise<void> => {
    const name = String(req.params['name']);
    const body = req.body as GroupPatchBody;
    const outcome = await audited(res, 'group.update', `group:${name}`, () => this.admin.updateGroup(name, body));
    dataOk(res, 200, { updated: true, name, parent: body.parent, counts: outcome });
  };

  public deleteGroup = async (req: Request, res: Response): Promise<void> => {
    const name = String(req.params['name']);
    const outcome = await audited(res, 'group.delete', `group:${name}`, () => this.admin.deleteGroup(name));
    dataOk(res, 200, { deleted: true, name, counts: outcome });
  };

  // ----- Ledgers -----

  public getLedger = async (req: Request, res: Response): Promise<void> => {
    dataOk(res, 200, await this.admin.getLedger(String(req.params['name'])));
  };

  public createLedger = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as LedgerCreateBody;
    await audited(res, 'ledger.create', `ledger:${body.name}`, () => this.admin.createLedger(body));
    dataOk(res, 201, { created: true, name: body.name });
  };

  public updateLedger = async (req: Request, res: Response): Promise<void> => {
    const name = String(req.params['name']);
    const body = req.body as LedgerPatchBody;
    const outcome = await audited(res, 'ledger.update', `ledger:${name}`, () => this.admin.updateLedger(name, body));
    dataOk(res, 200, { updated: true, name, counts: outcome });
  };

  public deleteLedger = async (req: Request, res: Response): Promise<void> => {
    const name = String(req.params['name']);
    const outcome = await audited(res, 'ledger.delete', `ledger:${name}`, () => this.admin.deleteLedger(name));
    dataOk(res, 200, { deleted: true, name, counts: outcome });
  };

  // ----- Vendors and customers -----

  public listParties = (kind: PartyKind) => async (req: Request, res: Response): Promise<void> => {
    const search = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
    dataOk(res, 200, await this.admin.listParties(kind, search));
  };

  public getParty = (kind: PartyKind) => async (req: Request, res: Response): Promise<void> => {
    dataOk(res, 200, await this.admin.getParty(kind, String(req.params['name'])));
  };

  /** Customer balances. A positive closing balance is a receivable. */
  public customerOutstanding = async (_req: Request, res: Response): Promise<void> => {
    const rows = await this.admin.listParties('customer');
    dataOk(
      res,
      200,
      rows.map((row) => ({
        name: row.name,
        group: row.group,
        closingBalance: row.closingBalance,
        balanceNature: row.balanceNature,
        receivable: row.closingBalance,
      }))
    );
  };

  public createParty = (kind: PartyKind) => async (req: Request, res: Response): Promise<void> => {
    const body = req.body as LedgerCreateBody;
    await audited(res, `${kind}.create`, `${kind}:${body.name}`, () => this.admin.createParty(kind, body));
    dataOk(res, 201, { created: true, name: body.name });
  };

  public updateParty = (kind: PartyKind) => async (req: Request, res: Response): Promise<void> => {
    const name = String(req.params['name']);
    const body = req.body as LedgerPatchBody;
    const outcome = await audited(res, `${kind}.update`, `${kind}:${name}`, () =>
      this.admin.updateParty(kind, name, body)
    );
    dataOk(res, 200, { updated: true, name, counts: outcome });
  };

  public deleteParty = (kind: PartyKind) => async (req: Request, res: Response): Promise<void> => {
    const name = String(req.params['name']);
    const outcome = await audited(res, `${kind}.delete`, `${kind}:${name}`, () =>
      this.admin.deleteParty(kind, name)
    );
    dataOk(res, 200, { deleted: true, name, counts: outcome });
  };

  // ----- Vouchers -----

  public listVouchers = async (req: Request, res: Response): Promise<void> => {
    const { fromDate, toDate, type } = req.query as Record<string, string | undefined>;
    const rows = await this.admin.listVouchers(fromDate!, toDate!, type);
    const limit = Number(req.query['limit'] ?? 100);
    const offset = Number(req.query['offset'] ?? 0);
    res.status(200).json({
      success: true,
      data: rows.slice(offset, offset + limit),
      meta: { total: rows.length, limit, offset },
    });
  };

  /**
   * Creates a voucher. With an Idempotency-Key header, a retry with the same body returns the
   * original response and does not post again.
   */
  public createVoucher = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as VoucherCreateBody;
    const target = `voucher:${body.type}:${body.number ?? 'auto'}:${body.date}`;

    const rawKey = req.get('idempotency-key');
    let key: string | undefined;
    if (rawKey !== undefined) {
      const parsedKey = idempotencyKeySchema.safeParse(rawKey);
      if (!parsedKey.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: [{ field: 'Idempotency-Key', message: parsedKey.error.issues[0]?.message ?? 'Invalid key' }],
          },
        });
        return;
      }
      key = parsedKey.data;
    }
    if (key !== undefined) {
      const start = startIdempotent(key, fingerprintOf(body));
      if (start.kind === 'replay') {
        res.setHeader('Idempotent-Replayed', 'true');
        res.status(start.status).json(start.body);
        return;
      }
    }

    try {
      const { type, date, number, ...counts } = await audited(res, 'voucher.create', target, () =>
        this.admin.createVoucher(body)
      );
      const payload = { success: true, data: { created: true, type, date, number, counts } };
      if (key !== undefined) completeIdempotent(key, 201, payload);
      res.status(201).json(payload);
    } catch (error) {
      if (key !== undefined) abandonIdempotent(key);
      throw error;
    }
  };

  public deleteVoucher = async (req: Request, res: Response): Promise<void> => {
    const type = String(req.params['type']);
    const number = String(req.params['number']);
    const date = String(req.query['date']);
    const target = `voucher:${type}:${number}:${date}`;
    const outcome = await audited(res, 'voucher.delete', target, () => this.admin.deleteVoucher(type, number, date));
    dataOk(res, 200, { deleted: true, type, number, date, counts: outcome });
  };

  // ----- Reports -----

  public trialBalance = async (req: Request, res: Response): Promise<void> => {
    const { fromDate, toDate } = req.query as Record<string, string | undefined>;
    dataOk(res, 200, await this.admin.trialBalance(fromDate, toDate));
  };

  /** Unsupported report kinds answer 501 so clients never mistake them for empty results. */
  public unsupported = (feature: string, reason: string) => async (_req: Request, _res: Response): Promise<void> => {
    throw new TallyPrimeError({ message: `${feature} is not supported: ${reason}`, status: 501, code: 'NOT_SUPPORTED' });
  };
}
