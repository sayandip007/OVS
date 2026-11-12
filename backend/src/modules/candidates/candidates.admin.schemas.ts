import { z } from 'zod';
import { MetadataSource } from '@prisma/client';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

export const adminCandidateIdParamSchema = z.object({
  candidateId: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((v) => v.toUpperCase()),
});

export const listAdminCandidatesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  partyId: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const createAdminCandidateSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[A-Za-z0-9-]+$/, 'Candidate ID may only contain letters, digits, and hyphens')
      .transform((v) => v.toUpperCase()),
    partyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase())
      .default('PARTY-IND'),
    displayName: z.string().trim().min(2).max(150).optional(),
    fullName: z.string().trim().min(2).max(150),
    age: z.coerce.number().int().min(25, 'Minimum contesting age in Indian elections is 25').max(120),
    gender: z.string().trim().min(2).max(20),
    education: z.string().trim().min(2).max(150).default('Graduate'),
    profession: z.string().trim().min(2).max(150).default('Public Service'),
    criminalCases: z.coerce.number().int().min(0).max(500).default(0),
    assetsDeclared: z.coerce.number().int().min(0).default(0),
    liabilitiesDeclared: z.coerce.number().int().min(0).default(0),
    photoUrl: z.string().trim().max(500).nullable().optional(),
    bio: z.string().trim().max(2000).default(''),
    metadataSource: z.nativeEnum(MetadataSource).default(MetadataSource.DEMO_SAMPLE),
  })
  .strict();

export const updateAdminCandidateSchema = z
  .object({
    partyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase())
      .optional(),
    displayName: z.string().trim().min(2).max(150).optional(),
    fullName: z.string().trim().min(2).max(150).optional(),
    age: z.coerce.number().int().min(25).max(120).optional(),
    gender: z.string().trim().min(2).max(20).optional(),
    education: z.string().trim().min(2).max(150).optional(),
    profession: z.string().trim().min(2).max(150).optional(),
    criminalCases: z.coerce.number().int().min(0).max(500).optional(),
    assetsDeclared: z.coerce.number().int().min(0).optional(),
    liabilitiesDeclared: z.coerce.number().int().min(0).optional(),
    photoUrl: z.string().trim().max(500).nullable().optional(),
    bio: z.string().trim().max(2000).optional(),
  })
  .strict();

export const deactivateCandidateSchema = z
  .object({
    reason: z.string().trim().min(3).max(500).default('Administrative deactivation.'),
  })
  .strict();
