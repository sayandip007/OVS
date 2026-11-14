import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';
import { FeaturesService } from './features.service.js';
import { MaintenanceService } from './maintenance.service.js';
import { HealthDiagnosticsService } from './health.diagnostics.service.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';
import { createAdminMiddleware } from '../admin/admin.middleware.js';
import { ADMIN_PERMISSIONS } from '../admin/admin.permissions.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';

export interface CreateSystemSettingsRouterOptions {
  settingsService?: SettingsService;
  featuresService?: FeaturesService;
  maintenanceService?: MaintenanceService;
  diagnosticsService?: HealthDiagnosticsService;
  auditService?: AdminAuditService;
  authService?: AuthService;
  sessionService?: SessionService;
  prisma?: PrismaClient;
}

function resolveSharedMiddleware(options: CreateSystemSettingsRouterOptions) {
  const sessionSecret =
    process.env.SESSION_SECRET ?? 'dev_session_secret_32_characters_long_min';

  const sessionService =
    options.sessionService ?? new SessionService(sessionSecret);

  const authService =
    options.authService ??
    new AuthService(
      new AuthRepository(),
      new OtpService(),
      sessionService,
      sessionSecret
    );

  const authMiddleware = createAuthMiddleware(authService, sessionService);
  const auditService = options.auditService ?? new AdminAuditService();
  const adminMiddleware = createAdminMiddleware(auditService);

  const prisma = options.prisma ?? new PrismaClient();
  const settingsService = options.settingsService ?? new SettingsService(prisma, auditService);
  const featuresService = options.featuresService ?? new FeaturesService(prisma, auditService);
  const maintenanceService =
    options.maintenanceService ?? new MaintenanceService(prisma, auditService);
  const diagnosticsService =
    options.diagnosticsService ?? new HealthDiagnosticsService(prisma, maintenanceService);

  const controller = new SettingsController(
    settingsService,
    featuresService,
    maintenanceService,
    diagnosticsService
  );

  return {
    authMiddleware,
    adminMiddleware,
    controller,
  };
}

export function createAdminSystemSettingsRouter(
  options: CreateSystemSettingsRouterOptions = {}
): Router {
  const router = Router();
  const { authMiddleware, adminMiddleware, controller } = resolveSharedMiddleware(options);

  router.use(authMiddleware.authenticate);
  router.use(adminMiddleware.requireAdminAuth);

  router.get(
    '/',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SETTINGS_READ),
    controller.listSettings
  );

  router.put(
    '/bulk',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SETTINGS_MANAGE),
    controller.bulkUpdateSettings
  );

  router.get(
    '/:key',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SETTINGS_READ),
    controller.getSetting
  );

  router.get(
    '/:key/history',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SETTINGS_READ),
    controller.getSettingHistory
  );

  router.put(
    '/:key',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SETTINGS_MANAGE),
    controller.updateSetting
  );

  router.post(
    '/:key/rollback',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SETTINGS_ROLLBACK),
    controller.rollbackSetting
  );

  return router;
}

export function createAdminFeatureFlagsRouter(
  options: CreateSystemSettingsRouterOptions = {}
): Router {
  const router = Router();
  const { authMiddleware, adminMiddleware, controller } = resolveSharedMiddleware(options);

  router.use(authMiddleware.authenticate);
  router.use(adminMiddleware.requireAdminAuth);

  router.get(
    '/',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.FEATURES_READ),
    controller.listFeatureFlags
  );

  router.get(
    '/:key',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.FEATURES_READ),
    controller.getFeatureFlag
  );

  router.get(
    '/:key/history',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.FEATURES_READ),
    controller.getFeatureFlagHistory
  );

  router.put(
    '/:key',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.FEATURES_MANAGE),
    controller.updateFeatureFlag
  );

  return router;
}

export function createAdminMaintenanceRouter(
  options: CreateSystemSettingsRouterOptions = {}
): Router {
  const router = Router();
  const { authMiddleware, adminMiddleware, controller } = resolveSharedMiddleware(options);

  router.use(authMiddleware.authenticate);
  router.use(adminMiddleware.requireAdminAuth);

  router.get(
    '/',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SETTINGS_READ),
    controller.getMaintenanceStatus
  );

  router.put(
    '/',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.MAINTENANCE_MANAGE),
    controller.updateMaintenance
  );

  return router;
}

export function createHealthDiagnosticsRouter(
  options: CreateSystemSettingsRouterOptions = {}
): Router {
  const router = Router();
  const { authMiddleware, adminMiddleware, controller } = resolveSharedMiddleware(options);

  router.use(authMiddleware.authenticate);
  router.use(adminMiddleware.requireAdminAuth);

  router.get(
    '/',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.DIAGNOSTICS_READ),
    controller.getDiagnostics
  );

  return router;
}

export function createPublicConfigRouter(
  options: CreateSystemSettingsRouterOptions = {}
): Router {
  const router = Router();
  const { controller } = resolveSharedMiddleware(options);

  router.get('/', controller.getPublicConfig);

  return router;
}
