import { z } from 'zod';
import { ElectionStatus, ElectionType, MetadataSource } from '@prisma/client';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const optionalIsoDateSchema = z
  .string()
  .trim()
  .regex(isoDateRegex, 'Date must be formatted as YYYY-MM-DD')
  .optional();

export const adminElectionIdParamSchema = z.object({
  electionId: z
    .string()
    .trim()
    .min(3, 'electionId must be at least 3 characters')
    .max(50, 'electionId must not exceed 50 characters')
    .regex(
      /^[A-Za-z0-9-]+$/,
      'electionId may only contain letters, digits, and hyphens'
    )
    .transform((v) => v.toUpperCase()),
});

export const listAdminElectionsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  type: z.nativeEnum(ElectionType).optional(),
  stateId: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase())
    .optional(),
  status: z.nativeEnum(ElectionStatus).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'pollingStartDate', 'name', 'year'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createAdminElectionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(3, 'Election identifier must be at least 3 characters')
      .max(50, 'Election identifier must not exceed 50 characters')
      .regex(
        /^[A-Za-z0-9-]+$/,
        'Election identifier may only contain letters, numbers, and hyphens'
      )
      .transform((v) => v.toUpperCase()),
    name: z
      .string()
      .trim()
      .min(4, 'Election name must be at least 4 characters')
      .max(200, 'Election name must not exceed 200 characters'),
    type: z.nativeEnum(ElectionType),
    year: z.coerce.number().int().min(2000).max(2100),
    stateId: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
    country: z.string().trim().min(2).max(100).default('India'),
    targetJurisdiction: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(2000).default(''),
    initialStatus: z
      .enum([ElectionStatus.DRAFT, ElectionStatus.UPCOMING])
      .default(ElectionStatus.DRAFT),
    pollingStartDate: optionalIsoDateSchema,
    pollingEndDate: optionalIsoDateSchema,
    countingDate: optionalIsoDateSchema,
    resultDate: optionalIsoDateSchema,
    metadataSource: z.nativeEnum(MetadataSource).default(MetadataSource.DEMO_SAMPLE),
  })
  .strict();

export const updateAdminElectionSchema = z
  .object({
    name: z.string().trim().min(4).max(200).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    country: z.string().trim().min(2).max(100).optional(),
    targetJurisdiction: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(2000).optional(),
    pollingStartDate: optionalIsoDateSchema,
    pollingEndDate: optionalIsoDateSchema,
    countingDate: optionalIsoDateSchema,
    resultDate: optionalIsoDateSchema,
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const transitionElectionStatusSchema = z
  .object({
    targetStatus: z.nativeEnum(ElectionStatus),
    note: z.string().trim().max(500).default(''),
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const cancelAdminElectionSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, 'Cancellation reason must be at least 5 characters')
      .max(1000, 'Cancellation reason must not exceed 1000 characters'),
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const archiveAdminElectionSchema = z
  .object({
    note: z.string().trim().max(500).default('Election archived for historical preservation.'),
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const electionHistoryQuerySchema = paginationQuerySchema;
