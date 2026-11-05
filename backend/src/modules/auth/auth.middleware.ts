import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import type { UserType } from '@prisma/client';
import {
  UnauthorizedProblemError,
  ForbiddenProblemError,
  CsrfProblemError,
} from '../../common/errors/problemDetails.js';
import { AUTH_CONSTANTS } from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.types.js';
import type { AuthService } from './auth.service.js';
import type { SessionService } from './session.service.js';

/**
 * Parses raw Cookie header string into key-value map.
 */
export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

/**
 * Extracts raw session token from cookies or Authorization header fallback (for tests).
 */
export function extractSessionToken(req: Request): string | null {
  // 1. Try parsed cookies (from cookie-parser middleware)
  const reqWithCookies = req as Request & { cookies?: Record<string, string> };
  const cookieVal = reqWithCookies.cookies?.[AUTH_CONSTANTS.SESSION_COOKIE_NAME];
  if (cookieVal) {
    return cookieVal;
  }

  // 2. Parse raw Cookie header
  const rawCookies = parseCookieHeader(req.headers.cookie);
  const rawCookieVal = rawCookies[AUTH_CONSTANTS.SESSION_COOKIE_NAME];
  if (rawCookieVal) {
    return rawCookieVal;
  }

  // 3. Optional x-session-token header
  const xSessionToken = req.headers['x-session-token'];
  if (typeof xSessionToken === 'string' && xSessionToken.length > 0) {
    return xSessionToken.trim();
  }

  // 4. Optional Bearer header fallback (facilitates automated Supertest/script testing)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export function createAuthMiddleware(
  authService: AuthService,
  sessionService: SessionService
) {
  /**
   * Middleware that checks for an active session and populates req.user.
   * Does NOT reject if unauthenticated — sets req.user = undefined.
   */
  const authenticate = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const rawToken = extractSessionToken(req);

      if (!rawToken) {
        authReq.user = undefined;
        return next();
      }

      const authResult = await authService.authenticateSession(rawToken);
      if (!authResult) {
        authReq.user = undefined;
        return next();
      }

      authReq.user = authResult.user;
      authReq.sessionId = authResult.sessionHash;
      authReq.sessionToken = rawToken;
      authReq.csrfToken = sessionService.generateCsrfToken(rawToken);

      next();
    } catch (err) {
      next(err);
    }
  };

  /**
   * Requires that the request has an active authenticated user.
   */
  const requireAuthentication = (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return next(
        new UnauthorizedProblemError('Authentication is required to access this endpoint.')
      );
    }
    next();
  };

  /**
   * Requires that the authenticated user has an active status.
   */
  const requireActiveAccount = (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return next(new UnauthorizedProblemError());
    }
    if (!authReq.user.isActive) {
      return next(
        new ForbiddenProblemError('Your account is deactivated. Access is denied.')
      );
    }
    next();
  };

  /**
   * Enforces Role-Based Access Control on the server.
   */
  const requireRole = (...allowedRoles: UserType[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return next(new UnauthorizedProblemError());
      }
      if (!allowedRoles.includes(authReq.user.userType)) {
        return next(
          new ForbiddenProblemError(
            `Access requires one of the following roles: ${allowedRoles.join(', ')}.`
          )
        );
      }
      next();
    };
  };

  /**
   * Real anti-CSRF protection middleware for cookie-authenticated mutating requests.
   */
  const requireCsrf = (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    const method = req.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next();
    }

    const authReq = req as AuthenticatedRequest;

    // CSRF is enforced for requests carrying a cookie session token
    if (authReq.sessionToken) {
      const clientCsrfToken =
        (req.headers[AUTH_CONSTANTS.CSRF_HEADER_NAME] as string) ||
        (req.headers['x-csrf-token'] as string);

      if (!clientCsrfToken) {
        return next(
          new CsrfProblemError('Missing required X-CSRF-Token header on mutating request.')
        );
      }

      const isValid = sessionService.verifyCsrfToken(
        authReq.sessionToken,
        clientCsrfToken
      );

      if (!isValid) {
        return next(
          new CsrfProblemError('Invalid or expired anti-CSRF token provided.')
        );
      }
    }

    next();
  };

  /**
   * Enforces that the target entity belongs to the authenticated user.
   */
  const requireOwnership = (userIdExtractor: (req: Request) => string | undefined) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return next(new UnauthorizedProblemError());
      }

      const targetUserId = userIdExtractor(req);
      if (targetUserId && targetUserId !== authReq.user.id) {
        return next(
          new ForbiddenProblemError('You can only access or modify your own resources.')
        );
      }

      next();
    };
  };

  return {
    authenticate,
    requireAuthentication,
    requireActiveAccount,
    requireRole,
    requireCsrf,
    requireOwnership,
  };
}

/** Standalone middleware exports for direct route binding or isolated testing */
export function requireAuthentication(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    const err = new UnauthorizedProblemError('Authentication is required to access this endpoint.');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (typeof next === 'function') next();
}

export function requireActiveAccount(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    const err = new UnauthorizedProblemError();
    if (typeof next === 'function') return next(err);
    throw err;
  }
  // Check either isActive boolean or active account status
  const userStatus = (authReq.user as any).status;
  if (userStatus && ['SUSPENDED', 'DEACTIVATED'].includes(userStatus)) {
    const err = new ForbiddenProblemError('Your account is deactivated. Access is denied.');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if ((authReq.user as any).isActive === false) {
    const err = new ForbiddenProblemError('Your account is deactivated. Access is denied.');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (typeof next === 'function') next();
}

export function requireRole(...allowedRoles: (UserType | string)[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      const err = new UnauthorizedProblemError();
      if (typeof next === 'function') return next(err);
      throw err;
    }
    const role = authReq.user.userType || (authReq.user as any).role;
    if (!allowedRoles.includes(role)) {
      const err = new ForbiddenProblemError(
        `Access requires one of the following roles: ${allowedRoles.join(', ')}.`
      );
      if (typeof next === 'function') return next(err);
      throw err;
    }
    if (typeof next === 'function') next();
  };
}

export function requireCsrf(sessionSecret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (typeof next === 'function') return next();
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const sessionToken = authReq.sessionToken || (authReq as any).session?.id;

    const clientCsrfToken =
      (req.headers[AUTH_CONSTANTS.CSRF_HEADER_NAME] as string) ||
      (req.headers['x-csrf-token'] as string);

    if (!clientCsrfToken) {
      const err = new CsrfProblemError('Missing required X-CSRF-Token header on mutating request.');
      if (typeof next === 'function') return next(err);
      throw err;
    }

    if (!sessionToken) {
      const err = new CsrfProblemError('No active session associated with CSRF verification.');
      if (typeof next === 'function') return next(err);
      throw err;
    }

    // Verify token
    const expected = crypto
      .createHmac('sha256', sessionSecret)
      .update(`csrf:${sessionToken}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const clientBuf = Buffer.from(clientCsrfToken, 'hex');

    if (expectedBuf.length !== clientBuf.length || !crypto.timingSafeEqual(expectedBuf, clientBuf)) {
      const err = new CsrfProblemError('Invalid or expired anti-CSRF token provided.');
      if (typeof next === 'function') return next(err);
      throw err;
    }

    if (typeof next === 'function') next();
  };
}
