import { z } from 'zod';
import { JurisdictionType, ReservationType } from '@prisma/client';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

export const stateIdParamSchema = z.object({
  stateId: z
    .string()
    .trim()
    .min(2, 'stateId must be at least 2 characters')
    .max(10, 'stateId must not exceed 10 characters')
    .transform((v) => v.toUpperCase()),
});

export const constituencyIdParamSchema = z.object({
  constituencyId: z
    .string()
    .trim()
    .min(2, 'constituencyId must be at least 2 characters')
    .max(50, 'constituencyId must not exceed 50 characters')
    .transform((v) => v.toUpperCase()),
});

export const listStatesQuerySchema = paginationQuerySchema.extend({
  type: z.nativeEnum(JurisdictionType).optional(),
  search: z.string().trim().max(100).optional(),
});

export const listDistrictsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
});

export const listParliamentaryQuerySchema = paginationQuerySchema.extend({
  reservationType: z.nativeEnum(ReservationType).optional(),
  search: z.string().trim().max(100).optional(),
});

export const listAssemblyQuerySchema = paginationQuerySchema.extend({
  districtId: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  parentParliamentaryConstituencyId: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  reservationType: z.nativeEnum(ReservationType).optional(),
  search: z.string().trim().max(100).optional(),
});
