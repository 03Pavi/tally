import { app } from './app.js';
import { getEnv } from './config/env.js';

try {
  const env = getEnv();

  const server = app.listen(env.PORT, () => {
    // Only log non-sensitive configuration
    console.log(`[Tally Service] Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    console.log(`[Tally Service] TallyPrime integration URL: ${env.TALLY_PRIME_URL}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[Tally Service] Received ${signal}. Gracefully shutting down...`);
    server.close(() => {
      console.log('[Tally Service] HTTP server closed.');
      process.exit(0);
    });

    // Force exit if close takes too long
    setTimeout(() => {
      console.error('[Tally Service] Forcing shutdown after timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  console.error('[Tally Service] Failed to start server:', (error as Error).message);
  process.exit(1);
}
