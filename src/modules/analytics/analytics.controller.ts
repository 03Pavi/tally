import type { Request, Response } from 'express';
import { AnalyticsService } from './analytics.service.js';
import type {
  ValidatedFormAnalyticsParam,
  ValidatedFormAnalyticsQuery,
} from './analytics.validators.js';

export class AnalyticsController {
  private readonly analyticsService: AnalyticsService;

  constructor(analyticsService?: AnalyticsService) {
    this.analyticsService = analyticsService ?? new AnalyticsService();
  }

  public getMetrics = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormAnalyticsParam;
    const { period } = req.query as unknown as ValidatedFormAnalyticsQuery;
    const result = await this.analyticsService.getMetrics(formId, period);
    res.status(200).json({ success: true, data: result });
  };

  public getVisits = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormAnalyticsParam;
    const { period } = req.query as unknown as ValidatedFormAnalyticsQuery;
    const result = await this.analyticsService.getVisits(formId, period);
    res.status(200).json({ success: true, data: result });
  };

  public getSubmissions = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormAnalyticsParam;
    const { period } = req.query as unknown as ValidatedFormAnalyticsQuery;
    const result = await this.analyticsService.getSubmissionsAnalytics(formId, period);
    res.status(200).json({ success: true, data: result });
  };

  public getDimensions = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormAnalyticsParam;
    const { period } = req.query as unknown as ValidatedFormAnalyticsQuery;
    const result = await this.analyticsService.getDimensions(formId, period);
    res.status(200).json({ success: true, data: result });
  };

  public getDropOff = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormAnalyticsParam;
    const { period } = req.query as unknown as ValidatedFormAnalyticsQuery;
    const result = await this.analyticsService.getDropOff(formId, period);
    res.status(200).json({ success: true, data: result });
  };
}
