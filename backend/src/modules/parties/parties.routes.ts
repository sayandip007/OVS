import { Router } from 'express';
import { getPrismaClient } from '../../config/database.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { buildPaginationMeta, sendSuccess } from '../../common/utils/response.js';
import { listPartiesQuerySchema, partyIdParamSchema } from './parties.schemas.js';
import { PartiesRepository } from './parties.repository.js';
import { PartiesService } from './parties.service.js';

export function createPartiesRouter(): Router {
  const router = Router();
  const getService = () => new PartiesService(new PartiesRepository(getPrismaClient()));

  router.get(
    '/',
    validateRequest({ query: listPartiesQuerySchema }),
    async (req, res, next) => {
      try {
        const query = req.validated?.query as {
          partyType?: 'NATIONAL' | 'STATE' | 'INDEPENDENT';
          status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
          search?: string;
          page: number;
          limit: number;
        };
        const result = await getService().listParties(query);
        sendSuccess(req, res, result.items, {
          pagination: buildPaginationMeta(query.page, query.limit, result.total),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/:partyId',
    validateRequest({ params: partyIdParamSchema }),
    async (req, res, next) => {
      try {
        const { partyId } = req.validated?.params as { partyId: string };
        const party = await getService().getPartyById(partyId);
        sendSuccess(req, res, party);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
