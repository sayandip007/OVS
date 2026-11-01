import { Router } from 'express';
import { getPrismaClient } from '../../config/database.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { buildPaginationMeta, sendSuccess } from '../../common/utils/response.js';
import {
  electionIdParamSchema,
  listElectionCandidatesQuerySchema,
  listElectionConstituenciesQuerySchema,
  listElectionsQuerySchema,
} from './elections.schemas.js';
import { ElectionsRepository } from './elections.repository.js';
import { ElectionsService } from './elections.service.js';

export function createElectionsRouter(): Router {
  const router = Router();
  const getService = () => new ElectionsService(new ElectionsRepository(getPrismaClient()));

  router.get(
    '/',
    validateRequest({ query: listElectionsQuerySchema }),
    async (req, res, next) => {
      try {
        const query = req.validated?.query as {
          type?: 'LOK_SABHA' | 'STATE_ASSEMBLY';
          status?:
            | 'DRAFT'
            | 'UPCOMING'
            | 'NOMINATION_OPEN'
            | 'NOMINATION_CLOSED'
            | 'READY'
            | 'POLLING_ACTIVE'
            | 'POLLING_COMPLETED'
            | 'COUNTING'
            | 'RESULTS_DECLARED'
            | 'CANCELLED'
            | 'ARCHIVED';
          stateId?: string;
          year?: number;
          page: number;
          limit: number;
        };
        const result = await getService().listElections(query);
        sendSuccess(req, res, result.items, {
          pagination: buildPaginationMeta(query.page, query.limit, result.total),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/:electionId',
    validateRequest({ params: electionIdParamSchema }),
    async (req, res, next) => {
      try {
        const { electionId } = req.validated?.params as { electionId: string };
        const election = await getService().getElectionById(electionId);
        sendSuccess(req, res, election);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/:electionId/constituencies',
    validateRequest({
      params: electionIdParamSchema,
      query: listElectionConstituenciesQuerySchema,
    }),
    async (req, res, next) => {
      try {
        const { electionId } = req.validated?.params as { electionId: string };
        const query = req.validated?.query as {
          constituencyType?: 'PARLIAMENTARY' | 'ASSEMBLY';
          stateId?: string;
          page: number;
          limit: number;
        };
        const result = await getService().listElectionConstituencies(
          electionId,
          query
        );
        sendSuccess(req, res, result.items, {
          election: result.election,
          pagination: buildPaginationMeta(query.page, query.limit, result.total),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/:electionId/candidates',
    validateRequest({
      params: electionIdParamSchema,
      query: listElectionCandidatesQuerySchema,
    }),
    async (req, res, next) => {
      try {
        const { electionId } = req.validated?.params as { electionId: string };
        const query = req.validated?.query as {
          constituencyId?: string;
          partyId?: string;
          status?:
            | 'DRAFT'
            | 'SUBMITTED'
            | 'UNDER_REVIEW'
            | 'APPROVED'
            | 'REJECTED'
            | 'WITHDRAWN'
            | 'SUSPENDED'
            | 'ARCHIVED';
          page: number;
          limit: number;
        };
        const result = await getService().listElectionCandidates(electionId, query);
        sendSuccess(req, res, result.items, {
          election: result.election,
          pagination: buildPaginationMeta(query.page, query.limit, result.total),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
