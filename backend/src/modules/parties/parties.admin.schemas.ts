import { z } from 'zod';
import { MetadataSource, PartyStatus, PartyType } from '@prisma/client';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

export const adminPartyIdParamSchema = z.object({
  partyId: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((v) => v.toUpperCase()),
});

export const listAdminPartiesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  partyType: z.nativeEnum(PartyType).optional(),
  status: z.nativeEnum(PartyStatus).optional(),
});

export const createAdminPartySchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[A-Za-z0-9-]+$/, 'Party ID may only contain letters, digits, and hyphens')
      .transform((v) => v.toUpperCase()),
    name: z.string().trim().min(3).max(150),
    abbreviation: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .transform((v) => v.toUpperCase()),
    partyType: z.nativeEnum(PartyType).default(PartyType.STATE),
    symbolName: z.string().trim().min(2).max(100),
    symbolUrl: z.string().trim().min(1).max(500).default('/symbols/demo-party.png'),
    description: z.string().trim().max(2000).default(''),
    establishedYear: z.coerce.number().int().min(1850).max(2100).nullable().optional(),
    headquarters: z.string().trim().max(150).nullable().optional(),
    status: z.nativeEnum(PartyStatus).default(PartyStatus.ACTIVE),
    metadataSource: z.nativeEnum(MetadataSource).default(MetadataSource.DEMO_SAMPLE),
  })
  .strict();

export const updateAdminPartySchema = z
  .object({
    name: z.string().trim().min(3).max(150).optional(),
    abbreviation: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .transform((v) => v.toUpperCase())
      .optional(),
    partyType: z.nativeEnum(PartyType).optional(),
    symbolName: z.string().trim().min(2).max(100).optional(),
    symbolUrl: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(2000).optional(),
    establishedYear: z.coerce.number().int().min(1850).max(2100).nullable().optional(),
    headquarters: z.string().trim().max(150).nullable().optional(),
    status: z.nativeEnum(PartyStatus).optional(),
  })
  .strict();
