import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementStatus,
  NotificationDeliveryStatus,
  NotificationType,
  PrismaClient,
} from '@prisma/client';
import {
  ADMIN_PERMISSIONS,
  roleHasPermission,
} from '../../src/modules/admin/admin.permissions.js';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
} from '../../src/common/errors/problemDetails.js';
import type { SafeAdminUser } from '../../src/modules/auth/auth.types.js';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import {
  DevelopmentEmailProvider,
  escapeHtml,
  htmlToPlainText,
  setEmailProviderForTesting,
  SIMULATION_EMAIL_DISCLAIMER,
} from '../../src/modules/notifications/email.provider.js';
import { NotificationTemplateService } from '../../src/modules/notifications/notifications.template.service.js';
import { NotificationsWorker } from '../../src/modules/notifications/notifications.worker.js';

describe('OVS Phase 8.11 — Notifications, Announcements & Email Integration Unit Suite', () => {
  const superAdmin: SafeAdminUser = {
    id: 'admin-super-01',
    userId: 'user-super-01',
    officerCode: 'ECI-SUPER-01',
    email: 'super@ovs.test',
    fullName: 'Super Admin',
    designation: 'Chief Election Commissioner',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: null,
    assignedStateIds: [],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
  };

  const wbAdmin: SafeAdminUser = {
    id: 'admin-wb-01',
    userId: 'user-wb-01',
    officerCode: 'ECI-WB-01',
    email: 'wb@ovs.test',
    fullName: 'WB Admin',
    designation: 'Chief Electoral Officer',
    role: 'STATE_ADMIN',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: 'WB',
    assignedStateIds: ['WB'],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
  };

  const readOnlyAuditor: SafeAdminUser = {
    id: 'admin-auditor-01',
    userId: 'user-auditor-01',
    officerCode: 'ECI-AUDIT-01',
    email: 'auditor@ovs.test',
    fullName: 'Auditor One',
    designation: 'Electoral Process Auditor',
    role: 'READ_ONLY_AUDITOR',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: null,
    assignedStateIds: [],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
  };

  test('1. Centralized RBAC enforces announcement permissions and auditor read-only rules', () => {
    // Super Admin has full permissions
    assert.equal(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.ANNOUNCEMENTS_CREATE), true);
    assert.equal(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.ANNOUNCEMENTS_PUBLISH), true);
    assert.equal(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.NOTIFICATIONS_RETRY), true);

    // State Admin has announcement permissions within jurisdiction
    assert.equal(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.ANNOUNCEMENTS_CREATE), true);
    assert.equal(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.ANNOUNCEMENTS_PUBLISH), true);
    assert.equal(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.NOTIFICATIONS_RETRY), true);

    // READ_ONLY_AUDITOR has read access only, ZERO mutating permissions
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.ANNOUNCEMENTS_READ), true);
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.NOTIFICATIONS_READ), true);
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.ANNOUNCEMENTS_CREATE), false);
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.ANNOUNCEMENTS_PUBLISH), false);
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.NOTIFICATIONS_MANAGE), false);
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.NOTIFICATIONS_RETRY), false);
  });

  test('2. In-App Notifications: marks as read and enforces strict IDOR protection', async () => {
    const voterOneId = 'voter-uuid-1';
    const voterTwoId = 'voter-uuid-2';
    const notifOneId = 'NOTIF-001';

    const mockPrisma = {
      voterNotification: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (where.id === notifOneId) {
            return {
              id: notifOneId,
              voterId: voterOneId,
              type: NotificationType.GENERAL_ANNOUNCEMENT,
              title: 'Welcome Voter',
              message: 'Demo notification',
              timestamp: new Date(),
              isRead: false,
              readAt: null,
            };
          }
          return null;
        },
        update: async ({ data }: { data: { isRead: boolean; readAt: Date } }) => ({
          id: notifOneId,
          voterId: voterOneId,
          type: NotificationType.GENERAL_ANNOUNCEMENT,
          title: 'Welcome Voter',
          message: 'Demo notification',
          timestamp: new Date(),
          isRead: data.isRead,
          readAt: data.readAt,
        }),
      },
    } as unknown as PrismaClient;

    const service = new NotificationsService(mockPrisma);

    // Owner marks as read -> succeeds
    const result = await service.markVoterNotificationRead(voterOneId, notifOneId);
    assert.equal(result.isRead, true);
    assert.ok(result.readAt);

    // Other voter attempts IDOR access -> throws ForbiddenProblemError
    await assert.rejects(
      async () => service.markVoterNotificationRead(voterTwoId, notifOneId),
      ForbiddenProblemError
    );

    // Non-existent notification -> throws NotFoundProblemError
    await assert.rejects(
      async () => service.markVoterNotificationRead(voterOneId, 'NOTIF-NONEXISTENT'),
      NotFoundProblemError
    );
  });

  test('3. Announcement Lifecycle State Machine: Draft -> Under Review -> Approved -> Scheduled -> Published -> Archived', async () => {
    let currentStatus: AnnouncementStatus = AnnouncementStatus.DRAFT;
    let scheduledDate: Date | null = null;
    let approvedBy: string | null = null;

    const mockAnnouncement = {
      id: 'ANN-2026-001',
      title: 'Phase 1 Polling Schedule',
      summary: 'Polling timetable for Lok Sabha',
      message: 'Comprehensive gazette text',
      category: AnnouncementCategory.ELECTION_SCHEDULE,
      targetAudience: AnnouncementAudience.ALL_VOTERS,
      targetStateId: null,
      targetElectionId: 'LS-2029',
      targetConstituencyType: null,
      targetParliamentaryConstituencyId: null,
      targetAssemblyConstituencyId: null,
      publicationDate: new Date('2026-11-20'),
      expiryDate: new Date('2026-12-31'),
      status: currentStatus,
      scheduledAt: scheduledDate,
      approvedByAdminId: approvedBy,
      reviewNotes: null,
      createdByAdminId: superAdmin.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPrisma = {
      announcement: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          ...mockAnnouncement,
          ...data,
          status: AnnouncementStatus.DRAFT,
        }),
        findUnique: async () => ({
          ...mockAnnouncement,
          status: currentStatus,
          scheduledAt: scheduledDate,
          approvedByAdminId: approvedBy,
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          if (data.status) currentStatus = data.status as AnnouncementStatus;
          if (data.scheduledAt !== undefined) scheduledDate = data.scheduledAt as Date | null;
          if (data.approvedByAdminId !== undefined) approvedBy = data.approvedByAdminId as string | null;
          return {
            ...mockAnnouncement,
            ...data,
            status: currentStatus,
            scheduledAt: scheduledDate,
            approvedByAdminId: approvedBy,
          };
        },
      },
      voterProfile: {
        findMany: async () => [],
      },
    } as unknown as PrismaClient;

    const service = new NotificationsService(mockPrisma);

    // Step 1: Create announcement starts in DRAFT
    const created = await service.createAnnouncement(superAdmin, {
      title: 'Phase 1 Polling Schedule',
      summary: 'Polling timetable for Lok Sabha',
      message: 'Comprehensive gazette text',
      publicationDate: '2026-11-20',
      expiryDate: '2026-12-31',
    });
    assert.equal(created.status, 'DRAFT');

    // Step 2: Submit for review -> UNDER_REVIEW
    const underReview = await service.submitAnnouncementForReview(superAdmin, created.id, 'Ready for audit');
    assert.equal(underReview.status, 'UNDER_REVIEW');

    // Step 3: Approve -> APPROVED
    const approved = await service.approveAnnouncement(superAdmin, created.id, 'Scrutiny passed');
    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.approvedByAdminId, superAdmin.id);

    // Step 4: Schedule -> SCHEDULED
    const scheduled = await service.scheduleAnnouncement(
      superAdmin,
      created.id,
      '2026-11-25T07:00:00.000Z'
    );
    assert.equal(scheduled.status, 'SCHEDULED');
    assert.ok(scheduled.scheduledAt);

    // Step 5: Publish -> PUBLISHED
    const published = await service.publishAnnouncement(superAdmin, created.id);
    assert.equal(published.status, 'PUBLISHED');

    // Step 6: Archive -> ARCHIVED
    const archived = await service.archiveAnnouncement(superAdmin, created.id, 'Campaign concluded');
    assert.equal(archived.status, 'ARCHIVED');

    // Step 7: Editing a published/archived announcement is blocked
    await assert.rejects(
      async () => service.updateAnnouncement(superAdmin, created.id, { title: 'New Title' }),
      ConflictProblemError
    );
  });

  test('4. Jurisdiction Scoping: STATE_ADMIN is restricted to assigned state and blocked from other states', async () => {
    const mockPrisma = {
      announcement: {
        create: async () => assert.fail('Should not be called on jurisdiction breach'),
      },
    } as unknown as PrismaClient;

    const service = new NotificationsService(mockPrisma);

    // WB Admin attempting to create an announcement targeting Maharashtra (MH)
    await assert.rejects(
      async () =>
        service.createAnnouncement(wbAdmin, {
          title: 'Maharashtra Polling Update',
          summary: 'Summary',
          message: 'Message content',
          targetAudience: AnnouncementAudience.SPECIFIC_STATE,
          targetStateId: 'MH', // Out of WB Admin jurisdiction!
          publicationDate: '2026-11-20',
          expiryDate: '2026-12-31',
        }),
      ForbiddenProblemError
    );
  });

  test('5. Public Announcement Isolation: Draft, under-review, and expired announcements are hidden', async () => {
    const publishedValid = {
      id: 'ANN-PUB-1',
      title: 'Published Gazette',
      summary: 'Public summary',
      message: 'Public message',
      category: AnnouncementCategory.GENERAL_INFO,
      targetAudience: AnnouncementAudience.ALL_VOTERS,
      publicationDate: new Date('2026-11-01'),
      expiryDate: new Date('2026-12-31'),
      status: AnnouncementStatus.PUBLISHED,
    };

    const mockPrisma = {
      announcement: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          assert.equal(where.status, AnnouncementStatus.PUBLISHED);
          assert.ok(where.publicationDate);
          assert.ok(where.expiryDate);
          return [publishedValid];
        },
        count: async () => 1,
      },
    } as unknown as PrismaClient;

    const service = new NotificationsService(mockPrisma);
    const result = await service.listPublicAnnouncements({ page: 1, limit: 10 });

    assert.equal(result.data.length, 1);
    assert.equal(result.data[0]!.id, 'ANN-PUB-1');
  });

  test('6. Email Delivery & HTML Sanitization: Escapes XSS and produces plaintext alternative', () => {
    const maliciousInput = '<script>alert("pwned")</script> & <img src=x onerror=alert(1)>';
    const escaped = escapeHtml(maliciousInput);

    assert.equal(escaped.includes('<script>'), false);
    assert.equal(escaped.includes('&lt;script&gt;'), true);
    assert.equal(escaped.includes('&amp;'), true);

    const htmlContent = '<h1>Simulated Election Notice</h1><p>Polls open at <b>07:00 IST</b>.</p>';
    const plainText = htmlToPlainText(htmlContent);

    assert.equal(plainText.includes('<h1>'), false);
    assert.equal(plainText.includes('Polls open at 07:00 IST.'), true);

    const template = NotificationTemplateService.renderElectionAnnounced(
      'West Bengal Assembly General Election 2026',
      'West Bengal'
    );
    assert.ok(template.subject.includes('Simulated Election Announced'));
    assert.ok(template.html.includes(SIMULATION_EMAIL_DISCLAIMER));
    assert.ok(template.text.includes('NOTICE: This communication is generated'));
  });

  test('7. DevelopmentEmailProvider: Captures outbox safely in-memory with zero outbound network calls', async () => {
    const devProvider = new DevelopmentEmailProvider();
    assert.equal(devProvider.name, 'DevelopmentEmailProvider');

    devProvider.clearOutbox();
    assert.equal(devProvider.getOutbox().length, 0);

    const result = await devProvider.sendEmail({
      to: 'voter@ovs.test',
      subject: 'Demo Poll Advisory',
      html: '<p>Demo test body</p>',
      text: 'Demo test body',
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 'DELIVERED');
    assert.ok(result.messageId);

    const outbox = devProvider.getOutbox();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]!.to, 'voter@ovs.test');
    assert.equal(outbox[0]!.subject, 'Demo Poll Advisory');
  });

  test('8. Outbox Queue & Exponential Backoff: Retries failed deliveries with exponential backoff', async () => {
    let attemptCount = 0;
    let recordedNextRetry: Date | null = null;
    let recordedStatus: NotificationDeliveryStatus = NotificationDeliveryStatus.PENDING;

    setEmailProviderForTesting({
      name: 'FailingProvider',
      sendEmail: async () => {
        throw new Error('SMTP connection refused');
      },
    });

    try {
      const mockPrisma = {
        notificationDelivery: {
          findMany: async () => [
            {
              id: 'deliv-001',
              channel: 'EMAIL',
              recipientEmail: 'invalid-address@fail.local',
              status: NotificationDeliveryStatus.PENDING,
              attempts: attemptCount,
              maxAttempts: 3,
              nextRetryAt: new Date(),
            },
          ],
          update: async ({ data }: { data: Record<string, unknown> }) => {
            if (data.attempts) attemptCount++;
            if (data.nextRetryAt !== undefined) recordedNextRetry = data.nextRetryAt as Date | null;
            if (data.status) recordedStatus = data.status as NotificationDeliveryStatus;
            return {};
          },
        },
      } as unknown as PrismaClient;

      const service = new NotificationsService(mockPrisma);

      // Fail delivery processing intentionally
      const result = await service.processPendingDeliveries();
      assert.equal(result.failureCount, 1);
      assert.equal(recordedStatus, NotificationDeliveryStatus.FAILED);
      assert.ok(recordedNextRetry);
      // Exponential backoff timestamp should be in the future
      assert.ok((recordedNextRetry as Date).getTime() > Date.now());
    } finally {
      setEmailProviderForTesting(new DevelopmentEmailProvider());
    }
  });

  test('9. NotificationsWorker: Background worker auto-publishes scheduled announcements on tick', async () => {
    const pastScheduledAnnouncement = {
      id: 'ANN-SCHEDULED-1',
      title: 'Scheduled Release',
      status: AnnouncementStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() - 10000), // In the past
    };

    let publishCalled = false;

    const mockPrisma = {
      notificationDelivery: {
        findMany: async () => [],
      },
      announcement: {
        findMany: async ({ where }: { where: { status: AnnouncementStatus } }) => {
          if (where.status === AnnouncementStatus.SCHEDULED) {
            return [pastScheduledAnnouncement];
          }
          return [];
        },
        update: async ({ data }: { data: { status: AnnouncementStatus } }) => {
          if (data.status === AnnouncementStatus.PUBLISHED) {
            publishCalled = true;
          }
          return {};
        },
        updateMany: async () => ({ count: 0 }),
      },
    } as unknown as PrismaClient;

    const worker = new NotificationsWorker(mockPrisma);
    const result = await worker.tick();

    assert.equal(result.scheduledPublished, 1);
    assert.equal(publishCalled, true);
  });
});
