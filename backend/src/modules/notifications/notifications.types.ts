import type {
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementStatus,
  ConstituencyType,
  NotificationDeliveryStatus,
  NotificationType,
} from '@prisma/client';

export interface VoterNotificationDTO {
  id: string;
  voterId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  readAt?: string | null;
}

export interface AdminNotificationDTO {
  id: string;
  adminId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  readAt?: string | null;
}

export interface NotificationPreferenceDTO {
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  electionReminders: boolean;
  generalAnnouncements: boolean;
  adminAlerts: boolean;
}

export interface UpdateNotificationPreferenceDTO {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  electionReminders?: boolean;
  generalAnnouncements?: boolean;
  adminAlerts?: boolean;
}

export interface AnnouncementDTO {
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
  publicationDate: string;
  expiryDate: string;
  status: AnnouncementStatus;
  scheduledAt?: string | null;
  approvedByAdminId?: string | null;
  reviewNotes?: string | null;
  createdByAdminId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAnnouncementDTO {
  id: string;
  title: string;
  summary: string;
  message: string;
  category: AnnouncementCategory;
  publicationDate: string;
  expiryDate: string;
  targetAudience: AnnouncementAudience;
  targetStateId?: string | null;
  targetElectionId?: string | null;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  status: NotificationDeliveryStatus;
  error?: string;
}

export interface EmailDeliveryProvider {
  readonly name: string;
  sendEmail(message: EmailMessage): Promise<EmailDeliveryResult>;
}

export interface DeliveryLogDTO {
  id: string;
  notificationId?: string | null;
  announcementId?: string | null;
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  channel: string;
  status: NotificationDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: string | null;
  lastAttemptAt?: string | null;
  deliveredAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

export interface NotificationDeliveryStatisticsDTO {
  totalDeliveries: number;
  pending: number;
  processing: number;
  sent: number;
  delivered: number;
  failed: number;
  cancelled: number;
  inAppCount: number;
  emailCount: number;
}

export type ElectionEventType =
  | 'ELECTION_ANNOUNCED'
  | 'ELECTION_CONFIG_APPROVED'
  | 'NOMINATION_PERIOD_OPENED'
  | 'NOMINATION_DEADLINE_APPROACHING'
  | 'CANDIDATE_LIST_PUBLISHED'
  | 'POLLING_SCHEDULE_APPROACHING'
  | 'POLLING_PERIOD_OPENED'
  | 'POLLING_PERIOD_CLOSED'
  | 'COUNTING_STARTED'
  | 'COUNTING_COMPLETED'
  | 'RESULTS_PUBLISHED'
  | 'GENERAL_ANNOUNCEMENT_PUBLISHED';

export interface ElectionEventPayload {
  eventType: ElectionEventType;
  electionId?: string;
  electionTitle?: string;
  stateId?: string;
  constituencyId?: string;
  announcementId?: string;
  metadata?: Record<string, unknown>;
}
