import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{4,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header('x-request-id');
  const requestId =
    incomingId && SAFE_REQUEST_ID_PATTERN.test(incomingId)
      ? incomingId
      : `req_${randomUUID()}`;

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
