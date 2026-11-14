import {
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementStatus,
  ConstituencyType,
  NotificationDeliveryStatus,
  NotificationType,
} from '@prisma/client';
import { z } from 'zod';

export const listNotificationsQuerySchema = z
  .object({
    isRead: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    type: z.nativeEnum(NotificationType).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export const updatePreferencesSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    electionReminders: z.boolean().optional(),
    generalAnnouncements: z.boolean().optional(),
    adminAlerts: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one preference field must be specified.',
  });

export const createAnnouncementSchema = z
  .object({
    id: z
      .string()
      .max(50)
      .regex(/^ANN-[A-Za-z0-9-_]+$/, 'ID must match ANN-<id> format')
      .optional(),
    title: z.string().trim().min(3).max(200),
    summary: z.string().trim().min(5).max(1000),
    message: z.string().trim().min(10),
    category: z.nativeEnum(AnnouncementCategory).default(AnnouncementCategory.GENERAL_INFO),
    targetAudience: z
      .nativeEnum(AnnouncementAudience)
      .default(AnnouncementAudience.ALL_VOTERS),
    targetStateId: z.string().trim().max(10).optional().nullable(),
    targetElectionId: z.string().trim().max(50).optional().nullable(),
    targetConstituencyType: z.nativeEnum(ConstituencyType).optional().nullable(),
    targetParliamentaryConstituencyId: z.string().trim().max(50).optional().nullable(),
    targetAssemblyConstituencyId: z.string().trim().max(50).optional().nullable(),
    publicationDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'publicationDate must be a valid ISO date',
    }),
    expiryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'expiryDate must be a valid ISO date',
    }),
    scheduledAt: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'scheduledAt must be a valid ISO date string if provided',
      }),
  })
  .strict()
  .refine(
    (data) => {
      const pub = new Date(data.publicationDate).getTime();
      const exp = new Date(data.expiryDate).getTime();
      return exp >= pub;
    },
    {
      message: 'expiryDate cannot be earlier than publicationDate',
      path: ['expiryDate'],
    }
  );

export const updateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    summary: z.string().trim().min(5).max(1000).optional(),
    message: z.string().trim().min(10).optional(),
    category: z.nativeEnum(AnnouncementCategory).optional(),
    targetAudience: z.nativeEnum(AnnouncementAudience).optional(),
    targetStateId: z.string().trim().max(10).optional().nullable(),
    targetElectionId: z.string().trim().max(50).optional().nullable(),
    targetConstituencyType: z.nativeEnum(ConstituencyType).optional().nullable(),
    targetParliamentaryConstituencyId: z.string().trim().max(50).optional().nullable(),
    targetAssemblyConstituencyId: z.string().trim().max(50).optional().nullable(),
    publicationDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'publicationDate must be a valid ISO date',
      }),
    expiryDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'expiryDate must be a valid ISO date',
      }),
    scheduledAt: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'scheduledAt must be a valid ISO date string if provided',
      }),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const submitReviewSchema = z
  .object({
    notes: z.string().max(1000).optional(),
  })
  .strict();

export const approveAnnouncementSchema = z
  .object({
    notes: z.string().max(1000).optional(),
  })
  .strict();

export const scheduleAnnouncementSchema = z
  .object({
    scheduledAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'scheduledAt must be a valid ISO date string',
    }),
  })
  .strict();

export const archiveAnnouncementSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

export const listAnnouncementsQuerySchema = z
  .object({
    status: z.nativeEnum(AnnouncementStatus).optional(),
    category: z.nativeEnum(AnnouncementCategory).optional(),
    targetAudience: z.nativeEnum(AnnouncementAudience).optional(),
    stateId: z.string().trim().max(10).optional(),
    electionId: z.string().trim().max(50).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export const listDeliveriesQuerySchema = z
  .object({
    status: z.nativeEnum(NotificationDeliveryStatus).optional(),
    channel: z.enum(['IN_APP', 'EMAIL']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  })
  .strict();

export const publicAnnouncementsQuerySchema = z
  .object({
    category: z.nativeEnum(AnnouncementCategory).optional(),
    stateId: z.string().trim().max(10).optional(),
    electionId: z.string().trim().max(50).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
  })
  .strict();
