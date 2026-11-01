import type { Request, Response, NextFunction } from 'express';
import {
  AppProblemError,
  InternalServerProblemError,
  NotFoundProblemError,
  ValidationProblemError,
  translatePrismaError,
} from '../errors/problemDetails.js';
import { logger } from './logger.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundProblemError('Route', `${req.method} ${req.originalUrl}`));
}

export function centralizedErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId ?? 'req_unknown';

  const prismaTranslated = translatePrismaError(err);
  const problemError = prismaTranslated ?? (err instanceof AppProblemError ? err : null);

  if (problemError) {
    const payload = problemError.toProblemDetails(req.originalUrl, requestId);
    res.status(problemError.status).type('application/problem+json').json(payload);
    return;
  }

  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: number }).status === 400
  ) {
    const syntaxProblem = new ValidationProblemError(
      'The request body could not be parsed as valid JSON.'
    ).toProblemDetails(req.originalUrl, requestId);
    res.status(400).type('application/problem+json').json(syntaxProblem);
    return;
  }

  logger.error({ err, requestId, path: req.originalUrl }, 'Unhandled API error');

  const internalProblem = new InternalServerProblemError().toProblemDetails(
    req.originalUrl,
    requestId
  );
  res.status(500).type('application/problem+json').json(internalProblem);
}
