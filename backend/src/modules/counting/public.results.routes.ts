import { Router } from 'express';
import {
  validateParams,
  validateQuery,
} from '../../common/middleware/validate.js';
import { CountingService } from './counting.service.js';
import { CountingController } from './counting.controller.js';
import {
  listPublicResultsQuerySchema,
  sessionIdParamSchema,
  electionIdParamSchema,
} from './counting.schemas.js';
import { prisma as defaultPrisma } from '../../config/database.js';

export interface CreatePublicResultsRouterOptions {
  countingService?: CountingService;
}

export function createPublicResultsRouter(
  options: CreatePublicResultsRouterOptions = {}
): Router {
  const router = Router();
  const countingService =
    options.countingService ?? new CountingService(defaultPrisma);
  const controller = new CountingController(countingService);

  // List published results
  router.get('/', validateQuery(listPublicResultsQuerySchema), controller.getPublicResults);

  // Election summary (party standings, seats, total counted votes, turnout comparison)
  router.get(
    '/elections/:electionId/summary',
    validateParams(electionIdParamSchema),
    controller.getPublicElectionSummary
  );

  // Single constituency published result
  router.get(
    '/:sessionId',
    validateParams(sessionIdParamSchema),
    controller.getPublicResultById
  );

  return router;
}
