import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import type { Request } from 'express';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'req.headers["x-session-token"]',
      'res.headers["set-cookie"]',
      'password',
      'currentPassword',
      'newPassword',
      'passwordHash',
      'otp',
      'otpHash',
      'token',
      'csrfToken',
      'sessionToken',
      'epicNumber',
      'mobileNumber',
      'email',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'ovs-backend',
    phase: '8.2-foundation',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const httpLoggerMiddleware = pinoHttp({
  logger,
  genReqId(req: IncomingMessage) {
    return (req as Request).requestId ?? 'req_unknown';
  },
  customProps(req: IncomingMessage) {
    return {
      requestId: (req as Request).requestId,
    };
  },
});
