import { z } from 'zod';
import { PartyStatus, PartyType } from '@prisma/client';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

export const partyIdParamSchema = z.object({
  partyId: z
    .string()
    .trim()
    .min(2, 'partyId must be at least 2 characters')
    .max(50, 'partyId must not exceed 50 characters')
    .transform((v) => v.toUpperCase()),
});

export const candidateIdParamSchema = z.object({
  candidateId: z
    .string()
    .trim()
    .min(2, 'candidateId must be at least 2 characters')
    .max(50, 'candidateId must not exceed 50 characters')
    .transform((v) => v.toUpperCase()),
});

export const listPartiesQuerySchema = paginationQuerySchema.extend({
  partyType: z.nativeEnum(PartyType).optional(),
  status: z.nativeEnum(PartyStatus).optional(),
  search: z.string().trim().max(100).optional(),
});
