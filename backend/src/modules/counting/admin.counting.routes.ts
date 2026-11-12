import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../common/middleware/validate.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';
import { createAdminMiddleware } from '../admin/admin.middleware.js';
import { ADMIN_PERMISSIONS } from '../admin/admin.permissions.js';
import { CountingService } from './counting.service.js';
import { CountingController } from './counting.controller.js';
import {
  createCountingSessionSchema,
  listCountingSessionsQuerySchema,
  sessionIdParamSchema,
  recordCountingRoundSchema,
  recordCandidateTalliesSchema,
  resolveTieSchema,
  correctResultSchema,
} from './counting.schemas.js';

export interface CreateAdminCountingRouterOptions {
  countingService?: CountingService;
  auditService?: AdminAuditService;
  sessionSecret?: string;
}

export function createAdminCountingRouter(
  options: CreateAdminCountingRouterOptions = {}
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

  const countingService =
    options.countingService ?? new CountingService(undefined, auditService);
  const controller = new CountingController(countingService);

  // Authentication & baseline admin authorization
  router.use(authMiddleware.authenticate);
  router.use(adminMiddleware.requireAdminAuth);

  // Sessions CRUD & listing
  router.post(
    '/sessions',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_MANAGE),
    validateBody(createCountingSessionSchema),
    controller.createSession
  );

  router.get(
    '/sessions',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_READ),
    validateQuery(listCountingSessionsQuerySchema),
    controller.listSessions
  );

  router.get(
    '/sessions/:sessionId',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_READ),
    validateParams(sessionIdParamSchema),
    controller.getSessionById
  );

  // Round progression
  router.post(
    '/sessions/:sessionId/rounds',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_TALLY_MANAGE),
    validateParams(sessionIdParamSchema),
    validateBody(recordCountingRoundSchema),
    controller.recordRound
  );

  // Independent tally entry
  router.post(
    '/sessions/:sessionId/tallies',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_TALLY_MANAGE),
    validateParams(sessionIdParamSchema),
    validateBody(recordCandidateTalliesSchema),
    controller.recordTallies
  );

  // Controlled tie resolution
  router.post(
    '/sessions/:sessionId/tie-break',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_TIE_RESOLVE),
    validateParams(sessionIdParamSchema),
    validateBody(resolveTieSchema),
    controller.resolveTie
  );

  // Result review advancement
  router.post(
    '/sessions/:sessionId/review',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_REVIEW),
    validateParams(sessionIdParamSchema),
    controller.submitForReview
  );

  // Publication simulation
  router.post(
    '/sessions/:sessionId/publish',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_PUBLISH),
    validateParams(sessionIdParamSchema),
    controller.publishResult
  );

  // Result correction
  router.post(
    '/sessions/:sessionId/correct',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_MANAGE),
    validateParams(sessionIdParamSchema),
    validateBody(correctResultSchema),
    controller.correctResult
  );

  // Session reset (demonstration testing only)
  router.post(
    '/sessions/:sessionId/reset',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.RESULTS_MANAGE),
    validateParams(sessionIdParamSchema),
    controller.resetSession
  );

  return router;
}
