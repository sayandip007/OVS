import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { AdminAuditService } from '../admin/admin.audit.service.js';
import { createAdminMiddleware } from '../admin/admin.middleware.js';
import { ADMIN_PERMISSIONS } from '../admin/admin.permissions.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

export interface CreateAdminAnnouncementsRouterOptions {
  service?: NotificationsService;
  auditService?: AdminAuditService;
  authService?: AuthService;
  sessionService?: SessionService;
  prisma?: PrismaClient;
}

export function createAdminAnnouncementsRouter(
  options: CreateAdminAnnouncementsRouterOptions = {}
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
  const service = options.service ?? new NotificationsService(prisma);
  const controller = new NotificationsController(service);

  // Authentication & baseline admin authorization
  router.use(authMiddleware.authenticate);
  router.use(adminMiddleware.requireAdminAuth);

  // Announcement Lifecycle Endpoints
  router.get(
    '/',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANNOUNCEMENTS_READ),
    controller.listAdminAnnouncements
  );
  router.post(
    '/',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANNOUNCEMENTS_CREATE),
    controller.createAnnouncement
  );
  router.get(
    '/:announcementId',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANNOUNCEMENTS_READ),
    controller.getAdminAnnouncementById
  );
  router.patch(
    '/:announcementId',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANNOUNCEMENTS_UPDATE),
    controller.updateAnnouncement
  );
  router.post(
    '/:announcementId/submit-review',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANNOUNCEMENTS_REVIEW),
    controller.submitReview
  );
  router.post(
    '/:announcementId/approve',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANNOUNCEMENTS_APPROVE),
    controller.approveAnnouncement
  );
  router.post(
    '/:announcementId/schedule',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANNOUNCEMENTS_SCHEDULE),
    controller.scheduleAnnouncement
  );
  router.post(
    '/:announcementId/publish',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANNOUNCEMENTS_PUBLISH),
    controller.publishAnnouncement
  );
  router.post(
    '/:announcementId/archive',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.ANNOUNCEMENTS_ARCHIVE),
    controller.archiveAnnouncement
  );

  return router;
}

export function createAdminNotificationsDeliveryRouter(
  options: CreateAdminAnnouncementsRouterOptions = {}
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
  const service = options.service ?? new NotificationsService(prisma);
  const controller = new NotificationsController(service);

  router.use(authMiddleware.authenticate);
  router.use(adminMiddleware.requireAdminAuth);

  // Delivery Tracking & Retry Endpoints
  router.get(
    '/deliveries',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOTIFICATIONS_READ),
    controller.listDeliveries
  );
  router.post(
    '/deliveries/:deliveryId/retry',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOTIFICATIONS_RETRY),
    controller.retryDelivery
  );
  router.get(
    '/statistics',
    adminMiddleware.requirePermission(ADMIN_PERMISSIONS.NOTIFICATIONS_READ),
    controller.getDeliveryStats
  );

  return router;
}
