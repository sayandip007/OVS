import { Prisma } from '@prisma/client';

export interface InvalidParamItem {
  name: string;
  reason: string;
}

export interface ProblemDetailsPayload {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  requestId: string;
  timestamp: string;
  invalidParams?: InvalidParamItem[];
}

export class AppProblemError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly title: string;
  public readonly type: string;
  public readonly invalidParams?: InvalidParamItem[];

  constructor(options: {
    status: number;
    code: string;
    title: string;
    detail: string;
    type?: string;
    invalidParams?: InvalidParamItem[];
  }) {
    super(options.detail);
    this.name = this.constructor.name;
    this.status = options.status;
    this.code = options.code;
    this.title = options.title;
    this.type =
      options.type ??
      `https://ovs.eci.gov.in/errors/${options.code.toLowerCase().replace(/_/g, '-')}`;
    this.invalidParams = options.invalidParams;
  }

  toProblemDetails(instance = '', requestId = 'req_unknown'): ProblemDetailsPayload {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.message,
      instance,
      code: this.code,
      requestId,
      timestamp: new Date().toISOString(),
      ...(this.invalidParams && this.invalidParams.length > 0
        ? { invalidParams: this.invalidParams }
        : {}),
    };
  }
}

export class ValidationProblemError extends AppProblemError {
  constructor(detail = 'One or more request parameters failed validation.', invalidParams?: InvalidParamItem[]) {
    super({
      status: 400,
      code: 'VALIDATION_FAILED',
      title: 'Validation Failed',
      detail,
      type: 'https://ovs.eci.gov.in/errors/validation-failed',
      invalidParams,
    });
  }
}

export class NotFoundProblemError extends AppProblemError {
  constructor(resourceName: string, identifier?: string) {
    const detail = identifier
      ? `${resourceName} '${identifier}' was not found.`
      : `${resourceName} was not found.`;
    super({
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      title: 'Resource Not Found',
      detail,
      type: 'https://ovs.eci.gov.in/errors/resource-not-found',
    });
  }
}

export class ConflictProblemError extends AppProblemError {
  constructor(detail: string, code = 'RESOURCE_CONFLICT') {
    super({
      status: 409,
      code,
      title: 'Resource Conflict',
      detail,
      type: 'https://ovs.eci.gov.in/errors/resource-conflict',
    });
  }
}

export class UnauthorizedProblemError extends AppProblemError {
  constructor(detail = 'Authentication is required to access this resource.') {
    super({
      status: 401,
      code: 'UNAUTHORIZED',
      title: 'Unauthorized',
      detail,
      type: 'https://ovs.eci.gov.in/errors/unauthorized',
    });
  }
}

export class ForbiddenProblemError extends AppProblemError {
  constructor(detail = 'You do not have permission to access this resource.', code = 'FORBIDDEN') {
    super({
      status: 403,
      code,
      title: 'Forbidden',
      detail,
      type: 'https://ovs.eci.gov.in/errors/forbidden',
    });
  }
}

export class CsrfProblemError extends AppProblemError {
  constructor(detail = 'A valid anti-CSRF token is required in the X-CSRF-Token header.') {
    super({
      status: 403,
      code: 'CSRF_TOKEN_INVALID',
      title: 'Invalid or Missing CSRF Token',
      detail,
      type: 'https://ovs.eci.gov.in/errors/csrf-token-invalid',
    });
  }
}

export class ForbiddenOriginProblemError extends AppProblemError {
  constructor(origin?: string) {
    super({
      status: 403,
      code: 'CORS_ORIGIN_FORBIDDEN',
      title: 'Forbidden Origin',
      detail: origin
        ? `Origin '${origin}' is not permitted by CORS policy.`
        : 'Request origin is not permitted by CORS policy.',
      type: 'https://ovs.eci.gov.in/errors/cors-origin-forbidden',
    });
  }
}

export class RateLimitProblemError extends AppProblemError {
  constructor(detail = 'Rate limit exceeded for public read API. Please retry shortly.') {
    super({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      title: 'Too Many Requests',
      detail,
      type: 'https://ovs.eci.gov.in/errors/rate-limit-exceeded',
    });
  }
}

export class ServiceUnavailableProblemError extends AppProblemError {
  constructor(detail = 'Database or dependent upstream service is temporarily unavailable.') {
    super({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      title: 'Service Unavailable',
      detail,
      type: 'https://ovs.eci.gov.in/errors/service-unavailable',
    });
  }
}

export class InternalServerProblemError extends AppProblemError {
  constructor(detail = 'An unexpected error occurred while processing the request.') {
    super({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      title: 'Internal Server Error',
      detail,
      type: 'https://ovs.eci.gov.in/errors/internal-server-error',
    });
  }
}

export function translatePrismaError(err: unknown): AppProblemError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return new AppProblemError({
        status: 409,
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        title: 'Unique Constraint Violation',
        detail: 'A record with the provided unique identifier already exists.',
        type: 'https://ovs.eci.gov.in/errors/unique-constraint-violation',
      });
    }
    if (err.code === 'P2003') {
      return new AppProblemError({
        status: 400,
        code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
        title: 'Foreign Key Constraint Violation',
        detail: 'Referenced parent record does not exist or violates hierarchy integrity.',
        type: 'https://ovs.eci.gov.in/errors/foreign-key-constraint-violation',
      });
    }
    if (err.code === 'P2025') {
      return new NotFoundProblemError('Record');
    }
  }
  return null;
}
