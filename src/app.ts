import express, { type Application, type Request, type Response } from 'express';
import { usersRouter } from './modules/users/users.routes.js';
import { organizationsRouter } from './modules/organizations/organizations.routes.js';
import { formsRouter } from './modules/forms/forms.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { workspacesRouter } from './modules/workspaces/workspaces.routes.js';
import { foldersRouter } from './modules/folders/folders.routes.js';
import { webhooksRouter } from './modules/webhooks/webhooks.routes.js';
import { tallyRouter } from './modules/tally/tally.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { setupSwagger } from './config/swagger.js';

export function createApp(): Application {
  const app = express();

  // Basic security and parsing middleware
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Swagger UI & OpenAPI JSON documentation
  setupSwagger(app);

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Feature modules routes
  app.use('/api/users', usersRouter);
  app.use('/api/organizations', organizationsRouter);
  app.use('/api/forms', formsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/workspaces', foldersRouter); // /api/workspaces/:workspaceId/folders
  app.use('/api/webhooks', webhooksRouter);

  // Backward-compatible unified tally router
  app.use('/api/tally', tallyRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested route does not exist',
      },
    });
  });

  // Central error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
