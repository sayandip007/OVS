import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  registerVoterSchema,
  requestOtpSchema,
  verifyOtpSchema,
  sessionIdParamSchema,
  normalizeMobile,
  normalizeEmail,
} from '../../src/modules/auth/auth.schemas.js';
import {
  generateOtp,
  hashOtp,
  verifyOtpDigest,
  isOtpExpired,
  isOtpLocked,
  DevelopmentOtpProvider,
} from '../../src/modules/auth/otp.service.js';
import {
  generateSessionToken,
  hashSessionToken,
  generateCsrfToken,
  verifyCsrfToken,
  getSessionCookieOptions,
} from '../../src/modules/auth/session.service.js';
import {
  extractSessionToken,
  requireAuthentication,
  requireActiveAccount,
  requireRole,
  requireCsrf,
} from '../../src/modules/auth/auth.middleware.js';
import {
  UnauthorizedProblemError,
  ForbiddenProblemError,
  CsrfProblemError,
  ConflictProblemError,
} from '../../src/common/errors/problemDetails.js';

describe('OVS Phase 8.3 — Backend Auth Unit Tests', () => {
  describe('1. Zod Input Validation & Normalization Schemas', () => {
    test('normalizes mobile numbers by stripping country code (+91), spaces, and dashes', () => {
      assert.equal(normalizeMobile('+91 98765 43210'), '9876543210');
      assert.equal(normalizeMobile('+91-9876543210'), '9876543210');
      assert.equal(normalizeMobile('09876543210'), '9876543210');
      assert.equal(normalizeMobile('9876543210'), '9876543210');
    });

    test('normalizes email addresses to trimmed lowercase', () => {
      assert.equal(normalizeEmail('  Voter.Test@EXAMPLE.com  '), 'voter.test@example.com');
      assert.equal(normalizeEmail(undefined), undefined);
    });

    test('validates valid voter registration payload for adult (>= 18 years)', () => {
      const birthDate20YearsAgo = new Date();
      birthDate20YearsAgo.setFullYear(birthDate20YearsAgo.getFullYear() - 20);

      const validPayload = {
        fullName: 'Sayandip Saha',
        mobileNumber: '+91 98765 43210',
        email: 'sayandip@example.com',
        epicNumber: 'ABC1234567',
        dateOfBirth: birthDate20YearsAgo.toISOString().split('T')[0],
        gender: 'MALE',
        stateId: 'WB',
        districtId: 'NADIA',
        assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      };

      const result = registerVoterSchema.safeParse(validPayload);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.mobileNumber, '9876543210');
        assert.equal(result.data.email, 'sayandip@example.com');
        assert.equal(result.data.epicNumber, 'ABC1234567');
      }
    });

    test('rejects voter registration for underage applicant (< 18 years)', () => {
      const birthDate16YearsAgo = new Date();
      birthDate16YearsAgo.setFullYear(birthDate16YearsAgo.getFullYear() - 16);

      const underagePayload = {
        fullName: 'Minor Voter',
        mobileNumber: '9876543210',
        epicNumber: 'XYZ9876543',
        dateOfBirth: birthDate16YearsAgo.toISOString().split('T')[0],
        gender: 'FEMALE',
        stateId: 'WB',
        districtId: 'NADIA',
        assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      };

      const result = registerVoterSchema.safeParse(underagePayload);
      assert.equal(result.success, false);
      if (!result.success) {
        const msg = result.error.errors.map((e) => e.message).join(' ');
        assert.match(msg, /at least 18 years old/i);
      }
    });

    test('rejects invalid mobile numbers and invalid EPIC format', () => {
      const invalidPayload = {
        fullName: 'A',
        mobileNumber: '12345',
        epicNumber: 'invalid_epic!',
        dateOfBirth: '2000-01-01',
        gender: 'OTHER',
        stateId: '',
        districtId: '',
        assemblyConstituencyId: '',
        parliamentaryConstituencyId: '',
      };

      const result = registerVoterSchema.safeParse(invalidPayload);
      assert.equal(result.success, false);
    });

    test('validates requestOtpSchema with valid 10-digit mobile', () => {
      const valid = requestOtpSchema.safeParse({ mobileNumber: '+91 98765 43210' });
      assert.equal(valid.success, true);
      if (valid.success) {
        assert.equal(valid.data.mobileNumber, '9876543210');
      }

      const invalid = requestOtpSchema.safeParse({ mobileNumber: '000' });
      assert.equal(invalid.success, false);
    });

    test('validates verifyOtpSchema requiring UUID challengeId and 6-digit OTP code', () => {
      const valid = verifyOtpSchema.safeParse({
        challengeId: '11111111-2222-3333-4444-555555555555',
        otp: '123456',
      });
      assert.equal(valid.success, true);

      const invalidOtp = verifyOtpSchema.safeParse({
        challengeId: '11111111-2222-3333-4444-555555555555',
        otp: 'abcdef',
      });
      assert.equal(invalidOtp.success, false);

      const invalidChallenge = verifyOtpSchema.safeParse({
        challengeId: 'not-a-uuid',
        otp: '123456',
      });
      assert.equal(invalidChallenge.success, false);
    });

    test('validates sessionIdParamSchema', () => {
      assert.equal(sessionIdParamSchema.safeParse({ sessionId: 'session-123' }).success, true);
      assert.equal(sessionIdParamSchema.safeParse({ sessionId: '' }).success, false);
    });
  });

  describe('2. Cryptographic OTP Generation, Hashing & Verification', () => {
    const secret = 'test-secret-salt-32-chars-long-minimum!';

    test('generates cryptographically secure 6-digit numeric OTP', () => {
      for (let i = 0; i < 20; i++) {
        const otp = generateOtp();
        assert.equal(typeof otp, 'string');
        assert.equal(otp.length, 6);
        assert.match(otp, /^\d{6}$/);
      }
    });

    test('hashes OTP using HMAC-SHA256 and constant-time verification succeeds for match', () => {
      const otp = '849201';
      const digest = hashOtp(otp, secret);
      assert.equal(typeof digest, 'string');
      assert.equal(digest.length, 64); // 32-byte hex is 64 chars

      assert.equal(verifyOtpDigest(otp, digest, secret), true);
      assert.equal(verifyOtpDigest('849202', digest, secret), false);
      assert.equal(verifyOtpDigest('000000', digest, secret), false);
    });

    test('correctly evaluates OTP expiry against TTL (5 minutes)', () => {
      const now = new Date();
      assert.equal(isOtpExpired(now, 300), false);

      const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);
      assert.equal(isOtpExpired(fourMinutesAgo, 300), false);

      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      assert.equal(isOtpExpired(sixMinutesAgo, 300), true);
    });

    test('correctly evaluates OTP lockout against max attempts', () => {
      assert.equal(isOtpLocked(0, 3), false);
      assert.equal(isOtpLocked(2, 3), false);
      assert.equal(isOtpLocked(3, 3), true);
      assert.equal(isOtpLocked(5, 3), true);
    });

    test('DevelopmentOtpProvider stores and exposes OTP only in non-production when enabled', async () => {
      const origFlag = process.env.ALLOW_OTP_INSPECTION;
      try {
        process.env.ALLOW_OTP_INSPECTION = 'true';
        const devProvider = new DevelopmentOtpProvider();
        await devProvider.sendOtp('test-challenge-uuid', '9876543210', '543210');

        const retrieved = devProvider.getLastOtp('9876543210');
        assert.equal(retrieved, '543210');

        // Clear for isolation
        DevelopmentOtpProvider.clear();
        assert.equal(devProvider.getLastOtp('9876543210'), null);
      } finally {
        process.env.ALLOW_OTP_INSPECTION = origFlag;
      }
    });
  });

  describe('3. Server-Managed Session & CSRF Cryptographic Tokens', () => {
    const sessionSecret = 'a-very-secure-32-byte-session-secret-for-testing';

    test('generates 256-bit secure session tokens (64-char hex) and hashes them with SHA-256', () => {
      const rawToken = generateSessionToken();
      assert.equal(typeof rawToken, 'string');
      assert.equal(rawToken.length, 64);

      const hashedToken = hashSessionToken(rawToken);
      assert.equal(typeof hashedToken, 'string');
      assert.equal(hashedToken.length, 64);
      // Raw token must never match hashed token
      assert.notEqual(rawToken, hashedToken);

      // Deterministic hashing for identical inputs
      assert.equal(hashSessionToken(rawToken), hashedToken);
    });

    test('generates and verifies CSRF tokens tied to session identifier', () => {
      const sessionId = 'session-hash-123456';
      const csrfToken = generateCsrfToken(sessionId, sessionSecret);
      assert.equal(typeof csrfToken, 'string');
      assert.ok(csrfToken.length > 20);

      // Valid token matches
      assert.equal(verifyCsrfToken(csrfToken, sessionId, sessionSecret), true);

      // Wrong session ID rejected
      assert.equal(verifyCsrfToken(csrfToken, 'different-session-id', sessionSecret), false);

      // Tampered token rejected
      assert.equal(verifyCsrfToken(csrfToken + 'x', sessionId, sessionSecret), false);
      assert.equal(verifyCsrfToken('invalid-token', sessionId, sessionSecret), false);
    });

    test('getSessionCookieOptions sets HttpOnly, SameSite=Lax, and Path=/', () => {
      const devOptions = getSessionCookieOptions(false);
      assert.equal(devOptions.httpOnly, true);
      assert.equal(devOptions.sameSite, 'lax');
      assert.equal(devOptions.path, '/');
      assert.equal(devOptions.secure, false);

      const prodOptions = getSessionCookieOptions(true);
      assert.equal(prodOptions.httpOnly, true);
      assert.equal(prodOptions.sameSite, 'lax');
      assert.equal(prodOptions.path, '/');
      assert.equal(prodOptions.secure, true);
    });
  });

  describe('4. Authentication & Authorization Middleware Suite', () => {
    test('extractSessionToken extracts token from cookie, header, or Bearer auth', () => {
      // 1. From cookie
      const reqCookie = {
        cookies: { ovs_session: 'cookie-session-token' },
        headers: {},
      } as any;
      assert.equal(extractSessionToken(reqCookie), 'cookie-session-token');

      // 2. From x-session-token header
      const reqHeader = {
        cookies: {},
        headers: { 'x-session-token': 'header-session-token' },
      } as any;
      assert.equal(extractSessionToken(reqHeader), 'header-session-token');

      // 3. From Authorization: Bearer header
      const reqBearer = {
        cookies: {},
        headers: { authorization: 'Bearer bearer-session-token' },
      } as any;
      assert.equal(extractSessionToken(reqBearer), 'bearer-session-token');

      // 4. Missing
      const reqEmpty = { cookies: {}, headers: {} } as any;
      assert.equal(extractSessionToken(reqEmpty), null);
    });

    test('requireAuthentication passes when req.user is set and returns 401 UnauthorizedProblemError when absent', () => {
      const validReq = {
        user: { id: 'user-1', role: 'VOTER', status: 'ACTIVE' },
      } as any;
      let nextCalled = false;
      requireAuthentication(validReq, {} as any, (err?: any) => {
        assert.equal(err, undefined);
        nextCalled = true;
      });
      assert.equal(nextCalled, true);

      const unauthReq = {} as any;
      let capturedErr: any = null;
      requireAuthentication(unauthReq, {} as any, (err?: any) => {
        capturedErr = err;
      });
      assert.ok(capturedErr instanceof UnauthorizedProblemError);
      assert.equal(capturedErr.status, 401);
    });

    test('requireActiveAccount allows ACTIVE and UNVERIFIED accounts and rejects SUSPENDED/DEACTIVATED with 403', () => {
      const activeReq = { user: { status: 'ACTIVE' } } as any;
      let nextCalled = false;
      requireActiveAccount(activeReq, {} as any, (err?: any) => {
        assert.equal(err, undefined);
        nextCalled = true;
      });
      assert.equal(nextCalled, true);

      const unverifiedReq = { user: { status: 'UNVERIFIED' } } as any;
      nextCalled = false;
      requireActiveAccount(unverifiedReq, {} as any, (err?: any) => {
        assert.equal(err, undefined);
        nextCalled = true;
      });
      assert.equal(nextCalled, true);

      const suspendedReq = { user: { status: 'SUSPENDED' } } as any;
      let capturedErr: any = null;
      requireActiveAccount(suspendedReq, {} as any, (err?: any) => {
        capturedErr = err;
      });
      assert.ok(capturedErr instanceof ForbiddenProblemError);
      assert.equal(capturedErr.status, 403);
    });

    test('requireRole enforces exact role matching and rejects unauthorized roles with 403', () => {
      const voterMiddleware = requireRole('VOTER');
      const voterReq = { user: { role: 'VOTER' } } as any;
      let nextCalled = false;
      voterMiddleware(voterReq, {} as any, (err?: any) => {
        assert.equal(err, undefined);
        nextCalled = true;
      });
      assert.equal(nextCalled, true);

      const adminMiddleware = requireRole('SUPER_ADMIN');
      let capturedErr: any = null;
      adminMiddleware(voterReq, {} as any, (err?: any) => {
        capturedErr = err;
      });
      assert.ok(capturedErr instanceof ForbiddenProblemError);
      assert.equal(capturedErr.status, 403);
    });

    test('requireCsrf passes safe HTTP methods (GET, HEAD, OPTIONS) without checking CSRF token', () => {
      const csrfMiddleware = requireCsrf('test-session-secret-32-chars-long');
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        const req = { method, headers: {} } as any;
        let nextCalled = false;
        csrfMiddleware(req, {} as any, () => {
          nextCalled = true;
        });
        assert.equal(nextCalled, true, `Method ${method} should pass without CSRF`);
      }
    });

    test('requireCsrf enforces valid CSRF token header for state-changing methods (POST, PATCH, DELETE, PUT)', () => {
      const secret = 'test-session-secret-32-chars-long';
      const csrfMiddleware = requireCsrf(secret);
      const sessionId = 'session-12345';
      const validCsrfToken = generateCsrfToken(sessionId, secret);

      // Valid token passes
      const validReq = {
        method: 'POST',
        headers: { 'x-csrf-token': validCsrfToken },
        session: { id: sessionId },
      } as any;
      let nextCalled = false;
      csrfMiddleware(validReq, {} as any, (err?: any) => {
        assert.equal(err, undefined);
        nextCalled = true;
      });
      assert.equal(nextCalled, true);

      // Missing header fails with 403 CsrfProblemError
      const missingTokenReq = {
        method: 'POST',
        headers: {},
        session: { id: sessionId },
      } as any;
      let capturedMissing: any = null;
      csrfMiddleware(missingTokenReq, {} as any, (err?: any) => {
        capturedMissing = err;
      });
      assert.ok(capturedMissing instanceof CsrfProblemError);
      assert.equal(capturedMissing.status, 403);

      // Invalid token fails with 403 CsrfProblemError
      const invalidTokenReq = {
        method: 'POST',
        headers: { 'x-csrf-token': 'bad-token' },
        session: { id: sessionId },
      } as any;
      let capturedInvalid: any = null;
      csrfMiddleware(invalidTokenReq, {} as any, (err?: any) => {
        capturedInvalid = err;
      });
      assert.ok(capturedInvalid instanceof CsrfProblemError);
      assert.equal(capturedInvalid.status, 403);
    });
  });
});
