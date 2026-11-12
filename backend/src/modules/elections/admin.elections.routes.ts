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
import {
  assignSingleConstituencySchema,
  bulkConstituencySchema,
  configReturnSchema,
  configReviewActionSchema,
  electionConstituencyIdParamSchema,
  electionMilestoneParamSchema,
  listElectionConstituenciesAdminQuerySchema,
  patchMilestoneSchema,
  putScheduleSchema,
} from './election.config.schemas.js';
import { ElectionConfigService } from './election.config.service.js';
import { ElectionConfigController } from './election.config.controller.js';
import { VotingService } from '../voting/voting.service.js';
import { VotingController } from '../voting/voting.controller.js';
import { prisma as defaultPrisma } from '../../config/database.js';

export interface CreateAdminElectionsRouterOptions {
  repository?: AdminElectionsRepository;
  auditService?: AdminAuditService;
  configService?: ElectionConfigService;
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

  const configService =
    options.configService ?? new ElectionConfigService(defaultPrisma, auditService);
  const configController = new ElectionConfigController(configService);
  const votingController = new VotingController(new VotingService(defaultPrisma));

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

  // ---------------------------------------------------------------------------
  // Phase 8.7: Election Constituency Assignment
  // ---------------------------------------------------------------------------
  router.get(
    '/:electionId/constituencies',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONSTITUENCIES_READ),
    validateParams(adminElectionIdParamSchema),
    validateQuery(listElectionConstituenciesAdminQuerySchema),
    configController.listAssignedConstituencies
  );

  router.get(
    '/:electionId/available-constituencies',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONSTITUENCIES_READ),
    validateParams(adminElectionIdParamSchema),
    validateQuery(listElectionConstituenciesAdminQuerySchema),
    configController.listAvailableConstituencies
  );

  router.post(
    '/:electionId/constituencies',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONSTITUENCIES_MANAGE),
    validateParams(adminElectionIdParamSchema),
    validateBody(assignSingleConstituencySchema),
    configController.assignSingleConstituency
  );

  router.post(
    '/:electionId/constituencies/preview',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONSTITUENCIES_BULK_MANAGE),
    validateParams(adminElectionIdParamSchema),
    validateBody(bulkConstituencySchema),
    configController.previewBulkAssignment
  );

  router.post(
    '/:electionId/constituencies/bulk',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONSTITUENCIES_BULK_MANAGE),
    validateParams(adminElectionIdParamSchema),
    validateBody(bulkConstituencySchema),
    configController.bulkAssignConstituencies
  );

  router.delete(
    '/:electionId/constituencies/:constituencyId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONSTITUENCIES_MANAGE),
    validateParams(electionConstituencyIdParamSchema),
    configController.removeConstituency
  );

  router.get(
    '/:electionId/constituencies/history',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONSTITUENCIES_READ),
    validateParams(adminElectionIdParamSchema),
    validateQuery(electionHistoryQuerySchema),
    configController.listConstituencyHistory
  );

  // ---------------------------------------------------------------------------
  // Phase 8.7: Election Schedule Configuration & Validation
  // ---------------------------------------------------------------------------
  router.get(
    '/:electionId/schedule',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_SCHEDULE_READ),
    validateParams(adminElectionIdParamSchema),
    configController.getSchedule
  );

  router.put(
    '/:electionId/schedule',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_SCHEDULE_MANAGE),
    validateParams(adminElectionIdParamSchema),
    validateBody(putScheduleSchema),
    configController.upsertSchedule
  );

  router.patch(
    '/:electionId/schedule/:milestoneId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_SCHEDULE_MANAGE),
    validateParams(electionMilestoneParamSchema),
    validateBody(patchMilestoneSchema),
    configController.updateMilestone
  );

  router.post(
    '/:electionId/schedule/validate',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONFIG_VALIDATE),
    validateParams(adminElectionIdParamSchema),
    configController.validateSchedule
  );

  router.get(
    '/:electionId/schedule/history',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_SCHEDULE_READ),
    validateParams(adminElectionIdParamSchema),
    validateQuery(electionHistoryQuerySchema),
    configController.getScheduleHistory
  );

  // ---------------------------------------------------------------------------
  // Phase 8.7: Election Configuration Readiness & Review Workflow
  // ---------------------------------------------------------------------------
  router.get(
    '/:electionId/configuration/validation',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONFIG_VALIDATE),
    validateParams(adminElectionIdParamSchema),
    configController.validateConfigurationReadiness
  );

  router.post(
    '/:electionId/configuration/submit',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONFIG_SUBMIT),
    validateParams(adminElectionIdParamSchema),
    validateBody(configReviewActionSchema),
    configController.submitConfigurationForReview
  );

  router.post(
    '/:electionId/configuration/review',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONFIG_REVIEW),
    validateParams(adminElectionIdParamSchema),
    validateBody(configReviewActionSchema),
    configController.reviewConfiguration
  );

  router.post(
    '/:electionId/configuration/approve',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONFIG_APPROVE),
    validateParams(adminElectionIdParamSchema),
    validateBody(configReviewActionSchema),
    configController.approveConfiguration
  );

  router.post(
    '/:electionId/configuration/return',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ELECTIONS_CONFIG_REVIEW),
    validateParams(adminElectionIdParamSchema),
    validateBody(configReturnSchema),
    configController.returnConfigurationForCorrection
  );

  // ---------------------------------------------------------------------------
  // Phase 8.8: Administrative Participation Aggregate Reporting (Zero Candidate Data)
  // ---------------------------------------------------------------------------
  router.get(
    '/:electionId/participation/summary',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.PARTICIPATION_AGGREGATE_READ),
    validateParams(adminElectionIdParamSchema),
    votingController.getAdminParticipationSummary
  );

  router.get(
    '/:electionId/participation/constituencies',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.PARTICIPATION_AGGREGATE_READ),
    validateParams(adminElectionIdParamSchema),
    votingController.getAdminParticipationByConstituency
  );

  router.get(
    '/:electionId/participation/timeline',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.PARTICIPATION_AGGREGATE_READ),
    validateParams(adminElectionIdParamSchema),
    votingController.getAdminParticipationTimeline
  );

  return router;
}
