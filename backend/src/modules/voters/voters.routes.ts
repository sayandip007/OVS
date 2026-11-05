import { Router } from 'express';
import { validateBody } from '../../common/middleware/validate.js';
import { updateVoterProfileSchema } from './voters.schemas.js';
import { VotersRepository } from './voters.repository.js';
import { VotersService } from './voters.service.js';
import { VotersController } from './voters.controller.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { OtpService } from '../auth/otp.service.js';
import { SessionService } from '../auth/session.service.js';

export interface CreateVotersRouterOptions {
  votersService?: VotersService;
  authService?: AuthService;
  sessionService?: SessionService;
}

export function createVotersRouter(options: CreateVotersRouterOptions = {}): Router {
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

  const votersService =
    options.votersService ?? new VotersService(new VotersRepository());
  const controller = new VotersController(votersService);

  // All /voters routes require authentication and VOTER role
  router.use(authMiddleware.authenticate);
  router.use(authMiddleware.requireAuthentication);
  router.use(authMiddleware.requireActiveAccount);
  router.use(authMiddleware.requireRole('VOTER'));

  router.get('/me', controller.getMe);
  router.patch(
    '/me',
    authMiddleware.requireCsrf,
    validateBody(updateVoterProfileSchema),
    controller.patchMe
  );
  router.get('/me/constituencies', controller.getMyConstituencies);

  return router;
}

