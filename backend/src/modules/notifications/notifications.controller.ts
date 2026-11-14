import { AnnouncementCategory } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  ForbiddenProblemError,
  UnauthorizedProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import {
  approveAnnouncementSchema,
  archiveAnnouncementSchema,
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
  listDeliveriesQuerySchema,
  listNotificationsQuerySchema,
  publicAnnouncementsQuerySchema,
  scheduleAnnouncementSchema,
  submitReviewSchema,
  updateAnnouncementSchema,
  updatePreferencesSchema,
} from './notifications.schemas.js';
import { NotificationsService } from './notifications.service.js';

export class NotificationsController {
  constructor(private service: NotificationsService) {}

  private setSimulationHeaders(res: Response): void {
    res.setHeader(
      'X-Simulation-Notice',
      'This data represents an educational simulation of election notifications'
    );
    res.setHeader(
      'X-Simulation-Warning',
      'Synthetic data for educational demonstration only'
    );
  }

  // ============================================================================
  // VOTER IN-APP NOTIFICATIONS
  // ============================================================================

  getVoterNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const authReq = req as AuthenticatedRequest;
      const voterProfileId = authReq.user?.voterProfile?.id;

      if (!voterProfileId) {
        throw new UnauthorizedProblemError('Voter authentication required.');
      }

      const query = listNotificationsQuerySchema.parse(req.query);
      const result = await this.service.getVoterNotifications(voterProfileId, query);
      res.json(result);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  getVoterUnreadCount = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const authReq = req as AuthenticatedRequest;
      const voterProfileId = authReq.user?.voterProfile?.id;

      if (!voterProfileId) {
        throw new UnauthorizedProblemError('Voter authentication required.');
      }

      const unreadCount = await this.service.getVoterUnreadCount(voterProfileId);
      res.json({ unreadCount });
    } catch (err) {
      this.handleError(err, next);
    }
  };

  markVoterNotificationRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const authReq = req as AuthenticatedRequest;
      const voterProfileId = authReq.user?.voterProfile?.id;
      const notificationId = String(req.params.notificationId);

      if (!voterProfileId) {
        throw new UnauthorizedProblemError('Voter authentication required.');
      }

      const updated = await this.service.markVoterNotificationRead(
        voterProfileId,
        notificationId
      );
      res.json(updated);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  markAllVoterNotificationsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const authReq = req as AuthenticatedRequest;
      const voterProfileId = authReq.user?.voterProfile?.id;

      if (!voterProfileId) {
        throw new UnauthorizedProblemError('Voter authentication required.');
      }

      const result = await this.service.markAllVoterNotificationsRead(voterProfileId);
      res.json(result);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  deleteVoterNotification = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const authReq = req as AuthenticatedRequest;
      const voterProfileId = authReq.user?.voterProfile?.id;
      const notificationId = String(req.params.notificationId);

      if (!voterProfileId) {
        throw new UnauthorizedProblemError('Voter authentication required.');
      }

      const result = await this.service.deleteVoterNotification(
        voterProfileId,
        notificationId
      );
      res.json(result);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  // ============================================================================
  // NOTIFICATION PREFERENCES
  // ============================================================================

  getUserPreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        throw new UnauthorizedProblemError('Authentication required.');
      }

      const preferences = await this.service.getUserPreferences(userId);
      res.json(preferences);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  updateUserPreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        throw new UnauthorizedProblemError('Authentication required.');
      }

      const body = updatePreferencesSchema.parse(req.body);
      const updated = await this.service.updateUserPreferences(userId, body);
      res.json(updated);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  // ============================================================================
  // ADMINISTRATIVE ANNOUNCEMENTS
  // ============================================================================

  createAnnouncement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const body = createAnnouncementSchema.parse(req.body);

      const announcement = await this.service.createAnnouncement(
        adminReq.adminUser,
        body
      );
      res.status(201).json(announcement);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  updateAnnouncement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const announcementId = String(req.params.announcementId);
      const body = updateAnnouncementSchema.parse(req.body);

      const updated = await this.service.updateAnnouncement(
        adminReq.adminUser,
        announcementId,
        body
      );
      res.json(updated);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  submitReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const announcementId = String(req.params.announcementId);
      const body = submitReviewSchema.parse(req.body);

      const updated = await this.service.submitAnnouncementForReview(
        adminReq.adminUser,
        announcementId,
        body.notes
      );
      res.json(updated);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  approveAnnouncement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const announcementId = String(req.params.announcementId);
      const body = approveAnnouncementSchema.parse(req.body);

      const updated = await this.service.approveAnnouncement(
        adminReq.adminUser,
        announcementId,
        body.notes
      );
      res.json(updated);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  scheduleAnnouncement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const announcementId = String(req.params.announcementId);
      const body = scheduleAnnouncementSchema.parse(req.body);

      const updated = await this.service.scheduleAnnouncement(
        adminReq.adminUser,
        announcementId,
        body.scheduledAt
      );
      res.json(updated);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  publishAnnouncement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const announcementId = String(req.params.announcementId);

      const updated = await this.service.publishAnnouncement(
        adminReq.adminUser,
        announcementId
      );
      res.json(updated);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  archiveAnnouncement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const announcementId = String(req.params.announcementId);
      const body = archiveAnnouncementSchema.parse(req.body);

      const updated = await this.service.archiveAnnouncement(
        adminReq.adminUser,
        announcementId,
        body.reason
      );
      res.json(updated);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  listAdminAnnouncements = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const query = listAnnouncementsQuerySchema.parse(req.query);

      const result = await this.service.listAdminAnnouncements(
        adminReq.adminUser,
        query
      );
      res.json(result);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  getAdminAnnouncementById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const announcementId = String(req.params.announcementId);

      const announcement = await this.service.getAnnouncementById(
        adminReq.adminUser,
        announcementId
      );
      res.json(announcement);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  // ============================================================================
  // ADMINISTRATIVE DELIVERY MANAGEMENT
  // ============================================================================

  listDeliveries = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const query = listDeliveriesQuerySchema.parse(req.query);

      const result = await this.service.listDeliveries(adminReq.adminUser, query);
      res.json(result);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  retryDelivery = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }
      const deliveryId = String(req.params.deliveryId);

      const retried = await this.service.manualRetryDelivery(
        adminReq.adminUser,
        deliveryId
      );
      res.json(retried);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  getDeliveryStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const adminReq = req as AuthenticatedRequest;
      if (!adminReq.adminUser) {
        throw new ForbiddenProblemError('Admin authentication required.');
      }

      const stats = await this.service.getDeliveryStatistics(adminReq.adminUser);
      res.json(stats);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  // ============================================================================
  // PUBLIC ANNOUNCEMENTS
  // ============================================================================

  listPublicAnnouncements = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const query = publicAnnouncementsQuerySchema.parse(req.query);

      const result = await this.service.listPublicAnnouncements(query);
      res.json(result);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  getPublicAnnouncementById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      const announcementId = String(req.params.announcementId);

      const announcement = await this.service.getPublicAnnouncementById(
        announcementId
      );
      res.json(announcement);
    } catch (err) {
      this.handleError(err, next);
    }
  };

  getPublicCategories = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.setSimulationHeaders(res);
      res.json({
        categories: Object.values(AnnouncementCategory),
      });
    } catch (err) {
      this.handleError(err, next);
    }
  };

  // ============================================================================
  // ERROR TRANSLATION
  // ============================================================================

  private handleError(err: unknown, next: NextFunction): void {
    if (err instanceof ZodError) {
      next(
        new ValidationProblemError(
          'Request validation failed.',
          err.errors.map((e) => ({
            name: e.path.join('.'),
            reason: e.message,
          }))
        )
      );
      return;
    }
    next(err);
  }
}
