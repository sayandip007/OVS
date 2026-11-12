import { Router } from 'express';
import {
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
  adminCandidateIdParamSchema,
  createAdminCandidateSchema,
  deactivateCandidateSchema,
  listAdminCandidatesQuerySchema,
  updateAdminCandidateSchema,
} from './candidates.admin.schemas.js';
import { AdminCandidatesService } from './candidates.admin.service.js';

export function createAdminCandidatesRouter(options: { sessionSecret?: string } = {}): Router {
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
  const service = new AdminCandidatesService(undefined, auditService);

  router.get(
    '/',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.CANDIDATES_READ),
    validateQuery(listAdminCandidatesQuerySchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const query = (req.validated?.query ?? req.query) as any;
        const result = await service.listCandidates(req.adminUser!, query);
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
    '/:candidateId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.CANDIDATES_READ),
    validateParams(adminCandidateIdParamSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { candidateId } = (req.validated?.params ?? req.params) as {
          candidateId: string;
        };
        const candidate = await service.getCandidateById(req.adminUser!, candidateId);
        sendSuccess(req, res, candidate);
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
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.CANDIDATES_CREATE),
    validateBody(createAdminCandidateSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const created = await service.createCandidate(req.adminUser!, req.body, {
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
        sendSuccess(req, res, created, { message: `Candidate '${created.id}' created.` }, 201);
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    '/:candidateId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.CANDIDATES_UPDATE),
    validateParams(adminCandidateIdParamSchema),
    validateBody(updateAdminCandidateSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { candidateId } = (req.validated?.params ?? req.params) as {
          candidateId: string;
        };
        const updated = await service.updateCandidate(
          req.adminUser!,
          candidateId,
          req.body,
          {
            requestId: req.requestId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          }
        );
        sendSuccess(req, res, updated, {
          message: `Candidate '${updated.id}' updated.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/:candidateId/deactivate',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.CANDIDATES_DEACTIVATE),
    validateParams(adminCandidateIdParamSchema),
    validateBody(deactivateCandidateSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { candidateId } = (req.validated?.params ?? req.params) as {
          candidateId: string;
        };
        const updated = await service.deactivateCandidate(
          req.adminUser!,
          candidateId,
          req.body.reason,
          {
            requestId: req.requestId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          }
        );
        sendSuccess(req, res, updated, {
          message: `Candidate '${updated.id}' deactivated.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
