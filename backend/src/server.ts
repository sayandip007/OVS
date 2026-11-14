import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { disconnectDatabase, getPrismaClient } from './config/database.js';
import { logger } from './common/middleware/logger.js';

async function bootstrap(): Promise<void> {
  const env = getEnv();
  const prisma = getPrismaClient();

  await prisma.$connect();
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Connected to PostgreSQL via Prisma');

  const app = createApp({ clientOrigin: env.CLIENT_ORIGIN });
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, apiPrefix: '/api/v1' },
      'OVS Phase 8.2 Backend Foundation server listening'
    );
  });

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Received shutdown signal, beginning graceful connection draining');

    // Force exit after 10 seconds if connections fail to close
    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s. Forcing process termination.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    server.close(async (err) => {
      clearTimeout(forceExitTimer);
      if (err) {
        logger.error({ err }, 'Error during HTTP server close');
      }
      try {
        await disconnectDatabase();
        logger.info('Database pool closed cleanly. Process exiting.');
        process.exit(0);
      } catch (dbErr) {
        logger.error({ dbErr }, 'Error disconnecting database pool');
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start OVS backend server');
  process.exit(1);
});
