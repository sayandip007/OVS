import { z } from 'zod';
import {
  ConstituencyType,
  ScheduleMilestoneStatus,
  ScheduleMilestoneType,
} from '@prisma/client';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

export const electionConstituencyIdParamSchema = z.object({
  electionId: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .transform((v) => v.toUpperCase()),
  constituencyId: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((v) => v.toUpperCase()),
});

export const electionMilestoneParamSchema = z.object({
  electionId: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .transform((v) => v.toUpperCase()),
  milestoneId: z.nativeEnum(ScheduleMilestoneType),
});

export const listElectionConstituenciesAdminQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  stateId: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase())
    .optional(),
  districtId: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  constituencyType: z.nativeEnum(ConstituencyType).optional(),
});

export const assignSingleConstituencySchema = z
  .object({
    constituencyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase()),
    note: z.string().trim().max(500).default(''),
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const bulkConstituencySchema = z
  .object({
    constituencyIds: z
      .array(
        z
          .string()
          .trim()
          .min(2)
          .max(50)
          .transform((v) => v.toUpperCase())
      )
      .min(1, 'At least one constituencyId is required')
      .max(200, 'Maximum 200 constituencies per batch'),
    note: z.string().trim().max(500).default(''),
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

const milestoneEntrySchema = z
  .object({
    milestoneType: z.nativeEnum(ScheduleMilestoneType),
    startAt: z.string().datetime({ offset: true }).nullable().optional(),
    endAt: z.string().datetime({ offset: true }).nullable().optional(),
    timezone: z.string().trim().min(2).max(60).optional(),
    status: z.nativeEnum(ScheduleMilestoneStatus).default(ScheduleMilestoneStatus.CONFIGURED),
    note: z.string().trim().max(500).default(''),
  })
  .strict();

export const putScheduleSchema = z
  .object({
    timezone: z.string().trim().min(2).max(60).default('Asia/Kolkata'),
    milestones: z.array(milestoneEntrySchema).min(1).max(20),
    note: z.string().trim().max(500).default(''),
    expectedScheduleVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const patchMilestoneSchema = z
  .object({
    startAt: z.string().datetime({ offset: true }).nullable().optional(),
    endAt: z.string().datetime({ offset: true }).nullable().optional(),
    timezone: z.string().trim().min(2).max(60).optional(),
    status: z.nativeEnum(ScheduleMilestoneStatus).optional(),
    note: z.string().trim().max(500).optional(),
    expectedScheduleVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const configReviewActionSchema = z
  .object({
    note: z.string().trim().max(1000).default(''),
  })
  .strict();

export const configReturnSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, 'Return reason must be at least 5 characters')
      .max(1000),
  })
  .strict();
