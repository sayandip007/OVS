import { z } from 'zod';
import { paginationQuerySchema } from '../../common/middleware/validate.js';

export const voterElectionIdParamSchema = z.object({
  electionId: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .transform((v) => v.toUpperCase()),
});

/**
 * STRICT PRIVACY INVARIANT:
 * Participation confirmation MUST NOT accept candidateId, partyId, ballotChoice,
 * selectionHash, or any unexpected field. Empty body only.
 */
export const participationConfirmBodySchema = z.object({}).strict();

export const listVoterParticipationQuerySchema = paginationQuerySchema;
