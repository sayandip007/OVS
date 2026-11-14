import {
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementStatus,
  ConstituencyType,
  NotificationDeliveryStatus,
  NotificationType,
  PrismaClient,
} from '@prisma/client';
import type { SafeAdminUser } from '../auth/auth.types.js';
import {
  AppProblemError,
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import { getEmailProvider } from './email.provider.js';
import { NotificationTemplateService } from './notifications.template.service.js';
import type {
  AnnouncementDTO,
  DeliveryLogDTO,
  ElectionEventPayload,
  NotificationDeliveryStatisticsDTO,
  NotificationPreferenceDTO,
  PublicAnnouncementDTO,
  UpdateNotificationPreferenceDTO,
  VoterNotificationDTO,
} from './notifications.types.js';

export class NotificationsService {
  constructor(private prisma: PrismaClient) {}

  // ============================================================================
  // 1. IN-APP VOTER NOTIFICATIONS (Voter In-App Centre)
  // ============================================================================

  async getVoterNotifications(
    voterProfileId: string,
    query: { isRead?: boolean; type?: NotificationType; page: number; limit: number }
  ): Promise<{ data: VoterNotificationDTO[]; total: number; unreadCount: number }> {
    const where: { voterId: string; isRead?: boolean; type?: NotificationType } = {
      voterId: voterProfileId,
    };
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }
    if (query.type) {
      where.type = query.type;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.voterNotification.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.voterNotification.count({ where }),
      this.prisma.voterNotification.count({
        where: { voterId: voterProfileId, isRead: false },
      }),
    ]);

    return {
      data: items.map((n) => ({
        id: n.id,
        voterId: n.voterId,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.timestamp.toISOString(),
        isRead: n.isRead,
        readAt: n.readAt?.toISOString() || null,
      })),
      total,
      unreadCount,
    };
  }

  async getVoterUnreadCount(voterProfileId: string): Promise<number> {
    return this.prisma.voterNotification.count({
      where: { voterId: voterProfileId, isRead: false },
    });
  }

  async markVoterNotificationRead(
    voterProfileId: string,
    notificationId: string
  ): Promise<VoterNotificationDTO> {
    const existing = await this.prisma.voterNotification.findUnique({
      where: { id: notificationId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Notification not found.');
    }

    // Strict IDOR verification
    if (existing.voterId !== voterProfileId) {
      throw new ForbiddenProblemError('Access denied: You do not own this notification.');
    }

    const updated = await this.prisma.voterNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      id: updated.id,
      voterId: updated.voterId,
      type: updated.type,
      title: updated.title,
      message: updated.message,
      timestamp: updated.timestamp.toISOString(),
      isRead: updated.isRead,
      readAt: updated.readAt?.toISOString() || null,
    };
  }

  async markAllVoterNotificationsRead(voterProfileId: string): Promise<{ count: number }> {
    const result = await this.prisma.voterNotification.updateMany({
      where: {
        voterId: voterProfileId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  async deleteVoterNotification(
    voterProfileId: string,
    notificationId: string
  ): Promise<{ success: boolean }> {
    const existing = await this.prisma.voterNotification.findUnique({
      where: { id: notificationId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Notification not found.');
    }

    // Strict IDOR verification
    if (existing.voterId !== voterProfileId) {
      throw new ForbiddenProblemError('Access denied: You do not own this notification.');
    }

    await this.prisma.voterNotification.delete({
      where: { id: notificationId },
    });

    return { success: true };
  }

  // ============================================================================
  // 2. NOTIFICATION PREFERENCES
  // ============================================================================

  async getUserPreferences(userId: string): Promise<NotificationPreferenceDTO> {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          userId,
          emailEnabled: false,
          inAppEnabled: true,
          electionReminders: true,
          generalAnnouncements: true,
          adminAlerts: true,
        },
      });
    }

    return {
      userId: pref.userId,
      emailEnabled: pref.emailEnabled,
      inAppEnabled: pref.inAppEnabled,
      electionReminders: pref.electionReminders,
      generalAnnouncements: pref.generalAnnouncements,
      adminAlerts: pref.adminAlerts,
    };
  }

  async updateUserPreferences(
    userId: string,
    data: UpdateNotificationPreferenceDTO
  ): Promise<NotificationPreferenceDTO> {
    const pref = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        emailEnabled: data.emailEnabled ?? false,
        inAppEnabled: data.inAppEnabled ?? true,
        electionReminders: data.electionReminders ?? true,
        generalAnnouncements: data.generalAnnouncements ?? true,
        adminAlerts: data.adminAlerts ?? true,
      },
      update: {
        ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
        ...(data.inAppEnabled !== undefined && { inAppEnabled: data.inAppEnabled }),
        ...(data.electionReminders !== undefined && { electionReminders: data.electionReminders }),
        ...(data.generalAnnouncements !== undefined && {
          generalAnnouncements: data.generalAnnouncements,
        }),
        ...(data.adminAlerts !== undefined && { adminAlerts: data.adminAlerts }),
      },
    });

    return {
      userId: pref.userId,
      emailEnabled: pref.emailEnabled,
      inAppEnabled: pref.inAppEnabled,
      electionReminders: pref.electionReminders,
      generalAnnouncements: pref.generalAnnouncements,
      adminAlerts: pref.adminAlerts,
    };
  }

  // ============================================================================
  // 3. ADMINISTRATIVE ANNOUNCEMENT MANAGEMENT & LIFECYCLE
  // ============================================================================

  async createAnnouncement(
    admin: SafeAdminUser,
    data: {
      id?: string;
      title: string;
      summary: string;
      message: string;
      category?: AnnouncementCategory;
      targetAudience?: AnnouncementAudience;
      targetStateId?: string | null;
      targetElectionId?: string | null;
      targetConstituencyType?: ConstituencyType | null;
      targetParliamentaryConstituencyId?: string | null;
      targetAssemblyConstituencyId?: string | null;
      publicationDate: string;
      expiryDate: string;
      scheduledAt?: string | null;
    }
  ): Promise<AnnouncementDTO> {
    this.assertAnnouncementJurisdiction(admin, data);

    const announcementId =
      data.id || `ANN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const created = await this.prisma.announcement.create({
      data: {
        id: announcementId,
        title: data.title,
        summary: data.summary,
        message: data.message,
        category: data.category || AnnouncementCategory.GENERAL_INFO,
        targetAudience: data.targetAudience || AnnouncementAudience.ALL_VOTERS,
        targetStateId: data.targetStateId || null,
        targetElectionId: data.targetElectionId || null,
        targetConstituencyType: data.targetConstituencyType || null,
        targetParliamentaryConstituencyId: data.targetParliamentaryConstituencyId || null,
        targetAssemblyConstituencyId: data.targetAssemblyConstituencyId || null,
        publicationDate: new Date(data.publicationDate),
        expiryDate: new Date(data.expiryDate),
        status: AnnouncementStatus.DRAFT,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        createdByAdminId: admin.id,
      },
    });

    return this.mapAnnouncementToDTO(created);
  }

  async updateAnnouncement(
    admin: SafeAdminUser,
    announcementId: string,
    data: {
      title?: string;
      summary?: string;
      message?: string;
      category?: AnnouncementCategory;
      targetAudience?: AnnouncementAudience;
      targetStateId?: string | null;
      targetElectionId?: string | null;
      targetConstituencyType?: ConstituencyType | null;
      targetParliamentaryConstituencyId?: string | null;
      targetAssemblyConstituencyId?: string | null;
      publicationDate?: string;
      expiryDate?: string;
      scheduledAt?: string | null;
    }
  ): Promise<AnnouncementDTO> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Announcement not found.');
    }

    this.assertAnnouncementJurisdiction(admin, existing);

    // Only DRAFT or UNDER_REVIEW announcements can be updated
    if (
      existing.status !== AnnouncementStatus.DRAFT &&
      existing.status !== AnnouncementStatus.UNDER_REVIEW
    ) {
      throw new ConflictProblemError(
        `Cannot edit announcement in ${existing.status} status. Only DRAFT and UNDER_REVIEW announcements can be modified.`
      );
    }

    const updated = await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.summary && { summary: data.summary }),
        ...(data.message && { message: data.message }),
        ...(data.category && { category: data.category }),
        ...(data.targetAudience && { targetAudience: data.targetAudience }),
        ...(data.targetStateId !== undefined && { targetStateId: data.targetStateId }),
        ...(data.targetElectionId !== undefined && { targetElectionId: data.targetElectionId }),
        ...(data.targetConstituencyType !== undefined && {
          targetConstituencyType: data.targetConstituencyType,
        }),
        ...(data.targetParliamentaryConstituencyId !== undefined && {
          targetParliamentaryConstituencyId: data.targetParliamentaryConstituencyId,
        }),
        ...(data.targetAssemblyConstituencyId !== undefined && {
          targetAssemblyConstituencyId: data.targetAssemblyConstituencyId,
        }),
        ...(data.publicationDate && { publicationDate: new Date(data.publicationDate) }),
        ...(data.expiryDate && { expiryDate: new Date(data.expiryDate) }),
        ...(data.scheduledAt !== undefined && {
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        }),
      },
    });

    return this.mapAnnouncementToDTO(updated);
  }

  async submitAnnouncementForReview(
    admin: SafeAdminUser,
    announcementId: string,
    notes?: string
  ): Promise<AnnouncementDTO> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Announcement not found.');
    }

    this.assertAnnouncementJurisdiction(admin, existing);

    if (existing.status !== AnnouncementStatus.DRAFT) {
      throw new ConflictProblemError(
        `Announcement must be in DRAFT state to submit for review. Current status: ${existing.status}`
      );
    }

    const updated = await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: AnnouncementStatus.UNDER_REVIEW,
        reviewNotes: notes || null,
      },
    });

    return this.mapAnnouncementToDTO(updated);
  }

  async approveAnnouncement(
    admin: SafeAdminUser,
    announcementId: string,
    notes?: string
  ): Promise<AnnouncementDTO> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Announcement not found.');
    }

    this.assertAnnouncementJurisdiction(admin, existing);

    if (
      existing.status !== AnnouncementStatus.UNDER_REVIEW &&
      existing.status !== AnnouncementStatus.DRAFT
    ) {
      throw new ConflictProblemError(
        `Announcement must be in UNDER_REVIEW or DRAFT state to approve. Current status: ${existing.status}`
      );
    }

    const updated = await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: AnnouncementStatus.APPROVED,
        approvedByAdminId: admin.id,
        reviewNotes: notes || existing.reviewNotes,
      },
    });

    return this.mapAnnouncementToDTO(updated);
  }

  async scheduleAnnouncement(
    admin: SafeAdminUser,
    announcementId: string,
    scheduledAt: string
  ): Promise<AnnouncementDTO> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Announcement not found.');
    }

    this.assertAnnouncementJurisdiction(admin, existing);

    if (existing.status !== AnnouncementStatus.APPROVED) {
      throw new ConflictProblemError(
        `Announcement must be APPROVED before scheduling. Current status: ${existing.status}`
      );
    }

    const scheduleDate = new Date(scheduledAt);
    if (isNaN(scheduleDate.getTime())) {
      throw new ValidationProblemError('Invalid scheduledAt timestamp.');
    }

    const updated = await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: AnnouncementStatus.SCHEDULED,
        scheduledAt: scheduleDate,
      },
    });

    return this.mapAnnouncementToDTO(updated);
  }

  async publishAnnouncement(
    admin: SafeAdminUser,
    announcementId: string
  ): Promise<AnnouncementDTO> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Announcement not found.');
    }

    this.assertAnnouncementJurisdiction(admin, existing);

    if (
      existing.status !== AnnouncementStatus.APPROVED &&
      existing.status !== AnnouncementStatus.SCHEDULED &&
      existing.status !== AnnouncementStatus.DRAFT
    ) {
      throw new ConflictProblemError(
        `Announcement cannot be published from status: ${existing.status}`
      );
    }

    const updated = await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: AnnouncementStatus.PUBLISHED,
        publicationDate: new Date(),
      },
    });

    // Fan-out in-app notifications and queue deliveries to target audience
    await this.fanOutAnnouncement(updated);

    return this.mapAnnouncementToDTO(updated);
  }

  async archiveAnnouncement(
    admin: SafeAdminUser,
    announcementId: string,
    reason?: string
  ): Promise<AnnouncementDTO> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Announcement not found.');
    }

    this.assertAnnouncementJurisdiction(admin, existing);

    const updated = await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: AnnouncementStatus.ARCHIVED,
        reviewNotes: reason ? `Archived: ${reason}` : existing.reviewNotes,
      },
    });

    return this.mapAnnouncementToDTO(updated);
  }

  async listAdminAnnouncements(
    admin: SafeAdminUser,
    query: {
      status?: AnnouncementStatus;
      category?: AnnouncementCategory;
      targetAudience?: AnnouncementAudience;
      stateId?: string;
      electionId?: string;
      search?: string;
      page: number;
      limit: number;
    }
  ): Promise<{ data: AnnouncementDTO[]; total: number }> {
    const where: Record<string, unknown> = {};

    // Jurisdiction enforcement
    if (admin.role === 'STATE_ADMIN' && admin.assignedStateId) {
      where.OR = [
        { targetAudience: AnnouncementAudience.ALL_VOTERS },
        { targetStateId: admin.assignedStateId },
      ];
    }

    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.targetAudience) where.targetAudience = query.targetAudience;
    if (query.stateId) where.targetStateId = query.stateId;
    if (query.electionId) where.targetElectionId = query.electionId;

    if (query.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { summary: { contains: query.search, mode: 'insensitive' } },
            { message: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      data: items.map((a) => this.mapAnnouncementToDTO(a)),
      total,
    };
  }

  async getAnnouncementById(
    admin: SafeAdminUser,
    announcementId: string
  ): Promise<AnnouncementDTO> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Announcement not found.');
    }

    this.assertAnnouncementJurisdiction(admin, existing);

    return this.mapAnnouncementToDTO(existing);
  }

  // ============================================================================
  // 4. PUBLIC ANNOUNCEMENT APIS
  // ============================================================================

  async listPublicAnnouncements(query: {
    category?: AnnouncementCategory;
    stateId?: string;
    electionId?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ data: PublicAnnouncementDTO[]; total: number }> {
    const now = new Date();
    const where: Record<string, unknown> = {
      status: AnnouncementStatus.PUBLISHED,
      publicationDate: { lte: now },
      expiryDate: { gte: now },
    };

    if (query.category) where.category = query.category;
    if (query.stateId) where.targetStateId = query.stateId;
    if (query.electionId) where.targetElectionId = query.electionId;

    if (query.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { summary: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: { publicationDate: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      data: items.map((a) => ({
        id: a.id,
        title: a.title,
        summary: a.summary,
        message: a.message,
        category: a.category,
        publicationDate: a.publicationDate.toISOString().slice(0, 10),
        expiryDate: a.expiryDate.toISOString().slice(0, 10),
        targetAudience: a.targetAudience,
        targetStateId: a.targetStateId,
        targetElectionId: a.targetElectionId,
      })),
      total,
    };
  }

  async getPublicAnnouncementById(announcementId: string): Promise<PublicAnnouncementDTO> {
    const now = new Date();
    const existing = await this.prisma.announcement.findFirst({
      where: {
        id: announcementId,
        status: AnnouncementStatus.PUBLISHED,
        publicationDate: { lte: now },
        expiryDate: { gte: now },
      },
    });

    if (!existing) {
      throw new NotFoundProblemError('Published announcement not found or expired.');
    }

    return {
      id: existing.id,
      title: existing.title,
      summary: existing.summary,
      message: existing.message,
      category: existing.category,
      publicationDate: existing.publicationDate.toISOString().slice(0, 10),
      expiryDate: existing.expiryDate.toISOString().slice(0, 10),
      targetAudience: existing.targetAudience,
      targetStateId: existing.targetStateId,
      targetElectionId: existing.targetElectionId,
    };
  }

  // ============================================================================
  // 5. EVENT-DRIVEN NOTIFICATION DISPATCHER & FAN-OUT
  // ============================================================================

  async handleElectionEvent(payload: ElectionEventPayload): Promise<void> {
    const voters = await this.getTargetVotersForEvent(payload);

    for (const voter of voters) {
      const pref = voter.user?.notificationPreference;
      if (pref && !pref.inAppEnabled && !pref.electionReminders) {
        continue;
      }

      const notifId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const title = this.buildEventNotificationTitle(payload);
      const message = this.buildEventNotificationMessage(payload);

      // Create in-app notification
      await this.prisma.voterNotification.create({
        data: {
          id: notifId,
          voterId: voter.id,
          type: this.mapEventTypeToNotificationType(payload.eventType),
          title,
          message,
          timestamp: new Date(),
        },
      });

      // Queue email delivery if email is enabled and verified
      if (pref?.emailEnabled && voter.email && voter.isVerified) {
        await this.prisma.notificationDelivery.create({
          data: {
            notificationId: notifId,
            recipientUserId: voter.userId,
            recipientEmail: voter.email,
            channel: 'EMAIL',
            status: NotificationDeliveryStatus.PENDING,
          },
        });
      }
    }
  }

  private async fanOutAnnouncement(announcement: {
    id: string;
    title: string;
    summary: string;
    message: string;
    targetAudience: AnnouncementAudience;
    targetStateId?: string | null;
    targetElectionId?: string | null;
  }): Promise<void> {
    const where: Record<string, unknown> = {};
    if (
      announcement.targetAudience === AnnouncementAudience.SPECIFIC_STATE &&
      announcement.targetStateId
    ) {
      where.stateId = announcement.targetStateId;
    }

    const voters = await this.prisma.voterProfile.findMany({
      where,
      take: 100, // Safe batch limit for demo simulation
      include: {
        user: {
          include: { notificationPreference: true },
        },
      },
    });

    for (const voter of voters) {
      const pref = voter.user?.notificationPreference;
      if (pref && !pref.inAppEnabled && !pref.generalAnnouncements) {
        continue;
      }

      const notifId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      await this.prisma.voterNotification.create({
        data: {
          id: notifId,
          voterId: voter.id,
          type: NotificationType.GENERAL_ANNOUNCEMENT,
          title: announcement.title,
          message: announcement.summary,
          timestamp: new Date(),
        },
      });

      if (pref?.emailEnabled && voter.email && voter.isVerified) {
        await this.prisma.notificationDelivery.create({
          data: {
            notificationId: notifId,
            announcementId: announcement.id,
            recipientUserId: voter.userId,
            recipientEmail: voter.email,
            channel: 'EMAIL',
            status: NotificationDeliveryStatus.PENDING,
          },
        });
      }
    }
  }

  // ============================================================================
  // 6. OUTBOX QUEUE & RETRY PROCESSING
  // ============================================================================

  async processPendingDeliveries(): Promise<{ processedCount: number; failureCount: number }> {
    const now = new Date();
    const emailProvider = getEmailProvider();

    const pendingDeliveries = await this.prisma.notificationDelivery.findMany({
      where: {
        OR: [
          { status: NotificationDeliveryStatus.PENDING },
          {
            status: NotificationDeliveryStatus.FAILED,
            attempts: { lt: 3 },
            nextRetryAt: { lte: now },
          },
        ],
      },
      take: 20,
    });

    let processedCount = 0;
    let failureCount = 0;

    for (const delivery of pendingDeliveries) {
      try {
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.PROCESSING,
            lastAttemptAt: new Date(),
            attempts: { increment: 1 },
          },
        });

        if (delivery.channel === 'EMAIL' && delivery.recipientEmail) {
          const rendered = NotificationTemplateService.renderGeneralAnnouncement(
            'Official Simulated Advisory',
            'Simulated Electoral Notice',
            'This message was automatically generated as part of the OVS simulated election exercise.'
          );

          const result = await emailProvider.sendEmail({
            to: delivery.recipientEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          });

          if (result.success) {
            await this.prisma.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: NotificationDeliveryStatus.DELIVERED,
                deliveredAt: new Date(),
                failureReason: null,
              },
            });
            processedCount++;
          } else {
            throw new Error(result.error || 'Provider rejected email transmission');
          }
        }
      } catch (err: unknown) {
        failureCount++;
        const attempts = delivery.attempts + 1;
        const maxAttempts = delivery.maxAttempts;
        const nextRetryAt =
          attempts < maxAttempts
            ? new Date(Date.now() + Math.pow(2, attempts) * 60000) // Exponential backoff (2^n * 1 min)
            : null;

        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.FAILED,
            failureReason: err instanceof Error ? err.message : 'Unknown delivery error',
            nextRetryAt,
          },
        });
      }
    }

    return { processedCount, failureCount };
  }

  async manualRetryDelivery(admin: SafeAdminUser, deliveryId: string): Promise<DeliveryLogDTO> {
    const existing = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!existing) {
      throw new NotFoundProblemError('Delivery record not found.');
    }

    const updated = await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.PENDING,
        attempts: 0,
        nextRetryAt: new Date(),
        failureReason: null,
      },
    });

    return this.mapDeliveryToDTO(updated);
  }

  async listDeliveries(
    admin: SafeAdminUser,
    query: {
      status?: NotificationDeliveryStatus;
      channel?: string;
      page: number;
      limit: number;
    }
  ): Promise<{ data: DeliveryLogDTO[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.channel) where.channel = query.channel;

    const [items, total] = await Promise.all([
      this.prisma.notificationDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);

    return {
      data: items.map((d) => this.mapDeliveryToDTO(d)),
      total,
    };
  }

  async getDeliveryStatistics(admin: SafeAdminUser): Promise<NotificationDeliveryStatisticsDTO> {
    const [pending, processing, sent, delivered, failed, cancelled, inAppCount, emailCount] =
      await Promise.all([
        this.prisma.notificationDelivery.count({
          where: { status: NotificationDeliveryStatus.PENDING },
        }),
        this.prisma.notificationDelivery.count({
          where: { status: NotificationDeliveryStatus.PROCESSING },
        }),
        this.prisma.notificationDelivery.count({
          where: { status: NotificationDeliveryStatus.SENT },
        }),
        this.prisma.notificationDelivery.count({
          where: { status: NotificationDeliveryStatus.DELIVERED },
        }),
        this.prisma.notificationDelivery.count({
          where: { status: NotificationDeliveryStatus.FAILED },
        }),
        this.prisma.notificationDelivery.count({
          where: { status: NotificationDeliveryStatus.CANCELLED },
        }),
        this.prisma.voterNotification.count(),
        this.prisma.notificationDelivery.count({ where: { channel: 'EMAIL' } }),
      ]);

    const totalDeliveries = pending + processing + sent + delivered + failed + cancelled;

    return {
      totalDeliveries,
      pending,
      processing,
      sent,
      delivered,
      failed,
      cancelled,
      inAppCount,
      emailCount,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private assertAnnouncementJurisdiction(
    admin: SafeAdminUser,
    target: { targetStateId?: string | null; targetElectionId?: string | null }
  ): void {
    if (admin.role === 'SUPER_ADMIN' || admin.role === 'NATIONAL_ADMIN') {
      return;
    }

    if (admin.role === 'STATE_ADMIN') {
      if (target.targetStateId && target.targetStateId !== admin.assignedStateId) {
        throw new ForbiddenProblemError(
          `State Admin jurisdiction breach: You may only manage announcements for your assigned state (${admin.assignedStateId}). Target: ${target.targetStateId}`
        );
      }
      return;
    }

    if (admin.role === 'ELECTION_OFFICER') {
      return;
    }

    if (admin.role === 'READ_ONLY_AUDITOR') {
      throw new ForbiddenProblemError('Auditors have read-only access and cannot alter announcements.');
    }
  }

  private mapAnnouncementToDTO(a: {
    id: string;
    title: string;
    summary: string;
    message: string;
    category: AnnouncementCategory;
    targetAudience: AnnouncementAudience;
    targetStateId?: string | null;
    targetElectionId?: string | null;
    targetConstituencyType?: ConstituencyType | null;
    targetParliamentaryConstituencyId?: string | null;
    targetAssemblyConstituencyId?: string | null;
    publicationDate: Date;
    expiryDate: Date;
    status: AnnouncementStatus;
    scheduledAt?: Date | null;
    approvedByAdminId?: string | null;
    reviewNotes?: string | null;
    createdByAdminId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AnnouncementDTO {
    return {
      id: a.id,
      title: a.title,
      summary: a.summary,
      message: a.message,
      category: a.category,
      targetAudience: a.targetAudience,
      targetStateId: a.targetStateId,
      targetElectionId: a.targetElectionId,
      targetConstituencyType: a.targetConstituencyType,
      targetParliamentaryConstituencyId: a.targetParliamentaryConstituencyId,
      targetAssemblyConstituencyId: a.targetAssemblyConstituencyId,
      publicationDate: a.publicationDate.toISOString().slice(0, 10),
      expiryDate: a.expiryDate.toISOString().slice(0, 10),
      status: a.status,
      scheduledAt: a.scheduledAt?.toISOString() || null,
      approvedByAdminId: a.approvedByAdminId,
      reviewNotes: a.reviewNotes,
      createdByAdminId: a.createdByAdminId,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private mapDeliveryToDTO(d: {
    id: string;
    notificationId?: string | null;
    announcementId?: string | null;
    recipientUserId?: string | null;
    recipientEmail?: string | null;
    channel: string;
    status: NotificationDeliveryStatus;
    attempts: number;
    maxAttempts: number;
    nextRetryAt?: Date | null;
    lastAttemptAt?: Date | null;
    deliveredAt?: Date | null;
    failureReason?: string | null;
    createdAt: Date;
  }): DeliveryLogDTO {
    return {
      id: d.id,
      notificationId: d.notificationId,
      announcementId: d.announcementId,
      recipientUserId: d.recipientUserId,
      recipientEmail: d.recipientEmail,
      channel: d.channel,
      status: d.status,
      attempts: d.attempts,
      maxAttempts: d.maxAttempts,
      nextRetryAt: d.nextRetryAt?.toISOString() || null,
      lastAttemptAt: d.lastAttemptAt?.toISOString() || null,
      deliveredAt: d.deliveredAt?.toISOString() || null,
      failureReason: d.failureReason,
      createdAt: d.createdAt.toISOString(),
    };
  }

  private async getTargetVotersForEvent(payload: ElectionEventPayload) {
    const where: Record<string, unknown> = {};
    if (payload.stateId) {
      where.stateId = payload.stateId;
    }
    return this.prisma.voterProfile.findMany({
      where,
      take: 50,
      include: {
        user: {
          include: { notificationPreference: true },
        },
      },
    });
  }

  private mapEventTypeToNotificationType(eventType: string): NotificationType {
    switch (eventType) {
      case 'ELECTION_ANNOUNCED':
        return NotificationType.ELECTION_ANNOUNCEMENT;
      case 'NOMINATION_PERIOD_OPENED':
      case 'NOMINATION_DEADLINE_APPROACHING':
        return NotificationType.NOMINATION_SCHEDULE;
      case 'CANDIDATE_LIST_PUBLISHED':
        return NotificationType.CANDIDATE_LIST;
      case 'POLLING_SCHEDULE_APPROACHING':
      case 'POLLING_PERIOD_OPENED':
      case 'POLLING_PERIOD_CLOSED':
        return NotificationType.POLLING_SCHEDULE;
      case 'RESULTS_PUBLISHED':
        return NotificationType.RESULT_PUBLISHED;
      default:
        return NotificationType.GENERAL_ANNOUNCEMENT;
    }
  }

  private buildEventNotificationTitle(payload: ElectionEventPayload): string {
    const election = payload.electionTitle || 'Simulated Election';
    switch (payload.eventType) {
      case 'ELECTION_ANNOUNCED':
        return `Simulated Election Announced: ${election}`;
      case 'NOMINATION_DEADLINE_APPROACHING':
        return `Nomination Cutoff Approaching: ${election}`;
      case 'POLLING_PERIOD_OPENED':
        return `Demo Polling Opened: ${election}`;
      case 'POLLING_PERIOD_CLOSED':
        return `Demo Polling Concluded: ${election}`;
      case 'RESULTS_PUBLISHED':
        return `Demo Results Certified: ${election}`;
      default:
        return `Electoral Advisory: ${election}`;
    }
  }

  private buildEventNotificationMessage(payload: ElectionEventPayload): string {
    const election = payload.electionTitle || 'Simulated Election';
    return `Educational notification regarding ${payload.eventType} for ${election}. Access your portal for details.`;
  }
}
