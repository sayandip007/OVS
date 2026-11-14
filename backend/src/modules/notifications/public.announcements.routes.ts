import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

export interface CreatePublicAnnouncementsRouterOptions {
  service?: NotificationsService;
  prisma?: PrismaClient;
}

export function createPublicAnnouncementsRouter(
  options: CreatePublicAnnouncementsRouterOptions = {}
): Router {
  const router = Router();

  const prisma = options.prisma ?? new PrismaClient();
  const service = options.service ?? new NotificationsService(prisma);
  const controller = new NotificationsController(service);

  router.get('/', controller.listPublicAnnouncements);
  router.get('/categories', controller.getPublicCategories);
  router.get('/:announcementId', controller.getPublicAnnouncementById);

  return router;
}
