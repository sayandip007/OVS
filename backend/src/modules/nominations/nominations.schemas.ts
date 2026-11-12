import { z } from 'zod';
import {
  CandidateNominationStatus,
  ConstituencyType,
  ElectionType,
} from '@prisma/client';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

export const nominationIdParamSchema = z.object({
  nominationId: z.string().uuid('nominationId must be a valid UUID'),
});

export const listAdminNominationsQuerySchema = paginationQuerySchema.extend({
  electionId: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  electionType: z.nativeEnum(ElectionType).optional(),
  stateId: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase())
    .optional(),
  constituencyId: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  candidateId: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  partyId: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  status: z.nativeEnum(CandidateNominationStatus).optional(),
  isIndependent: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const createNominationSchema = z
  .object({
    electionId: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .transform((v) => v.toUpperCase()),
    candidateId: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .transform((v) => v.toUpperCase()),
    constituencyType: z.nativeEnum(ConstituencyType),
    parliamentaryConstituencyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
    assemblyConstituencyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
    isIndependent: z.boolean().default(false),
    partyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
    scrutinyNote: z.string().trim().max(1000).default(''),
  })
  .strict();

export const updateNominationDraftSchema = z
  .object({
    isIndependent: z.boolean().optional(),
    partyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
    scrutinyNote: z.string().trim().max(1000).optional(),
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const nominationActionNoteSchema = z
  .object({
    note: z.string().trim().max(1000).default(''),
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const nominationReasonRequiredSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, 'Reason must be at least 5 characters')
      .max(1000, 'Reason must not exceed 1000 characters'),
    expectedVersion: z.coerce.number().int().min(1).optional(),
  })
  .strict();
