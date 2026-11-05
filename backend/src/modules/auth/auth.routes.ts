import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody, validateParams } from '../../common/middleware/validate.js';
import { RateLimitProblemError } from '../../common/errors/problemDetails.js';
import { AUTH_CONSTANTS } from './auth.constants.js';
import {
  registerVoterSchema,
  requestOtpSchema,
  verifyOtpSchema,
  sessionIdParamSchema,
} from './auth.schemas.js';
import { AuthRepository } from './auth.repository.js';
import { OtpService, DevelopmentOtpProvider, type OtpDeliveryProvider } from './otp.service.js';
import { SessionService } from './session.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { createAuthMiddleware } from './auth.middleware.js';

export interface CreateAuthRouterOptions {
  authRepository?: AuthRepository;
  otpProvider?: OtpDeliveryProvider;
  sessionSecret?: string;
  enableRateLimit?: boolean;
}

export function createAuthRouter(options: CreateAuthRouterOptions = {}): Router {
  const router = Router();

  const sessionSecret =
    options.sessionSecret ??
    process.env.SESSION_SECRET ??
    'dev_session_secret_32_characters_long_min';

  const authRepository = options.authRepository ?? new AuthRepository();
  const otpProvider = options.otpProvider ?? new DevelopmentOtpProvider();
  const otpService = new OtpService(otpProvider);
  const sessionService = new SessionService(sessionSecret);
  const authService = new AuthService(
    authRepository,
    otpService,
    sessionService,
    sessionSecret
  );

  const controller = new AuthController(authService, sessionService);
  const authMiddleware = createAuthMiddleware(authService, sessionService);

  // Dedicated Rate Limiter for OTP Requests (15 requests per 15 min window)
  const otpRequestLimiter =
    options.enableRateLimit !== false && process.env.NODE_ENV !== 'test'
      ? rateLimit({
          windowMs: 15 * 60 * 1000,
          limit: AUTH_CONSTANTS.OTP_REQUEST_RATE_LIMIT_MAX,
          standardHeaders: 'draft-7',
          legacyHeaders: false,
          handler(req, res) {
            const err = new RateLimitProblemError(
              'Too many OTP requests from this client. Please wait 15 minutes before requesting again.'
            );
            res
              .status(429)
              .type('application/problem+json')
              .json(err.toProblemDetails(req.originalUrl, req.requestId ?? 'req_unknown'));
          },
        })
      : (_req: any, _res: any, next: any) => next();

  // Dedicated Rate Limiter for OTP Verifications (20 attempts per 15 min window)
  const otpVerifyLimiter =
    options.enableRateLimit !== false && process.env.NODE_ENV !== 'test'
      ? rateLimit({
          windowMs: 15 * 60 * 1000,
          limit: AUTH_CONSTANTS.OTP_VERIFY_RATE_LIMIT_MAX,
          standardHeaders: 'draft-7',
          legacyHeaders: false,
          handler(req, res) {
            const err = new RateLimitProblemError(
              'Too many OTP verification attempts. Please wait 15 minutes before trying again.'
            );
            res
              .status(429)
              .type('application/problem+json')
              .json(err.toProblemDetails(req.originalUrl, req.requestId ?? 'req_unknown'));
          },
        })
      : (_req: any, _res: any, next: any) => next();

  // Public Endpoints
  router.post('/register', validateBody(registerVoterSchema), controller.register);
  router.post(
    '/otp/request',
    otpRequestLimiter,
    validateBody(requestOtpSchema),
    controller.requestOtp
  );
  router.post(
    '/otp/verify',
    otpVerifyLimiter,
    validateBody(verifyOtpSchema),
    controller.verifyOtp
  );
  router.get('/csrf', authMiddleware.authenticate, controller.getCsrf);

  // Authenticated Session Endpoints
  router.get(
    '/me',
    authMiddleware.authenticate,
    authMiddleware.requireAuthentication,
    controller.getMe
  );

  router.get(
    '/sessions',
    authMiddleware.authenticate,
    authMiddleware.requireAuthentication,
    controller.listSessions
  );

  router.delete(
    '/sessions/:sessionId',
    authMiddleware.authenticate,
    authMiddleware.requireAuthentication,
    authMiddleware.requireCsrf,
    validateParams(sessionIdParamSchema),
    controller.revokeSession
  );

  router.post(
    '/logout',
    authMiddleware.authenticate,
    authMiddleware.requireAuthentication,
    authMiddleware.requireCsrf,
    controller.logout
  );

  router.post(
    '/logout-all',
    authMiddleware.authenticate,
    authMiddleware.requireAuthentication,
    authMiddleware.requireCsrf,
    controller.logoutAll
  );

  // Development-only inspector endpoint
  if (process.env.NODE_ENV !== 'production') {
    router.get('/dev/otp/:identifier', controller.devInspectOtp);
  }

  return router;
}

