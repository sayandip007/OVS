import type { Request, Response, NextFunction } from 'express';
import { z, type ZodTypeAny } from 'zod';
import {
  ValidationProblemError,
  type InvalidParamItem,
} from '../errors/problemDetails.js';

export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, 'page must be an integer >= 1')
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be between 1 and 200')
    .max(200, 'limit must be between 1 and 200')
    .default(50),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface RequestValidationSchemas {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
}

declare global {
  namespace Express {
    interface Request {
      validated?: {
        params?: unknown;
        query?: unknown;
        body?: unknown;
      };
    }
  }
}

export function validateRequest(schemas: RequestValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const invalidParams: InvalidParamItem[] = [];
    req.validated = {};

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          invalidParams.push({
            name: issue.path.join('.') || 'params',
            reason: issue.message,
          });
        }
      } else {
        req.validated.params = parsed.data;
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          invalidParams.push({
            name: issue.path.join('.') || 'query',
            reason: issue.message,
          });
        }
      } else {
        req.validated.query = parsed.data;
      }
    }

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          invalidParams.push({
            name: issue.path.join('.') || 'body',
            reason: issue.message,
          });
        }
      } else {
        req.validated.body = parsed.data;
      }
    }

    if (invalidParams.length > 0) {
      next(
        new ValidationProblemError(
          'One or more request parameters failed validation.',
          invalidParams
        )
      );
      return;
    }

    next();
  };
}

export function validateBody(schema: ZodTypeAny) {
  return validateRequest({ body: schema });
}

export function validateParams(schema: ZodTypeAny) {
  return validateRequest({ params: schema });
}

export function validateQuery(schema: ZodTypeAny) {
  return validateRequest({ query: schema });
}
