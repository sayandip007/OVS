import { z } from 'zod';
import { ConstituencyType, ResultStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

export const sessionIdParamSchema = z.object({
  sessionId: z
    .string()
    .trim()
    .min(3, 'sessionId must be at least 3 characters')
    .max(100, 'sessionId must not exceed 100 characters'),
});

export const electionIdParamSchema = z.object({
  electionId: z
    .string()
    .trim()
    .min(2, 'electionId must be at least 2 characters')
    .max(50, 'electionId must not exceed 50 characters')
    .transform((v) => v.toUpperCase()),
});

export const createCountingSessionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .optional(),
    electionId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase()),
    constituencyType: z.nativeEnum(ConstituencyType),
    parliamentaryConstituencyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .optional()
      .nullable(),
    assemblyConstituencyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .optional()
      .nullable(),
    totalConfiguredRounds: z.coerce.number().int().min(1).max(50).default(5),
    totalVoters: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      if (data.constituencyType === ConstituencyType.PARLIAMENTARY) {
        return Boolean(data.parliamentaryConstituencyId) && !data.assemblyConstituencyId;
      }
      return Boolean(data.assemblyConstituencyId) && !data.parliamentaryConstituencyId;
    },
    {
      message:
        'Must supply parliamentaryConstituencyId for PARLIAMENTARY, or assemblyConstituencyId for ASSEMBLY (strictly mutually exclusive).',
      path: ['constituencyType'],
    }
  );

export const recordCountingRoundSchema = z.object({
  roundNumber: z.coerce.number().int().min(1).max(50),
  roundVotes: z.coerce.number().int().min(0),
  cumulativeVotes: z.coerce.number().int().min(0),
  leadingCandidateId: z.string().trim().min(2).max(50).optional().nullable(),
  leadMargin: z.coerce.number().int().min(0).default(0),
});

export const candidateTallyInputSchema = z.object({
  candidateId: z.string().trim().min(2).max(50),
  votes: z.coerce.number().int().min(0),
});

export const recordCandidateTalliesSchema = z.object({
  tallies: z.array(candidateTallyInputSchema).min(1, 'At least one candidate tally is required'),
  notaVotes: z.coerce.number().int().min(0).optional(),
  rejectedVotes: z.coerce.number().int().min(0).optional(),
});

export const updateCountingSessionStatusSchema = z.object({
  status: z.nativeEnum(ResultStatus),
  reason: z.string().trim().max(500).optional(),
});

export const resolveTieSchema = z.object({
  selectedWinnerId: z.string().trim().min(2).max(50),
  decision: z
    .enum([
      'WINNER_SELECTED_BY_LOT',
      'SIMULATED_DRAW_WINNER_DECLARED',
      'RECOUNT_TIE_BROKEN_BY_LOT',
      'SIMULATED_TIE_BROKEN_DRAW_OF_LOTS',
    ])
    .default('SIMULATED_DRAW_WINNER_DECLARED'),
  resolutionMethod: z
    .enum([
      'SIMULATED_DRAW_OF_LOTS',
      'DRAW_OF_LOTS',
      'SIMULATED_RO_LOTTERY',
      'DRAW_OF_LOTS_RO_SECTION_102_RPA_1951',
    ])
    .default('SIMULATED_DRAW_OF_LOTS'),
  justificationNote: z
    .string()
    .trim()
    .min(10, 'Justification note must be at least 10 characters')
    .max(2000),
});

export const correctResultSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Correction reason must be at least 10 characters')
    .max(1000),
  notaVotes: z.coerce.number().int().min(0).optional(),
  rejectedVotes: z.coerce.number().int().min(0).optional(),
  candidateVotes: z.record(z.string(), z.coerce.number().int().min(0)).optional(),
});

export const listCountingSessionsQuerySchema = paginationQuerySchema.extend({
  electionId: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .optional(),
  constituencyType: z.nativeEnum(ConstituencyType).optional(),
  status: z.nativeEnum(ResultStatus).optional(),
  stateId: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .optional(),
  isPublished: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export const listPublicResultsQuerySchema = paginationQuerySchema.extend({
  electionId: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .optional(),
  constituencyType: z.nativeEnum(ConstituencyType).optional(),
  stateId: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  search: z.string().trim().max(100).optional(),
});
