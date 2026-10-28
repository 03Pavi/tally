import type { Request, Response } from 'express';
import { WebhooksService } from './webhooks.service.js';
import type {
  ValidatedListWebhooksQuery,
  ValidatedWebhookIdParam,
  ValidatedWebhookEventParam,
  ValidatedCreateWebhookBody,
  ValidatedUpdateWebhookBody,
  ValidatedListWebhookEventsQuery,
} from './webhooks.validators.js';

export class WebhooksController {
  private readonly webhooksService: WebhooksService;

  constructor(webhooksService?: WebhooksService) {
    this.webhooksService = webhooksService ?? new WebhooksService();
  }

  public listWebhooks = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ValidatedListWebhooksQuery;
    const result = await this.webhooksService.listWebhooks(query);
    res.status(200).json({ success: true, data: result });
  };

  public createWebhook = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ValidatedCreateWebhookBody;
    const result = await this.webhooksService.createWebhook(body);
    res.status(201).json({ success: true, data: result });
  };

  public updateWebhook = async (req: Request, res: Response): Promise<void> => {
    const { webhookId } = req.params as unknown as ValidatedWebhookIdParam;
    const body = req.body as ValidatedUpdateWebhookBody;
    const result = await this.webhooksService.updateWebhook(webhookId, body);
    res.status(200).json({ success: true, data: result });
  };

  public deleteWebhook = async (req: Request, res: Response): Promise<void> => {
    const { webhookId } = req.params as unknown as ValidatedWebhookIdParam;
    await this.webhooksService.deleteWebhook(webhookId);
    res.status(200).json({
      success: true,
      data: { message: 'Webhook deleted successfully' },
    });
  };

  public listEvents = async (req: Request, res: Response): Promise<void> => {
    const { webhookId } = req.params as unknown as ValidatedWebhookIdParam;
    const query = req.query as unknown as ValidatedListWebhookEventsQuery;
    const result = await this.webhooksService.listEvents(webhookId, query);
    res.status(200).json({ success: true, data: result });
  };

  public retryEvent = async (req: Request, res: Response): Promise<void> => {
    const { webhookId, eventId } = req.params as unknown as ValidatedWebhookEventParam;
    const result = await this.webhooksService.retryEvent(webhookId, eventId);
    res.status(200).json({ success: true, data: result });
  };
}
