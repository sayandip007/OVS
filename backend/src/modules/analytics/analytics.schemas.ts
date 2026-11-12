import { z } from 'zod';

export const nationalAnalyticsQuerySchema = z
  .object({
    electionType: z.enum(['LOK_SABHA', 'STATE_ASSEMBLY']).optional(),
    status: z
      .enum([
        'DRAFT',
        'UPCOMING',
        'NOMINATION_OPEN',
        'NOMINATION_CLOSED',
        'READY',
        'POLLING_ACTIVE',
        'POLLING_COMPLETED',
        'COUNTING',
        'RESULTS_DECLARED',
        'CANCELLED',
        'ARCHIVED',
      ])
      .optional(),
    stateId: z.string().trim().max(10).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    publishedOnly: z.coerce.boolean().optional(),
  })
  .strict();

export const stateAnalyticsParamSchema = z
  .object({
    stateId: z.string().trim().min(2).max(10),
  })
  .strict();

export const stateAnalyticsQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    electionType: z.enum(['LOK_SABHA', 'STATE_ASSEMBLY']).optional(),
  })
  .strict();

export const electionAnalyticsParamSchema = z
  .object({
    electionId: z.string().trim().min(2).max(50),
  })
  .strict();

export const constituencyAnalyticsParamSchema = z
  .object({
    constituencyId: z.string().trim().min(2).max(50),
  })
  .strict();

export const participationAnalyticsQuerySchema = z
  .object({
    electionId: z.string().trim().max(50).optional(),
    stateId: z.string().trim().max(10).optional(),
    constituencyType: z.enum(['PARLIAMENTARY', 'ASSEMBLY']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .strict();

export const countingAnalyticsQuerySchema = z
  .object({
    electionId: z.string().trim().max(50).optional(),
    stateId: z.string().trim().max(10).optional(),
    constituencyType: z.enum(['PARLIAMENTARY', 'ASSEMBLY']).optional(),
    publishedOnly: z.coerce.boolean().optional(),
  })
  .strict();

export const auditAnalyticsQuerySchema = z
  .object({
    domain: z.string().trim().max(50).optional(),
    actionType: z.string().trim().max(50).optional(),
    actorRole: z
      .enum([
        'SUPER_ADMIN',
        'NATIONAL_ADMIN',
        'STATE_ADMIN',
        'ELECTION_OFFICER',
        'READ_ONLY_AUDITOR',
      ])
      .optional(),
    outcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const exportQuerySchema = z
  .object({
    format: z.enum(['csv', 'json']).default('csv'),
    domain: z.enum([
      'national',
      'state',
      'election',
      'participation',
      'counting',
      'audit',
    ]),
    electionId: z.string().trim().max(50).optional(),
    stateId: z.string().trim().max(10).optional(),
  })
  .strict();

export const publicAnalyticsQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    electionType: z.enum(['LOK_SABHA', 'STATE_ASSEMBLY']).optional(),
    stateId: z.string().trim().max(10).optional(),
  })
  .strict();
