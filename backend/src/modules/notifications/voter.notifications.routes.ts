import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

export interface CreateVoterNotificationsRouterOptions {
  service?: NotificationsService;
  authService?: AuthService;
  sessionService?: SessionService;
  prisma?: PrismaClient;
}

export function createVoterNotificationsRouter(
  options: CreateVoterNotificationsRouterOptions = {}
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

  const prisma = options.prisma ?? new PrismaClient();
  const service = options.service ?? new NotificationsService(prisma);
  const controller = new NotificationsController(service);

  // Authentication & baseline voter authorization
  router.use(authMiddleware.authenticate);
  router.use(authMiddleware.requireAuthentication);
  router.use(authMiddleware.requireActiveAccount);
  router.use(authMiddleware.requireRole('VOTER'));

  // Voter Notification Endpoints
  router.get('/', controller.getVoterNotifications);
  router.get('/unread-count', controller.getVoterUnreadCount);
  router.get('/preferences', controller.getUserPreferences);
  router.patch('/preferences', controller.updateUserPreferences);
  router.patch('/:notificationId/read', controller.markVoterNotificationRead);
  router.post('/read-all', controller.markAllVoterNotificationsRead);
  router.delete('/:notificationId', controller.deleteVoterNotification);

  return router;
}
