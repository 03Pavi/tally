import express, { type Application, type Request, type Response } from 'express';
import { tallyPrimeRouter } from './modules/tally-prime/tally-prime.routes.js';
import { createTallyPrimeAdminRouter } from './modules/tally-prime/tally-prime.admin.routes.js';
import { requireAdminWhereNeeded } from './middleware/admin-auth.js';
import { companyFromQuery } from './modules/tally-prime/tally-prime.company-context.js';
import { createFanOutMiddleware } from './modules/tally-prime/tally-prime.fan-out.js';
import { TallyPrimeClient } from './modules/tally-prime/tally-prime.client.js';
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

  // Redirect root to Swagger UI documentation
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/api-docs');
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // TallyPrime mediator (local XML integration, loopback only)
  // Every TallyPrime route needs the admin bearer token (health is exempt inside requireAdmin)
  // Writes and /companies need the admin token. Other GET routes are public.
  app.use('/tally-prime', requireAdminWhereNeeded);
  // ?company=<name> applies to the whole request (validated against TallyPrime's open companies)
  app.use('/tally-prime', companyFromQuery);
  // Without a company and with several open, reads return each open company's result
  app.use('/tally-prime', createFanOutMiddleware(new TallyPrimeClient()));
  app.use('/tally-prime', tallyPrimeRouter);
  app.use('/tally-prime', createTallyPrimeAdminRouter());

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
