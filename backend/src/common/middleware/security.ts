import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import {
  ForbiddenOriginProblemError,
  RateLimitProblemError,
} from '../errors/problemDetails.js';

export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
}

export function createCorsMiddleware(allowedOriginsInput: string | string[]) {
  const allowedOrigins = Array.isArray(allowedOriginsInput)
    ? allowedOriginsInput
    : allowedOriginsInput
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

  const corsHandler = cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Request-Id', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestOrigin = req.header('origin');
    if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
      next(new ForbiddenOriginProblemError(requestOrigin));
      return;
    }
    corsHandler(req, res, next);
  };
}

export function createApiRateLimiter(maxRequests = 120) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler(req: Request, res: Response) {
      const err = new RateLimitProblemError();
      const problem = err.toProblemDetails(
        req.originalUrl,
        req.requestId ?? 'req_unknown'
      );
      res.status(429).type('application/problem+json').json(problem);
    },
  });
}
