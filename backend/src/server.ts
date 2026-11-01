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

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, closing HTTP server and Prisma pool');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start OVS backend server');
  process.exit(1);
});
