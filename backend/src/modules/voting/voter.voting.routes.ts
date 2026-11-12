import { Router } from 'express';
import {
  validateBody,
  validateParams,
} from '../../common/middleware/validate.js';
import { createApiRateLimiter } from '../../common/middleware/security.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';
import {
  participationConfirmBodySchema,
  voterElectionIdParamSchema,
} from './voting.schemas.js';
import { VotingService } from './voting.service.js';
import { VotingController } from './voting.controller.js';

export interface CreateVoterVotingRouterOptions {
  votingService?: VotingService;
  authService?: AuthService;
  sessionService?: SessionService;
  enableRateLimit?: boolean;
}

export function createVoterVotingRouter(
  options: CreateVoterVotingRouterOptions = {}
): Router {
  const router = Router();

  const sessionSecret =
    process.env.SESSION_SECRET ?? 'dev_session_secret_32_characters_long_min';

  const sessionService =
    options.sessionService ?? new SessionService(sessionSecret);

  const authService =
    options.authService ??
    new AuthService(
      new AuthRepository(),
      new OtpService(),
      sessionService,
      sessionSecret
    );

  const authMiddleware = createAuthMiddleware(authService, sessionService);
  const votingService = options.votingService ?? new VotingService();
  const controller = new VotingController(votingService);

  const shouldRateLimit =
    options.enableRateLimit !== false && process.env.NODE_ENV !== 'test';
  const participationLimiter = createApiRateLimiter(30);

  router.use(authMiddleware.authenticate);
  router.use(authMiddleware.requireAuthentication);
  router.use(authMiddleware.requireActiveAccount);
  router.use(authMiddleware.requireRole('VOTER'));

  router.get('/elections', controller.listVoterElections);

  router.get(
    '/elections/:electionId',
    validateParams(voterElectionIdParamSchema),
    controller.getVoterElectionDetail
  );

  router.get(
    '/elections/:electionId/eligibility',
    validateParams(voterElectionIdParamSchema),
    controller.getVoterElectionEligibility
  );

  router.get(
    '/elections/:electionId/ballot',
    validateParams(voterElectionIdParamSchema),
    controller.getBallot
  );

  router.post(
    '/elections/:electionId/participation',
    ...(shouldRateLimit ? [participationLimiter] : []),
    authMiddleware.requireCsrf,
    validateParams(voterElectionIdParamSchema),
    validateBody(participationConfirmBodySchema),
    controller.confirmParticipation
  );

  router.get('/participation', controller.listParticipationHistory);

  router.get(
    '/elections/:electionId/participation',
    validateParams(voterElectionIdParamSchema),
    controller.getParticipationForElection
  );

  return router;
}
