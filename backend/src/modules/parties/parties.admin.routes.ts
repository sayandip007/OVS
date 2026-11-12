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
  adminPartyIdParamSchema,
  createAdminPartySchema,
  listAdminPartiesQuerySchema,
  updateAdminPartySchema,
} from './parties.admin.schemas.js';
import { AdminPartiesService } from './parties.admin.service.js';

export function createAdminPartiesRouter(options: { sessionSecret?: string } = {}): Router {
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
  const service = new AdminPartiesService(undefined, auditService);

  router.get(
    '/',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.PARTIES_READ),
    validateQuery(listAdminPartiesQuerySchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const query = (req.validated?.query ?? req.query) as any;
        const result = await service.listParties(query);
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
    '/:partyId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.PARTIES_READ),
    validateParams(adminPartyIdParamSchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { partyId } = (req.validated?.params ?? req.params) as {
          partyId: string;
        };
        const party = await service.getPartyById(partyId);
        sendSuccess(req, res, party);
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
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.PARTIES_CREATE),
    validateBody(createAdminPartySchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const created = await service.createParty(req.adminUser!, req.body, {
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
        sendSuccess(req, res, created, { message: `Party '${created.id}' created.` }, 201);
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    '/:partyId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.PARTIES_UPDATE),
    validateParams(adminPartyIdParamSchema),
    validateBody(updateAdminPartySchema),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { partyId } = (req.validated?.params ?? req.params) as {
          partyId: string;
        };
        const updated = await service.updateParty(req.adminUser!, partyId, req.body, {
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
        sendSuccess(req, res, updated, {
          message: `Party '${updated.id}' updated.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
