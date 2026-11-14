import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { SimulationController } from './simulation.controller.js';
import { MasterAdminSimulationService } from './simulation.service.js';
import { AdminAuditService } from './admin.audit.service.js';
import { createAdminMiddleware } from './admin.middleware.js';
import { ADMIN_PERMISSIONS } from './admin.permissions.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';

export interface CreateAdminSimulationRouterOptions {
  simulationService?: MasterAdminSimulationService;
  auditService?: AdminAuditService;
  authService?: AuthService;
  sessionService?: SessionService;
  prisma?: PrismaClient;
}

export function createAdminSimulationRouter(
  options: CreateAdminSimulationRouterOptions = {}
): Router {
  const router = Router();

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
  const simulationService =
    options.simulationService ?? new MasterAdminSimulationService(prisma, auditService);

  const controller = new SimulationController(simulationService);

  // Require administrator authentication
  router.use(authMiddleware.authenticate);
  router.use(adminMiddleware.requireAdminAuth);

  // Status check endpoint (requires simulation read/manage permission - SUPER_ADMIN)
  router.get(
    '/status',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SIMULATION_READ),
    controller.getStatus
  );

  // Pan-India simulation execution endpoint (requires SIMULATION_MANAGE - SUPER_ADMIN)
  router.post(
    '/pan-india',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SIMULATION_MANAGE),
    controller.runPanIndia
  );

  // Purge simulated benchmark data endpoint (requires SIMULATION_MANAGE - SUPER_ADMIN)
  router.delete(
    '/pan-india',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SIMULATION_MANAGE),
    controller.purgeData
  );

  router.post(
    '/purge',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.SIMULATION_MANAGE),
    controller.purgeData
  );

  return router;
}
