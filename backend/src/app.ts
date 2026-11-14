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
import {
  createAdminElectionsRouter,
  type CreateAdminElectionsRouterOptions,
} from './modules/elections/admin.elections.routes.js';
import { createAdminCandidatesRouter } from './modules/candidates/candidates.admin.routes.js';
import { createAdminPartiesRouter } from './modules/parties/parties.admin.routes.js';
import { createAdminNominationsRouter } from './modules/nominations/nominations.routes.js';
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
import {
  createVoterVotingRouter,
  type CreateVoterVotingRouterOptions,
} from './modules/voting/voter.voting.routes.js';
import {
  createAdminRouter,
  type CreateAdminRouterOptions,
} from './modules/admin/admin.routes.js';
import {
  createAdminCountingRouter,
  type CreateAdminCountingRouterOptions,
} from './modules/counting/admin.counting.routes.js';
import {
  createPublicResultsRouter,
  type CreatePublicResultsRouterOptions,
} from './modules/counting/public.results.routes.js';
import {
  createAdminAnalyticsRouter,
  type CreateAdminAnalyticsRouterOptions,
} from './modules/analytics/admin.analytics.routes.js';
import {
  createPublicAnalyticsRouter,
  type CreatePublicAnalyticsRouterOptions,
} from './modules/analytics/public.analytics.routes.js';
import {
  createVoterNotificationsRouter,
  type CreateVoterNotificationsRouterOptions,
} from './modules/notifications/voter.notifications.routes.js';
import {
  createAdminAnnouncementsRouter,
  createAdminNotificationsDeliveryRouter,
  type CreateAdminAnnouncementsRouterOptions,
} from './modules/notifications/admin.announcements.routes.js';
import {
  createPublicAnnouncementsRouter,
  type CreatePublicAnnouncementsRouterOptions,
} from './modules/notifications/public.announcements.routes.js';
import {
  createAdminSimulationRouter,
  type CreateAdminSimulationRouterOptions,
} from './modules/admin/simulation.routes.js';
import {
  createAdminSystemSettingsRouter,
  createAdminFeatureFlagsRouter,
  createAdminMaintenanceRouter,
  createHealthDiagnosticsRouter,
  createPublicConfigRouter,
  type CreateSystemSettingsRouterOptions,
} from './modules/system-settings/settings.routes.js';
import { createMaintenanceMiddleware } from './modules/system-settings/maintenance.middleware.js';
import { MaintenanceService } from './modules/system-settings/maintenance.service.js';
import {
  createMetricsMiddleware,
  createMetricsHandler,
} from './modules/observability/metrics.js';

export interface CreateAppOptions {
  clientOrigin?: string;
  allowedOrigins?: string[];
  enableRateLimit?: boolean;
  rateLimitMax?: number;
  readinessCheck?: () => Promise<DatabaseReadinessResult>;
  authOptions?: CreateAuthRouterOptions;
  votersOptions?: CreateVotersRouterOptions;
  voterVotingOptions?: CreateVoterVotingRouterOptions;
  adminOptions?: CreateAdminRouterOptions;
  adminElectionsOptions?: CreateAdminElectionsRouterOptions;
  adminCountingOptions?: CreateAdminCountingRouterOptions;
  publicResultsOptions?: CreatePublicResultsRouterOptions;
  adminAnalyticsOptions?: CreateAdminAnalyticsRouterOptions;
  publicAnalyticsOptions?: CreatePublicAnalyticsRouterOptions;
  voterNotificationsOptions?: CreateVoterNotificationsRouterOptions;
  adminAnnouncementsOptions?: CreateAdminAnnouncementsRouterOptions;
  publicAnnouncementsOptions?: CreatePublicAnnouncementsRouterOptions;
  systemSettingsOptions?: CreateSystemSettingsRouterOptions;
  adminSimulationOptions?: CreateAdminSimulationRouterOptions;
  maintenanceService?: MaintenanceService;
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
  app.use(createMetricsMiddleware());
  app.use(httpLoggerMiddleware);
  app.use(createHelmetMiddleware());
  app.use(createCorsMiddleware(origins));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  // Prometheus metrics exposition endpoints
  app.get('/metrics', createMetricsHandler());
  app.get('/api/v1/metrics', createMetricsHandler());

  const shouldRateLimit =
    typeof options.rateLimitMax === 'number' ||
    (options.enableRateLimit !== false && process.env.NODE_ENV !== 'test');

  if (shouldRateLimit) {
    app.use('/api/v1', createApiRateLimiter(options.rateLimitMax ?? 120));
  }

  app.use(
    '/api/v1/health/diagnostics',
    createHealthDiagnosticsRouter(options.systemSettingsOptions)
  );
  app.use(
    '/api/v1/health',
    createHealthRouter({ readinessCheck: options.readinessCheck })
  );
  app.use(
    '/api/v1/system/public-config',
    createPublicConfigRouter(options.systemSettingsOptions)
  );

  app.use(createMaintenanceMiddleware(options.maintenanceService));

  app.use(
    '/api/v1/admin/system/settings',
    createAdminSystemSettingsRouter(options.systemSettingsOptions)
  );
  app.use(
    '/api/v1/admin/system/features',
    createAdminFeatureFlagsRouter(options.systemSettingsOptions)
  );
  app.use(
    '/api/v1/admin/system/maintenance',
    createAdminMaintenanceRouter(options.systemSettingsOptions)
  );
  app.use(
    '/api/v1/auth',
    createAuthRouter({
      enableRateLimit: options.enableRateLimit,
      ...options.authOptions,
    })
  );
  app.use('/api/v1/voters', createVotersRouter(options.votersOptions));
  app.use(
    '/api/v1/voter',
    createVoterVotingRouter({
      enableRateLimit: options.enableRateLimit,
      ...options.voterVotingOptions,
    })
  );
  app.use(
    '/api/v1/admin/elections',
    createAdminElectionsRouter(options.adminElectionsOptions)
  );
  app.use('/api/v1/admin/candidates', createAdminCandidatesRouter());
  app.use('/api/v1/admin/parties', createAdminPartiesRouter());
  app.use('/api/v1/admin/nominations', createAdminNominationsRouter());
  app.use(
    '/api/v1/admin/counting',
    createAdminCountingRouter(options.adminCountingOptions)
  );
  app.use(
    '/api/v1/admin/analytics',
    createAdminAnalyticsRouter(options.adminAnalyticsOptions)
  );
  app.use(
    '/api/v1/admin/announcements',
    createAdminAnnouncementsRouter(options.adminAnnouncementsOptions)
  );
  app.use(
    '/api/v1/admin/notifications',
    createAdminNotificationsDeliveryRouter(options.adminAnnouncementsOptions)
  );
  app.use(
    '/api/v1/admin/simulation',
    createAdminSimulationRouter(options.adminSimulationOptions)
  );
  app.use(
    '/api/v1/admin',
    createAdminRouter({
      enableRateLimit: options.enableRateLimit,
      ...options.adminOptions,
    })
  );
  app.use(
    '/api/v1/notifications',
    createVoterNotificationsRouter(options.voterNotificationsOptions)
  );
  app.use('/api/v1/results', createPublicResultsRouter(options.publicResultsOptions));
  app.use(
    '/api/v1/public/analytics',
    createPublicAnalyticsRouter(options.publicAnalyticsOptions)
  );
  app.use(
    '/api/v1/public/announcements',
    createPublicAnnouncementsRouter(options.publicAnnouncementsOptions)
  );
  app.use('/api/v1/geography', createGeographyRouter());
  app.use('/api/v1/elections', createElectionsRouter());
  app.use('/api/v1/parties', createPartiesRouter());
  app.use('/api/v1/candidates', createCandidatesRouter());

  app.use(notFoundHandler);
  app.use(centralizedErrorHandler);

  return app;
}
