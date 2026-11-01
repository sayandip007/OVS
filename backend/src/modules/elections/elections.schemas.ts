import { z } from 'zod';
import {
  CandidateNominationStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
} from '@prisma/client';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

export const electionIdParamSchema = z.object({
  electionId: z
    .string()
    .trim()
    .min(2, 'electionId must be at least 2 characters')
    .max(50, 'electionId must not exceed 50 characters')
    .transform((v) => v.toUpperCase()),
});

export const listElectionsQuerySchema = paginationQuerySchema.extend({
  type: z.nativeEnum(ElectionType).optional(),
  status: z.nativeEnum(ElectionStatus).optional(),
  stateId: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase())
    .optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
});

export const listElectionConstituenciesQuerySchema = paginationQuerySchema.extend({
  constituencyType: z.nativeEnum(ConstituencyType).optional(),
  stateId: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase())
    .optional(),
});

export const listElectionCandidatesQuerySchema = paginationQuerySchema.extend({
  constituencyId: z
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
  status: z
    .nativeEnum(CandidateNominationStatus)
    .default(CandidateNominationStatus.APPROVED),
});
