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
import {
  adminElectionIdParamSchema,
  archiveAdminElectionSchema,
  cancelAdminElectionSchema,
  createAdminElectionSchema,
  electionHistoryQuerySchema,
  listAdminElectionsQuerySchema,
  transitionElectionStatusSchema,
  updateAdminElectionSchema,
} from './admin.elections.schemas.js';
import { AdminElectionsRepository } from './admin.elections.repository.js';
import { AdminElectionsService } from './admin.elections.service.js';
import { AdminElectionsController } from './admin.elections.controller.js';

export interface CreateAdminElectionsRouterOptions {
  repository?: AdminElectionsRepository;
  auditService?: AdminAuditService;
  sessionSecret?: string;
}

export function createAdminElectionsRouter(
  options: CreateAdminElectionsRouterOptions = {}
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

  const repository = options.repository ?? new AdminElectionsRepository();
  const service = new AdminElectionsService(repository, auditService);
  const controller = new AdminElectionsController(service);

  router.get(
    '/summary',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_READ),
    controller.getSummary
  );

  router.get(
    '/',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_READ),
    validateQuery(listAdminElectionsQuerySchema),
    controller.listElections
  );

  router.get(
    '/:electionId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_READ),
    validateParams(adminElectionIdParamSchema),
    controller.getElectionById
  );

  router.post(
    '/',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CREATE),
    validateBody(createAdminElectionSchema),
    controller.createElection
  );

  router.patch(
    '/:electionId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_UPDATE),
    validateParams(adminElectionIdParamSchema),
    validateBody(updateAdminElectionSchema),
    controller.updateElection
  );

  router.post(
    '/:electionId/transition',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS),
    validateParams(adminElectionIdParamSchema),
    validateBody(transitionElectionStatusSchema),
    controller.transitionStatus
  );

  router.post(
    '/:electionId/cancel',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CANCEL),
    validateParams(adminElectionIdParamSchema),
    validateBody(cancelAdminElectionSchema),
    controller.cancelElection
  );

  router.post(
    '/:electionId/archive',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_ARCHIVE),
    validateParams(adminElectionIdParamSchema),
    validateBody(archiveAdminElectionSchema),
    controller.archiveElection
  );

  router.get(
    '/:electionId/history',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_HISTORY_READ),
    validateParams(adminElectionIdParamSchema),
    validateQuery(electionHistoryQuerySchema),
    controller.getLifecycleHistory
  );

  return router;
}
