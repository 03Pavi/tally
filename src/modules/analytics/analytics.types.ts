export type AnalyticsPeriod =
  | 'today'
  | 'yesterday'
  | '24h'
  | '7d'
  | '30d'
  | '3m'
  | '6m'
  | '12m'
  | 'all';

export interface AnalyticsQuery {
  period: AnalyticsPeriod;
}

export interface FormMetrics {
  visits?: number;
  submissions?: number;
  completionRate?: number;
  averageTime?: number;
  [key: string]: unknown;
}

export interface FormVisits {
  period: string;
  visits: Array<{ date: string; count: number; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface FormSubmissionAnalytics {
  period: string;
  submissions: Array<{ date: string; completed: number; partial: number; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface FormDimensions {
  period: string;
  dimensions: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FormDropOff {
  period: string;
  dropOff: Array<{ questionId: string; dropOffCount: number; dropOffRate: number; [key: string]: unknown }>;
  [key: string]: unknown;
}
