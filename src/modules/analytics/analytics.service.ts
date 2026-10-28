import { TallyClient } from '../../client/tally.client.js';
import type {
  AnalyticsPeriod,
  FormMetrics,
  FormVisits,
  FormSubmissionAnalytics,
  FormDimensions,
  FormDropOff,
} from './analytics.types.js';

export class AnalyticsService {
  private readonly client: TallyClient;

  constructor(client?: TallyClient) {
    this.client = client ?? new TallyClient();
  }

  /**
   * Retrieves aggregate metrics for a form (visits, submissions, completion rate).
   * Documented endpoint: GET https://api.tally.so/forms/{formId}/analytics/metrics
   */
  public async getMetrics(formId: string, period: AnalyticsPeriod): Promise<FormMetrics> {
    if (!formId || !formId.trim()) throw new Error('formId is required');
    return this.client.get<FormMetrics>(
      `/forms/${encodeURIComponent(formId.trim())}/analytics/metrics`,
      { params: { period } }
    );
  }

  /**
   * Retrieves visit counts for a form over time.
   * Documented endpoint: GET https://api.tally.so/forms/{formId}/analytics/visits
   */
  public async getVisits(formId: string, period: AnalyticsPeriod): Promise<FormVisits> {
    if (!formId || !formId.trim()) throw new Error('formId is required');
    return this.client.get<FormVisits>(
      `/forms/${encodeURIComponent(formId.trim())}/analytics/visits`,
      { params: { period } }
    );
  }

  /**
   * Retrieves completed and partial submission counts for a form over time.
   * Documented endpoint: GET https://api.tally.so/forms/{formId}/analytics/submissions
   */
  public async getSubmissionsAnalytics(
    formId: string,
    period: AnalyticsPeriod
  ): Promise<FormSubmissionAnalytics> {
    if (!formId || !formId.trim()) throw new Error('formId is required');
    return this.client.get<FormSubmissionAnalytics>(
      `/forms/${encodeURIComponent(formId.trim())}/analytics/submissions`,
      { params: { period } }
    );
  }

  /**
   * Retrieves visitor breakdowns by source, browser, OS, device, etc.
   * Documented endpoint: GET https://api.tally.so/forms/{formId}/analytics/dimensions
   */
  public async getDimensions(formId: string, period: AnalyticsPeriod): Promise<FormDimensions> {
    if (!formId || !formId.trim()) throw new Error('formId is required');
    return this.client.get<FormDimensions>(
      `/forms/${encodeURIComponent(formId.trim())}/analytics/dimensions`,
      { params: { period } }
    );
  }

  /**
   * Retrieves per-question drop-off statistics for a form.
   * Documented endpoint: GET https://api.tally.so/forms/{formId}/analytics/drop-off
   */
  public async getDropOff(formId: string, period: AnalyticsPeriod): Promise<FormDropOff> {
    if (!formId || !formId.trim()) throw new Error('formId is required');
    return this.client.get<FormDropOff>(
      `/forms/${encodeURIComponent(formId.trim())}/analytics/drop-off`,
      { params: { period } }
    );
  }
}
