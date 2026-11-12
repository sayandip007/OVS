import { Router } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '../../config/database.js';
import {
  paginationQuerySchema,
  validateRequest,
} from '../../common/middleware/validate.js';
import { buildPaginationMeta, sendSuccess } from '../../common/utils/response.js';
import { candidateIdParamSchema } from '../parties/parties.schemas.js';
import { PartiesRepository } from '../parties/parties.repository.js';
import { PartiesService } from '../parties/parties.service.js';

const listPublicCandidatesQuerySchema = paginationQuerySchema.extend({
  partyId: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((v) => v.toUpperCase())
    .optional(),
  search: z.string().trim().max(120).optional(),
});

export function createCandidatesRouter(): Router {
  const router = Router();
  const getService = () => new PartiesService(new PartiesRepository(getPrismaClient()));

  router.get(
    '/',
    validateRequest({ query: listPublicCandidatesQuerySchema }),
    async (req, res, next) => {
      try {
        const query = req.validated?.query as {
          partyId?: string;
          search?: string;
          page: number;
          limit: number;
        };
        const result = await getService().listPublicCandidates(query);
        sendSuccess(req, res, result.items, {
          pagination: buildPaginationMeta(query.page, query.limit, result.total),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/:candidateId',
    validateRequest({ params: candidateIdParamSchema }),
    async (req, res, next) => {
      try {
        const { candidateId } = req.validated?.params as { candidateId: string };
        const candidate = await getService().getCandidateById(candidateId);
        sendSuccess(req, res, candidate);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
