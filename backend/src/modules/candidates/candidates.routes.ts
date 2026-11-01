import { Router } from 'express';
import { getPrismaClient } from '../../config/database.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { sendSuccess } from '../../common/utils/response.js';
import { candidateIdParamSchema } from '../parties/parties.schemas.js';
import { PartiesRepository } from '../parties/parties.repository.js';
import { PartiesService } from '../parties/parties.service.js';

export function createCandidatesRouter(): Router {
  const router = Router();
  const getService = () => new PartiesService(new PartiesRepository(getPrismaClient()));

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
