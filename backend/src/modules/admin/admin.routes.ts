import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../common/middleware/validate.js';
import { RateLimitProblemError } from '../../common/errors/problemDetails.js';
import { AUTH_CONSTANTS } from '../auth/auth.constants.js';
import { sessionIdParamSchema } from '../auth/auth.schemas.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import {
  activateAdminSchema,
  adminIdParamSchema,
  adminLoginSchema,
  createAdminUserSchema,
  listAdminUsersQuerySchema,
  listAuditLogsQuerySchema,
  suspendAdminSchema,
  updateAdminScopesSchema,
  updateAdminSelfProfileSchema,
  updateAdminUserSchema,
} from './admin.schemas.js';
import { AdminAuditService } from './admin.audit.service.js';
import { ADMIN_PERMISSIONS } from './admin.permissions.js';
import { AdminRepository } from './admin.repository.js';
import { PasswordService } from './password.service.js';
import { AdminService } from './admin.service.js';
import { createAdminMiddleware } from './admin.middleware.js';
import { AdminController } from './admin.controller.js';

export interface CreateAdminRouterOptions {
  adminRepository?: AdminRepository;
  auditService?: AdminAuditService;
  sessionSecret?: string;
  enableRateLimit?: boolean;
  loginRateLimitMax?: number;
}

export function createAdminRouter(options: CreateAdminRouterOptions = {}): Router {
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

  const adminRepository = options.adminRepository ?? new AdminRepository();
  const auditService = options.auditService ?? new AdminAuditService();
  const passwordService = new PasswordService();
  const adminService = new AdminService(
    adminRepository,
    passwordService,
    sessionService,
    auditService
  );

  const adminMiddleware = createAdminMiddleware(auditService);
  const controller = new AdminController(adminService, sessionService);

  const shouldRateLimit =
    typeof options.loginRateLimitMax === 'number' ||
    (options.enableRateLimit !== false && process.env.NODE_ENV !== 'test');

  const adminLoginLimiter = shouldRateLimit
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: options.loginRateLimitMax ?? AUTH_CONSTANTS.ADMIN_LOGIN_RATE_LIMIT_MAX,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler(req, res) {
          const err = new RateLimitProblemError(
            'Too many administrator login attempts. Please wait 15 minutes before trying again.'
          );
          res
            .status(429)
            .type('application/problem+json')
            .json(
              err.toProblemDetails(req.originalUrl, req.requestId ?? 'req_unknown')
            );
        },
      })
    : (_req: any, _res: any, next: any) => next();

  // --------------------------------------------------------------------------
  // 1. Admin Authentication & Session Endpoints
  // --------------------------------------------------------------------------
  router.post(
    '/auth/login',
    adminLoginLimiter,
    validateBody(adminLoginSchema),
    controller.login
  );

  router.post(
    '/auth/logout',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    controller.logout
  );

  router.post(
    '/auth/logout-all',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    controller.logoutAll
  );

  router.get(
    '/auth/me',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    controller.getMe
  );

  router.patch(
    '/auth/me',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    validateBody(updateAdminSelfProfileSchema),
    controller.updateMe
  );

  router.get(
    '/auth/sessions',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    controller.listSessions
  );

  router.delete(
    '/auth/sessions/:sessionId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    validateParams(sessionIdParamSchema),
    controller.revokeSession
  );

  // --------------------------------------------------------------------------
  // 2. Permission Registry & Scope Endpoints
  // --------------------------------------------------------------------------
  router.get(
    '/permissions',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    controller.getPermissions
  );

  router.get(
    '/users/:id/scopes',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    validateParams(adminIdParamSchema),
    controller.getUserScopes
  );

  router.put(
    '/users/:id/scopes',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ADMIN_SCOPES_ASSIGN),
    validateParams(adminIdParamSchema),
    validateBody(updateAdminScopesSchema),
    controller.updateUserScopes
  );

  // --------------------------------------------------------------------------
  // 3. Administrator Account Provisioning & Lifecycle Endpoints
  // --------------------------------------------------------------------------
  router.get(
    '/users',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_READ),
    validateQuery(listAdminUsersQuerySchema),
    controller.listUsers
  );

  router.get(
    '/users/:id',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_READ),
    validateParams(adminIdParamSchema),
    controller.getUserById
  );

  router.post(
    '/users',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_CREATE),
    validateBody(createAdminUserSchema),
    controller.createUser
  );

  router.patch(
    '/users/:id',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_UPDATE),
    validateParams(adminIdParamSchema),
    validateBody(updateAdminUserSchema),
    controller.updateUser
  );

  router.post(
    '/users/:id/suspend',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_SUSPEND),
    validateParams(adminIdParamSchema),
    validateBody(suspendAdminSchema),
    controller.suspendUser
  );

  router.post(
    '/users/:id/activate',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_SUSPEND),
    validateParams(adminIdParamSchema),
    validateBody(activateAdminSchema),
    controller.activateUser
  );

  // --------------------------------------------------------------------------
  // 4. Append-Only Security & Administrative Audit Logs (Read-Only)
  // --------------------------------------------------------------------------
  router.get(
    '/audit-logs',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.AUDIT_READ),
    validateQuery(listAuditLogsQuerySchema),
    controller.listAuditLogs
  );

  // --------------------------------------------------------------------------
  // 5. Reusable Jurisdiction Check Endpoints (State & Election Scope Enforcement)
  // --------------------------------------------------------------------------
  router.get(
    '/jurisdictions/states/:stateId',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.CONSTITUENCIES_READ),
    adminMiddleware.requireJurisdictionScope((req) => ({
      stateId: String(req.params.stateId || '').toUpperCase(),
    })),
    (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          stateId: String(req.params.stateId || '').toUpperCase(),
          authorized: true,
        },
      });
    }
  );

  router.post(
    '/jurisdictions/elections/:electionId/verify-action',
    authMiddleware.authenticate,
    adminMiddleware.requireAdminAuth,
    authMiddleware.requireCsrf,
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_REVIEW),
    adminMiddleware.requireJurisdictionScope((req) => ({
      electionId: String(req.params.electionId || '').toUpperCase(),
      stateId: typeof req.body?.stateId === 'string' ? req.body.stateId : undefined,
    })),
    (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          electionId: String(req.params.electionId || '').toUpperCase(),
          authorized: true,
        },
      });
    }
  );

  return router;
}
