import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import type { DatabaseReadinessResult } from './config/database.js';
import { requestIdMiddleware } from './common/middleware/requestId.js';
import { httpLoggerMiddleware } from './common/middleware/logger.js';
import {
  createApiRateLimiter,
  createCorsMiddleware,
  createHelmetMiddleware,
} from './common/middleware/security.js';
import {
  centralizedErrorHandler,
  notFoundHandler,
} from './common/middleware/errorHandler.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createGeographyRouter } from './modules/geography/geography.routes.js';
import { createElectionsRouter } from './modules/elections/elections.routes.js';
import { createPartiesRouter } from './modules/parties/parties.routes.js';
import { createCandidatesRouter } from './modules/candidates/candidates.routes.js';
import {
  createAuthRouter,
  type CreateAuthRouterOptions,
} from './modules/auth/auth.routes.js';
import {
  createVotersRouter,
  type CreateVotersRouterOptions,
} from './modules/voters/voters.routes.js';

export interface CreateAppOptions {
  clientOrigin?: string;
  allowedOrigins?: string[];
  enableRateLimit?: boolean;
  rateLimitMax?: number;
  readinessCheck?: () => Promise<DatabaseReadinessResult>;
  authOptions?: CreateAuthRouterOptions;
  votersOptions?: CreateVotersRouterOptions;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const origins =
    options.allowedOrigins ??
    options.clientOrigin ??
    process.env.CLIENT_ORIGIN ??
    'http://localhost:3000';

  app.disable('x-powered-by');

  app.use(requestIdMiddleware);
  app.use(httpLoggerMiddleware);
  app.use(createHelmetMiddleware());
  app.use(createCorsMiddleware(origins));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  const shouldRateLimit =
    typeof options.rateLimitMax === 'number' ||
    (options.enableRateLimit !== false && process.env.NODE_ENV !== 'test');

  if (shouldRateLimit) {
    app.use('/api/v1', createApiRateLimiter(options.rateLimitMax ?? 120));
  }

  app.use(
    '/api/v1/health',
    createHealthRouter({ readinessCheck: options.readinessCheck })
  );
  app.use(
    '/api/v1/auth',
    createAuthRouter({
      enableRateLimit: options.enableRateLimit,
      ...options.authOptions,
    })
  );
  app.use('/api/v1/voters', createVotersRouter(options.votersOptions));
  app.use('/api/v1/geography', createGeographyRouter());
  app.use('/api/v1/elections', createElectionsRouter());
  app.use('/api/v1/parties', createPartiesRouter());
  app.use('/api/v1/candidates', createCandidatesRouter());

  app.use(notFoundHandler);
  app.use(centralizedErrorHandler);

  return app;
}
