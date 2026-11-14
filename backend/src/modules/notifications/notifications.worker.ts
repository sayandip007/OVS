import { AnnouncementStatus, PrismaClient } from '@prisma/client';
import { NotificationsService } from './notifications.service.js';

export class NotificationsWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private service: NotificationsService;

  constructor(
    private prisma: PrismaClient = new PrismaClient(),
    service?: NotificationsService
  ) {
    this.service = service ?? new NotificationsService(this.prisma);
  }

  /**
   * Starts periodic processing loop.
   */
  start(intervalMs = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      await this.tick();
    }, intervalMs);
  }

  /**
   * Stops the worker gracefully.
   */
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Executes a single processing cycle on demand.
   */
  async tick(): Promise<{
    deliveriesProcessed: number;
    deliveriesFailed: number;
    scheduledPublished: number;
    expiredArchived: number;
  }> {
    const now = new Date();

    // 1. Process pending/retriable email deliveries
    const deliveryResult = await this.service.processPendingDeliveries();

    // 2. Publish scheduled announcements that have reached their scheduled time
    const scheduledAnnouncements = await this.prisma.announcement.findMany({
      where: {
        status: AnnouncementStatus.SCHEDULED,
        scheduledAt: { lte: now },
      },
    });

    let scheduledPublished = 0;
    for (const ann of scheduledAnnouncements) {
      await this.prisma.announcement.update({
        where: { id: ann.id },
        data: {
          status: AnnouncementStatus.PUBLISHED,
          publicationDate: now,
        },
      });
      scheduledPublished++;
    }

    // 3. Auto-archive expired announcements
    const expiredResult = await this.prisma.announcement.updateMany({
      where: {
        status: AnnouncementStatus.PUBLISHED,
        expiryDate: { lt: now },
      },
      data: {
        status: AnnouncementStatus.ARCHIVED,
      },
    });

    return {
      deliveriesProcessed: deliveryResult.processedCount,
      deliveriesFailed: deliveryResult.failureCount,
      scheduledPublished,
      expiredArchived: expiredResult.count,
    };
  }
}
