export type WebhookEventType =
  | 'FORM_RESPONSE'
  | 'FORM_SUBMISSION'
  | 'FORM_UPDATED'
  | string;

export interface WebhookHeader {
  name: string;
  value: string;
}

export interface Webhook {
  id: string;
  formId: string;
  url: string;
  eventTypes: WebhookEventType[];
  isEnabled?: boolean;
  signingSecret?: string | null;
  httpHeaders?: WebhookHeader[] | null;
  externalSubscriber?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  eventType: string;
  status: string;
  responseStatus?: number;
  attempts?: number;
  createdAt: string;
  [key: string]: unknown;
}

export interface ListWebhooksQuery {
  page?: number;
  limit?: number;
}

export interface ListWebhooksResponse {
  webhooks?: Webhook[];
  items?: Webhook[];
  page?: number;
  limit?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface CreateWebhookPayload {
  formId: string;
  url: string;
  eventTypes: WebhookEventType[];
  signingSecret?: string | null;
  httpHeaders?: WebhookHeader[] | null;
  externalSubscriber?: string | null;
}

export interface UpdateWebhookPayload {
  url?: string;
  eventTypes?: WebhookEventType[];
  isEnabled?: boolean;
  signingSecret?: string | null;
  httpHeaders?: WebhookHeader[] | null;
}

export interface ListWebhookEventsQuery {
  page?: number;
}

export interface ListWebhookEventsResponse {
  events?: WebhookEvent[];
  items?: WebhookEvent[];
  page?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface RetryWebhookEventResponse {
  id: string;
  status: string;
  [key: string]: unknown;
}
