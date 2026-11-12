import { Router } from 'express';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';
import { createAdminMiddleware } from '../admin/admin.middleware.js';
import { ADMIN_PERMISSIONS } from '../admin/admin.permissions.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsExportService } from './analytics.export.service.js';
import { AnalyticsController } from './analytics.controller.js';

export interface CreateAdminAnalyticsRouterOptions {
  analyticsService?: AnalyticsService;
  exportService?: AnalyticsExportService;
  auditService?: AdminAuditService;
  sessionSecret?: string;
}

export function createAdminAnalyticsRouter(
  options: CreateAdminAnalyticsRouterOptions = {}
): Router {
  const router = Router();

  const sessionSecret =
    options.sessionSecret ??
    process.env.SESSION_SECRET ??
    'dev_session_secret_32_characters_long_min';

  const sessionService = new SessionService(sessionSecret);
  const authService = new AuthService(
    new AuthRepository(),
    new OtpService(),
    sessionService,
    sessionSecret
  );
  const authMiddleware = createAuthMiddleware(authService, sessionService);

  const auditService = options.auditService ?? new AdminAuditService();
  const adminMiddleware = createAdminMiddleware(auditService);

  const analyticsService = options.analyticsService ?? new AnalyticsService();
  const exportService = options.exportService ?? new AnalyticsExportService();
  const controller = new AnalyticsController(analyticsService, exportService);

  // Authentication & baseline admin authorization
  router.use(authMiddleware.authenticate);
  router.use(adminMiddleware.requireAdminAuth);

  // Overview / National
  router.get(
    '/overview',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANALYTICS_READ),
    controller.getNationalOverview
  );
  router.get(
    '/national',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANALYTICS_READ),
    controller.getNationalOverview
  );

  // State-level analytics
  router.get(
    '/states/:stateId',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_STATE
    ),
    controller.getStateOverview
  );

  // Election-specific analytics
  router.get(
    '/elections/:electionId/overview',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_ELECTION
    ),
    controller.getElectionOverview
  );
  router.get(
    '/elections/:electionId',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_ELECTION
    ),
    controller.getElectionOverview
  );
  router.get(
    '/elections/:electionId/constituencies',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_ELECTION
    ),
    controller.getElectionOverview
  );
  router.get(
    '/elections/:electionId/candidates',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_ELECTION
    ),
    controller.getCandidatePartyAnalytics
  );
  router.get(
    '/elections/:electionId/parties',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_ELECTION
    ),
    controller.getCandidatePartyAnalytics
  );
  router.get(
    '/elections/:electionId/schedule',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_ELECTION
    ),
    controller.getElectionOverview
  );

  // Voter participation analytics (strict zero-choice)
  router.get(
    '/participation/trends',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_PARTICIPATION
    ),
    controller.getParticipationAnalytics
  );
  router.get(
    '/participation/elections/:electionId',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_PARTICIPATION
    ),
    controller.getParticipationAnalytics
  );
  router.get(
    '/participation',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_PARTICIPATION
    ),
    controller.getParticipationAnalytics
  );

  // Independent counting analytics
  router.get(
    '/counting/elections/:electionId',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_COUNTING
    ),
    controller.getCountingAnalytics
  );
  router.get(
    '/counting',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_COUNTING
    ),
    controller.getCountingAnalytics
  );

  // Administrative activity analytics
  router.get(
    '/activity/summary',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_AUDIT
    ),
    controller.getAuditAnalytics
  );
  router.get(
    '/activity',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_READ_AUDIT
    ),
    controller.getAuditAnalytics
  );

  // Secure data export
  router.get(
    '/export',
    adminMiddleware.requirePermission(
      ADMIN_PERMISSIONS.ANALYTICS_READ,
      ADMIN_PERMISSIONS.ANALYTICS_EXPORT
    ),
    controller.exportReport
  );

  return router;
}
