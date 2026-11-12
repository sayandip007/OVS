import { Router } from 'express';
import {
  paginationQuerySchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../../common/middleware/validate.js';
import { buildPaginationMeta, sendSuccess } from '../../common/utils/response.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';
import { createAdminMiddleware } from '../admin/admin.middleware.js';
import { ADMIN_PERMISSIONS } from '../admin/admin.permissions.js';
import {
  createNominationSchema,
  listAdminNominationsQuerySchema,
  nominationActionNoteSchema,
  nominationIdParamSchema,
  nominationReasonRequiredSchema,
  updateNominationDraftSchema,
} from './nominations.schemas.js';
import { NominationsRepository } from './nominations.repository.js';
import { NominationsService } from './nominations.service.js';

function getCtx(req: AuthenticatedRequest) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

export function createAdminNominationsRouter(
  options: { sessionSecret?: string } = {}
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
  const auditService = new AdminAuditService();
  const adminMiddleware = createAdminMiddleware(auditService);
  const service = new NominationsService(new NominationsRepository(), auditService);

  router.get(
    '/',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_READ),
    validateQuery(listAdminNominationsQuerySchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const query = (req.validated?.query ?? req.query) as any;
        const result = await service.listNominations(req.adminUser!, query);
        sendSuccess(req, res, result.items, {
          pagination: buildPaginationMeta(
            Number(query.page ?? 1),
            Number(query.limit ?? 20),
            result.total
          ),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/:nominationId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_READ),
    validateParams(nominationIdParamSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { nominationId } = (req.validated?.params ?? req.params) as {
          nominationId: string;
        };
        const nom = await service.getNominationById(
          req.adminUser!,
          nominationId,
          getCtx(req)
        );
        sendSuccess(req, res, nom);
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_CREATE),
    validateBody(createNominationSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const created = await service.createNomination(
          req.adminUser!,
          req.body,
          getCtx(req)
        );
        sendSuccess(
          req,
          res,
          created,
          { message: `Draft nomination '${created.id}' created.` },
          201
        );
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    '/:nominationId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_CREATE),
    validateParams(nominationIdParamSchema),
    validateBody(updateNominationDraftSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { nominationId } = (req.validated?.params ?? req.params) as {
          nominationId: string;
        };
        const updated = await service.updateDraft(
          req.adminUser!,
          nominationId,
          req.body,
          getCtx(req)
        );
        sendSuccess(req, res, updated, {
          message: `Draft nomination '${updated.id}' updated.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/:nominationId/submit',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_SUBMIT),
    validateParams(nominationIdParamSchema),
    validateBody(nominationActionNoteSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { nominationId } = (req.validated?.params ?? req.params) as {
          nominationId: string;
        };
        const updated = await service.submitNomination(
          req.adminUser!,
          nominationId,
          req.body,
          getCtx(req)
        );
        sendSuccess(req, res, updated, {
          message: `Nomination '${updated.id}' submitted for review.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/:nominationId/review',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_REVIEW),
    validateParams(nominationIdParamSchema),
    validateBody(nominationActionNoteSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { nominationId } = (req.validated?.params ?? req.params) as {
          nominationId: string;
        };
        const updated = await service.reviewNomination(
          req.adminUser!,
          nominationId,
          req.body,
          getCtx(req)
        );
        sendSuccess(req, res, updated, {
          message: `Nomination '${updated.id}' moved to UNDER_REVIEW.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/:nominationId/approve',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_APPROVE),
    validateParams(nominationIdParamSchema),
    validateBody(nominationActionNoteSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { nominationId } = (req.validated?.params ?? req.params) as {
          nominationId: string;
        };
        const updated = await service.approveNomination(
          req.adminUser!,
          nominationId,
          req.body,
          getCtx(req)
        );
        sendSuccess(req, res, updated, {
          message: `Nomination '${updated.id}' approved.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/:nominationId/reject',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_REJECT),
    validateParams(nominationIdParamSchema),
    validateBody(nominationReasonRequiredSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { nominationId } = (req.validated?.params ?? req.params) as {
          nominationId: string;
        };
        const updated = await service.rejectNomination(
          req.adminUser!,
          nominationId,
          req.body,
          getCtx(req)
        );
        sendSuccess(req, res, updated, {
          message: `Nomination '${updated.id}' rejected.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/:nominationId/withdraw',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_WITHDRAW),
    validateParams(nominationIdParamSchema),
    validateBody(nominationReasonRequiredSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { nominationId } = (req.validated?.params ?? req.params) as {
          nominationId: string;
        };
        const updated = await service.withdrawNomination(
          req.adminUser!,
          nominationId,
          req.body,
          getCtx(req)
        );
        sendSuccess(req, res, updated, {
          message: `Nomination '${updated.id}' withdrawn.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/:nominationId/history',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_HISTORY_READ),
    validateParams(nominationIdParamSchema),
    validateQuery(paginationQuerySchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { nominationId } = (req.validated?.params ?? req.params) as {
          nominationId: string;
        };
        const query = (req.validated?.query ?? req.query) as {
          page: number;
          limit: number;
        };
        const result = await service.getHistory(
          req.adminUser!,
          nominationId,
          query,
          getCtx(req)
        );
        sendSuccess(req, res, result.items, {
          pagination: buildPaginationMeta(
            Number(query.page ?? 1),
            Number(query.limit ?? 20),
            result.total
          ),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
