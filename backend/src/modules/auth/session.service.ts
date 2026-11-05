import crypto from 'node:crypto';
import type { Response, CookieOptions } from 'express';
import { AUTH_CONSTANTS } from './auth.constants.js';

export class SessionService {
  constructor(private readonly sessionSecret: string) {}

  /**
   * Generates a 64-character cryptographically random session token (256 bits).
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Computes the SHA-256 digest of a session token for safe database storage in UserSession.id.
   * Raw session tokens are never stored in the database.
   */
  hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Generates a cryptographically random, session-bound anti-CSRF token.
   * Derived from HMAC-SHA256(sessionToken, sessionSecret).
   */
  generateCsrfToken(sessionToken: string): string {
    return crypto
      .createHmac('sha256', this.sessionSecret)
      .update(`csrf:${sessionToken}`)
      .digest('hex');
  }

  /**
   * Verifies an incoming CSRF token against the active session token using constant-time comparison.
   */
  verifyCsrfToken(sessionToken: string, clientToken: string): boolean {
    if (!sessionToken || !clientToken) return false;
    const expected = this.generateCsrfToken(sessionToken);
    if (clientToken.length !== expected.length) {
      return false;
    }

    const expectedBuf = Buffer.from(expected, 'hex');
    const clientBuf = Buffer.from(clientToken, 'hex');

    if (expectedBuf.length !== clientBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, clientBuf);
  }

  /**
   * Returns environment-appropriate secure cookie options for the session cookie.
   */
  getCookieOptions(customMaxAgeMs?: number): CookieOptions {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: AUTH_CONSTANTS.SESSION_COOKIE_PATH,
      maxAge: customMaxAgeMs ?? AUTH_CONSTANTS.SESSION_DURATION_MS,
    };
  }

  /**
   * Attaches the HttpOnly session cookie to an Express response.
   */
  setSessionCookie(res: Response, rawSessionToken: string): void {
    res.cookie(
      AUTH_CONSTANTS.SESSION_COOKIE_NAME,
      rawSessionToken,
      this.getCookieOptions()
    );
  }

  /**
   * Clears the session cookie from the browser.
   */
  clearSessionCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie(AUTH_CONSTANTS.SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: AUTH_CONSTANTS.SESSION_COOKIE_PATH,
    });
  }
}

/** Standalone convenience wrappers for unit testing and functional usage */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function generateCsrfToken(sessionId: string, sessionSecret: string): string {
  return crypto
    .createHmac('sha256', sessionSecret)
    .update(`csrf:${sessionId}`)
    .digest('hex');
}

export function verifyCsrfToken(
  clientToken: string,
  sessionId: string,
  sessionSecret: string
): boolean {
  if (!sessionId || !clientToken) return false;
  const expected = generateCsrfToken(sessionId, sessionSecret);
  if (clientToken.length !== expected.length) {
    return false;
  }
  const expectedBuf = Buffer.from(expected, 'hex');
  const clientBuf = Buffer.from(clientToken, 'hex');

  if (expectedBuf.length !== clientBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, clientBuf);
}

export function getSessionCookieOptions(isProduction: boolean, customMaxAgeMs?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: AUTH_CONSTANTS.SESSION_COOKIE_PATH,
    maxAge: customMaxAgeMs ?? AUTH_CONSTANTS.SESSION_DURATION_MS,
  };
}
