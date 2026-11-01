import { Router } from 'express';
import { getPrismaClient } from '../../config/database.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { buildPaginationMeta, sendSuccess } from '../../common/utils/response.js';
import {
  constituencyIdParamSchema,
  listAssemblyQuerySchema,
  listDistrictsQuerySchema,
  listParliamentaryQuerySchema,
  listStatesQuerySchema,
  stateIdParamSchema,
} from './geography.schemas.js';
import { GeographyRepository } from './geography.repository.js';
import { GeographyService } from './geography.service.js';

export function createGeographyRouter(): Router {
  const router = Router();
  const getService = () => new GeographyService(new GeographyRepository(getPrismaClient()));

  router.get(
    '/states',
    validateRequest({ query: listStatesQuerySchema }),
    async (req, res, next) => {
      try {
        const query = req.validated?.query as {
          type?: 'STATE' | 'UNION_TERRITORY';
          search?: string;
          page: number;
          limit: number;
        };
        const result = await getService().listStates(query);
        sendSuccess(req, res, result.items, {
          pagination: buildPaginationMeta(query.page, query.limit, result.total),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/states/:stateId',
    validateRequest({ params: stateIdParamSchema }),
    async (req, res, next) => {
      try {
        const { stateId } = req.validated?.params as { stateId: string };
        const state = await getService().getStateById(stateId);
        sendSuccess(req, res, state);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/states/:stateId/districts',
    validateRequest({
      params: stateIdParamSchema,
      query: listDistrictsQuerySchema,
    }),
    async (req, res, next) => {
      try {
        const { stateId } = req.validated?.params as { stateId: string };
        const query = req.validated?.query as {
          search?: string;
          page: number;
          limit: number;
        };
        const result = await getService().listDistrictsForState(stateId, query);
        sendSuccess(req, res, result.items, {
          state: result.state,
          pagination: buildPaginationMeta(query.page, query.limit, result.total),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/states/:stateId/parliamentary-constituencies',
    validateRequest({
      params: stateIdParamSchema,
      query: listParliamentaryQuerySchema,
    }),
    async (req, res, next) => {
      try {
        const { stateId } = req.validated?.params as { stateId: string };
        const query = req.validated?.query as {
          reservationType?: 'GENERAL' | 'SC' | 'ST';
          search?: string;
          page: number;
          limit: number;
        };
        const result = await getService().listParliamentaryConstituenciesForState(
          stateId,
          query
        );
        sendSuccess(req, res, result.items, {
          state: result.state,
          pagination: buildPaginationMeta(query.page, query.limit, result.total),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/states/:stateId/assembly-constituencies',
    validateRequest({
      params: stateIdParamSchema,
      query: listAssemblyQuerySchema,
    }),
    async (req, res, next) => {
      try {
        const { stateId } = req.validated?.params as { stateId: string };
        const query = req.validated?.query as {
          districtId?: string;
          parentParliamentaryConstituencyId?: string;
          reservationType?: 'GENERAL' | 'SC' | 'ST';
          search?: string;
          page: number;
          limit: number;
        };
        const result = await getService().listAssemblyConstituenciesForState(
          stateId,
          query
        );
        sendSuccess(req, res, result.items, {
          state: result.state,
          pagination: buildPaginationMeta(query.page, query.limit, result.total),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/constituencies/:constituencyId',
    validateRequest({ params: constituencyIdParamSchema }),
    async (req, res, next) => {
      try {
        const { constituencyId } = req.validated?.params as { constituencyId: string };
        const constituency = await getService().getConstituencyById(constituencyId);
        sendSuccess(req, res, constituency);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
