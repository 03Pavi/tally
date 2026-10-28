import { TallyClient } from '../../client/tally.client.js';
import type {
  ListWebhooksQuery,
  ListWebhooksResponse,
  Webhook,
  CreateWebhookPayload,
  UpdateWebhookPayload,
  ListWebhookEventsQuery,
  ListWebhookEventsResponse,
  RetryWebhookEventResponse,
} from './webhooks.types.js';

export class WebhooksService {
  private readonly client: TallyClient;

  constructor(client?: TallyClient) {
    this.client = client ?? new TallyClient();
  }

  /**
   * Returns a paginated list of all webhooks across accessible forms.
   * Documented endpoint: GET https://api.tally.so/webhooks
   */
  public async listWebhooks(query: ListWebhooksQuery = {}): Promise<ListWebhooksResponse> {
    const params: Record<string, number | undefined> = {};
    if (query.page !== undefined) params['page'] = query.page;
    if (query.limit !== undefined) params['limit'] = query.limit;
    return this.client.get<ListWebhooksResponse>('/webhooks', { params });
  }

  /**
   * Creates a new webhook for a form to receive form events.
   * Documented endpoint: POST https://api.tally.so/webhooks
   */
  public async createWebhook(payload: CreateWebhookPayload): Promise<Webhook> {
    return this.client.post<Webhook>('/webhooks', payload);
  }

  /**
   * Updates an existing webhook configuration.
   * Documented endpoint: PATCH https://api.tally.so/webhooks/{webhookId}
   */
  public async updateWebhook(
    webhookId: string,
    payload: UpdateWebhookPayload
  ): Promise<Webhook> {
    if (!webhookId || !webhookId.trim()) throw new Error('webhookId is required');
    return this.client.patch<Webhook>(
      `/webhooks/${encodeURIComponent(webhookId.trim())}`,
      payload
    );
  }

  /**
   * Deletes a webhook.
   * Documented endpoint: DELETE https://api.tally.so/webhooks/{webhookId}
   */
  public async deleteWebhook(webhookId: string): Promise<void> {
    if (!webhookId || !webhookId.trim()) throw new Error('webhookId is required');
    return this.client.delete<void>(`/webhooks/${encodeURIComponent(webhookId.trim())}`);
  }

  /**
   * Returns a paginated list of webhook delivery events for a specific webhook.
   * Documented endpoint: GET https://api.tally.so/webhooks/{webhookId}/events
   */
  public async listEvents(
    webhookId: string,
    query: ListWebhookEventsQuery = {}
  ): Promise<ListWebhookEventsResponse> {
    if (!webhookId || !webhookId.trim()) throw new Error('webhookId is required');
    const params: Record<string, number | undefined> = {};
    if (query.page !== undefined) params['page'] = query.page;
    return this.client.get<ListWebhookEventsResponse>(
      `/webhooks/${encodeURIComponent(webhookId.trim())}/events`,
      { params }
    );
  }

  /**
   * Retries sending a failed webhook event.
   * Documented endpoint: POST https://api.tally.so/webhooks/{webhookId}/events/{eventId}
   */
  public async retryEvent(
    webhookId: string,
    eventId: string
  ): Promise<RetryWebhookEventResponse> {
    if (!webhookId || !webhookId.trim()) throw new Error('webhookId is required');
    if (!eventId || !eventId.trim()) throw new Error('eventId is required');
    return this.client.post<RetryWebhookEventResponse>(
      `/webhooks/${encodeURIComponent(webhookId.trim())}/events/${encodeURIComponent(eventId.trim())}`
    );
  }
}
