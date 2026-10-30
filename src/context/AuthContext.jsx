import React, { createContext, useContext, useState, useCallback } from 'react';
import { STORAGE_KEYS, DEMO_OTP_CODES, OTP_CONFIG } from '../utils/constants';
import { storageService } from '../services/storageService';
import { INITIAL_ADMIN_OFFICERS } from '../data/voters';
import { useElection } from './ElectionContext';

const AuthContext = createContext(null);

/**
 * Pure helper to look up a demo voter by EPIC reference, Voter ID, or Mobile Number.
 */
export function findVoterByLoginIdentifier(voters = [], identifier = '', mobile = '') {
  const trimmedId = String(identifier || '').trim().toUpperCase();
  const trimmedMobile = String(mobile || '').trim();

  if (!trimmedId && !trimmedMobile) {
    return {
      ok: false,
      error: 'Please enter your Demo EPIC / Voter ID or registered mobile number.',
    };
  }

  const found = voters.find((v) => {
    const matchesIdentifier =
      trimmedId &&
      ((v.epicRef || '').toUpperCase() === trimmedId ||
        (v.epicReference || '').toUpperCase() === trimmedId ||
        (v.voterRef || '').toUpperCase() === trimmedId ||
        (v.id || '').toUpperCase() === trimmedId ||
        (v.voterId || '').toUpperCase() === trimmedId ||
        String(v.legacyLoginId || '').toUpperCase() === trimmedId ||
        v.mobile === trimmedId ||
        v.altMobile === trimmedId);

    const matchesMobile =
      trimmedMobile &&
      (v.mobile === trimmedMobile || v.altMobile === trimmedMobile);

    if (trimmedId && trimmedMobile) {
      return matchesIdentifier && matchesMobile;
    }
    return matchesIdentifier || matchesMobile;
  });

  if (!found) {
    return {
      ok: false,
      error:
        'Unknown demo voter. Check the Demo Account Login Guide on this page (e.g., DEMO-EPIC-001 / WBX1234567 or Mobile 9876543210).',
    };
  }

  return { ok: true, voter: found };
}

/**
 * Pure helper to create a simulated OTP challenge with expiry and attempt tracking.
 */
export function createSimulatedOtpChallenge({
  voterId,
  isResend = false,
  now = Date.now(),
  expiryMs = OTP_CONFIG.EXPIRY_MS,
  maxAttempts = OTP_CONFIG.MAX_ATTEMPTS,
}) {
  const otpCode = isResend ? DEMO_OTP_CODES.RESEND : DEMO_OTP_CODES.PRIMARY;
  return {
    voterId,
    otpCode,
    issuedAt: now,
    expiresAt: now + expiryMs,
    attemptsUsed: 0,
    maxAttempts,
    locked: false,
  };
}

/**
 * Pure helper to verify an OTP input against a challenge (enforcing expiry and attempt limit).
 */
export function verifySimulatedOtpChallenge(
  challenge,
  otpInput,
  now = Date.now()
) {
  if (!challenge) {
    return {
      ok: false,
      error: 'No active OTP challenge found. Please request a new Demo OTP.',
      challenge: null,
    };
  }

  if (challenge.locked || challenge.attemptsUsed >= challenge.maxAttempts) {
    return {
      ok: false,
      error: `Maximum OTP verification attempts (${challenge.maxAttempts}) exceeded. Please click "Resend Demo OTP" to generate a new code.`,
      challenge: { ...challenge, locked: true },
    };
  }

  if (now > challenge.expiresAt) {
    return {
      ok: false,
      error:
        'This Demo OTP has expired. Please click "Resend Demo OTP" to generate a fresh code.',
      challenge,
    };
  }

  const trimmedOtp = String(otpInput || '').trim();
  const isMatch =
    trimmedOtp === challenge.otpCode ||
    trimmedOtp === DEMO_OTP_CODES.PRIMARY ||
    trimmedOtp === DEMO_OTP_CODES.RESEND;

  if (!isMatch) {
    const nextAttempts = challenge.attemptsUsed + 1;
    const isNowLocked = nextAttempts >= challenge.maxAttempts;
    const remaining = Math.max(0, challenge.maxAttempts - nextAttempts);
    return {
      ok: false,
      error: isNowLocked
        ? `Invalid OTP. Maximum attempts (${challenge.maxAttempts}) reached. Please resend a new Demo OTP.`
        : `Invalid Demo OTP entered. ${remaining} attempt(s) remaining.`,
      challenge: {
        ...challenge,
        attemptsUsed: nextAttempts,
        locked: isNowLocked,
      },
    };
  }

  return {
    ok: true,
    challenge: {
      ...challenge,
      verifiedAt: now,
    },
  };
}

function loadValidSession() {
  const fallback = {
    role: null,
    voterId: null,
    adminId: null,
    expiresAt: null,
  };
  const saved = storageService.getSessionItem(STORAGE_KEYS.SESSION_AUTH, fallback);
  if (saved?.expiresAt && Date.now() > saved.expiresAt) {
    storageService.setSessionItem(STORAGE_KEYS.SESSION_AUTH, fallback);
    return fallback;
  }
  return saved || fallback;
}

export function AuthProvider({ children }) {
  const { voters } = useElection();

  const [session, setSession] = useState(() => loadValidSession());
  const [otpChallenge, setOtpChallenge] = useState(null);

  const updateSession = useCallback((nextSession) => {
    storageService.setSessionItem(STORAGE_KEYS.SESSION_AUTH, nextSession);
    setSession(nextSession);
  }, []);

  const verifyVoterCredentials = useCallback(
    (identifier, mobile = '') => {
      return findVoterByLoginIdentifier(voters, identifier, mobile);
    },
    [voters]
  );

  const completeVoterLogin = useCallback(
    (voterId, customDurationMs = OTP_CONFIG.SESSION_DURATION_MS) => {
      const now = Date.now();
      updateSession({
        role: 'VOTER',
        voterId,
        adminId: null,
        authenticatedAt: new Date(now).toISOString(),
        expiresAt: now + customDurationMs,
      });
    },
    [updateSession]
  );

  const requestVoterOtp = useCallback(
    ({ voterIdentifier, phoneNumber = '', isResend = false, customExpiryMs }) => {
      const check = verifyVoterCredentials(voterIdentifier, phoneNumber);
      if (!check.ok) return check;
      const challenge = createSimulatedOtpChallenge({
        voterId: check.voter.id || check.voter.voterId,
        isResend,
        expiryMs: customExpiryMs || OTP_CONFIG.EXPIRY_MS,
      });
      setOtpChallenge(challenge);
      return {
        ok: true,
        voter: check.voter,
        otpCode: challenge.otpCode,
        challenge,
      };
    },
    [verifyVoterCredentials]
  );

  const verifyVoterOtp = useCallback(
    ({
      voterIdentifier,
      phoneNumber = '',
      otpInput,
      expectedOtp,
      now = Date.now(),
    }) => {
      const check = verifyVoterCredentials(voterIdentifier, phoneNumber);
      if (!check.ok) return check;

      const activeChallenge =
        otpChallenge ||
        createSimulatedOtpChallenge({
          voterId: check.voter.id || check.voter.voterId,
          isResend: expectedOtp === DEMO_OTP_CODES.RESEND,
        });

      const verification = verifySimulatedOtpChallenge(
        activeChallenge,
        otpInput,
        now
      );
      setOtpChallenge(verification.challenge);

      if (!verification.ok) {
        return {
          ok: false,
          error: verification.error,
          attemptsRemaining: verification.challenge
            ? Math.max(
                0,
                verification.challenge.maxAttempts -
                  verification.challenge.attemptsUsed
              )
            : 0,
          locked: Boolean(verification.challenge?.locked),
        };
      }

      completeVoterLogin(check.voter.id || check.voter.voterId);
      setOtpChallenge(null);
      return { ok: true, voter: check.voter };
    },
    [verifyVoterCredentials, otpChallenge, completeVoterLogin]
  );

  const switchActiveVoter = useCallback(
    (voterId) => {
      const exists = voters.some((v) => (v.id || v.voterId) === voterId);
      if (!exists) return false;
      completeVoterLogin(voterId);
      return true;
    },
    [voters, completeVoterLogin]
  );

  const verifyAdminCredentials = useCallback((officerId, mobile) => {
    const trimmedId = String(officerId || '').trim().toUpperCase();
    const trimmedMobile = String(mobile || '').trim();

    const found = INITIAL_ADMIN_OFFICERS.find(
      (o) =>
        (String(o.officerId || o.officerCode || '').toUpperCase() === trimmedId ||
          String(o.altOfficerId || '').toUpperCase() === trimmedId ||
          String(o.id || '').toUpperCase() === trimmedId) &&
        o.mobile === trimmedMobile
    );

    if (!found) {
      return {
        ok: false,
        error:
          'Invalid ECI Officer credentials. Use Officer ID 1234 (or ECI001) and Mobile 9876543210.',
      };
    }

    return { ok: true, admin: found, officer: found };
  }, []);

  const completeAdminLogin = useCallback(
    (adminId = 'ECI-ADMIN-001') => {
      const now = Date.now();
      updateSession({
        role: 'ADMIN',
        voterId: null,
        adminId,
        authenticatedAt: new Date(now).toISOString(),
        expiresAt: now + OTP_CONFIG.SESSION_DURATION_MS,
      });
    },
    [updateSession]
  );

  const requestAdminOtp = useCallback(
    ({ officerIdentifier, phoneNumber, isResend = false }) => {
      const check = verifyAdminCredentials(officerIdentifier, phoneNumber);
      if (!check.ok) return check;
      const otpCode = isResend ? DEMO_OTP_CODES.RESEND : DEMO_OTP_CODES.PRIMARY;
      return { ok: true, officer: check.admin, otpCode };
    },
    [verifyAdminCredentials]
  );

  const verifyAdminOtp = useCallback(
    ({ officerIdentifier, phoneNumber, otpInput, expectedOtp }) => {
      const check = verifyAdminCredentials(officerIdentifier, phoneNumber);
      if (!check.ok) return check;
      const validCodes = [
        expectedOtp,
        DEMO_OTP_CODES.PRIMARY,
        DEMO_OTP_CODES.RESEND,
      ].filter(Boolean);
      if (!validCodes.includes(String(otpInput || '').trim())) {
        return {
          ok: false,
          error: 'Invalid 6-digit Officer OTP. Use 123456 (or 654321 if resent).',
        };
      }
      completeAdminLogin(check.admin.id);
      return {
        ok: true,
        officer: {
          ...check.admin,
          fullName:
            check.admin.name ||
            check.admin.fullName ||
            'Chief Returning Officer',
        },
      };
    },
    [verifyAdminCredentials, completeAdminLogin]
  );

  const logout = useCallback(() => {
    setOtpChallenge(null);
    updateSession({
      role: null,
      voterId: null,
      adminId: null,
      expiresAt: null,
    });
  }, [updateSession]);

  const currentAdmin =
    session.role === 'ADMIN'
      ? INITIAL_ADMIN_OFFICERS.find((a) => a.id === session.adminId) ||
        INITIAL_ADMIN_OFFICERS[0]
      : null;

  const isVoter = session.role === 'VOTER';
  const isAdmin = session.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        session,
        otpChallenge,
        isAuthenticated: Boolean(session.role),
        isVoter,
        isAdmin,
        isVoterAuthenticated: isVoter,
        isAdminAuthenticated: isAdmin,
        activeVoterId: session.voterId,
        currentAdmin,
        verifyVoterCredentials,
        completeVoterLogin,
        requestVoterOtp,
        verifyVoterOtp,
        switchActiveVoter,
        verifyAdminCredentials,
        completeAdminLogin,
        requestAdminOtp,
        verifyAdminOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
