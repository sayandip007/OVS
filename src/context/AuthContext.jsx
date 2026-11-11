import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS, DEMO_OTP_CODES, OTP_CONFIG } from '../utils/constants';
import { storageService } from '../services/storageService';
import { INITIAL_ADMIN_OFFICERS } from '../data/voters';
import { useElection } from './ElectionContext';
import { frontendEnv } from '../config/env';
import { apiClient } from '../services/apiClient';
import {
  canAdminAccessRoute,
  canAdminPerformAction,
  getRolePermissions,
  hasAdminPermission as checkAdminPermission,
} from '../services/adminPermissionService';

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
  const [backendUser, setBackendUser] = useState(null);
  const [backendAdmin, setBackendAdmin] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [isAuthInitialized, setIsAuthInitialized] = useState(!frontendEnv.isBackendApiMode);

  const updateSession = useCallback((nextSession) => {
    storageService.setSessionItem(STORAGE_KEYS.SESSION_AUTH, nextSession);
    setSession(nextSession);
  }, []);

  const clearLocalSessionState = useCallback(() => {
    setOtpChallenge(null);
    setBackendUser(null);
    setBackendAdmin(null);
    setCsrfToken(null);
    updateSession({
      role: null,
      voterId: null,
      adminId: null,
      adminRole: null,
      expiresAt: null,
    });
  }, [updateSession]);

  // Register global 401 session-expiration handler in BACKEND_API mode
  useEffect(() => {
    if (!frontendEnv.isBackendApiMode) return undefined;
    apiClient.setUnauthorizedHandler(() => {
      setSessionExpiredNotice(true);
      clearLocalSessionState();
    });
    return () => {
      apiClient.setUnauthorizedHandler(null);
    };
  }, [clearLocalSessionState]);

  // When configured for BACKEND_API mode, probe /api/v1/auth/me to restore live voter or admin session
  useEffect(() => {
    if (!frontendEnv.isBackendApiMode) return undefined;
    let cancelled = false;

    async function checkBackendSession() {
      try {
        const res = await apiClient.auth.getMe();
        if (cancelled) return;
        const userPayload = res?.data?.user || res?.data;

        if (userPayload && userPayload.id) {
          setBackendUser(userPayload);
          const freshCsrf = res?.meta?.csrfToken || res?.data?.csrfToken;
          if (freshCsrf) {
            setCsrfToken(freshCsrf);
          } else {
            try {
              const csrfRes = await apiClient.auth.getCsrf();
              if (!cancelled && csrfRes?.data?.csrfToken) {
                setCsrfToken(csrfRes.data.csrfToken);
              }
            } catch {
              // Non-fatal if CSRF endpoint probe fails
            }
          }

          if (userPayload.userType === 'ADMIN' && userPayload.adminUser) {
            // Fetch full admin profile with resolved permissions & scopes
            let fullAdmin = userPayload.adminUser;
            try {
              const adminRes = await apiClient.admin.getMe();
              if (!cancelled && adminRes?.data?.admin) {
                fullAdmin = adminRes.data.admin;
              }
              if (!cancelled && adminRes?.data?.csrfToken) {
                setCsrfToken(adminRes.data.csrfToken);
              }
            } catch {
              // Keep base adminUser payload if /admin/auth/me unavailable
            }

            if (!cancelled) {
              setBackendAdmin(fullAdmin);
              updateSession({
                role: 'ADMIN',
                voterId: null,
                adminId: fullAdmin.id,
                adminRole: fullAdmin.role,
                authenticatedAt: new Date().toISOString(),
                expiresAt: Date.now() + OTP_CONFIG.SESSION_DURATION_MS,
              });
            }
          } else {
            const voterProfile = res?.data?.voterProfile || userPayload.voterProfile;
            const assignedId = voterProfile?.id || userPayload.id;
            updateSession({
              role: 'VOTER',
              voterId: assignedId,
              adminId: null,
              authenticatedAt: new Date().toISOString(),
              expiresAt: Date.now() + OTP_CONFIG.SESSION_DURATION_MS,
            });
          }
        }
      } catch {
        // Backend session not present or expired
      } finally {
        if (!cancelled) {
          setIsAuthInitialized(true);
        }
      }
    }

    checkBackendSession();
    return () => {
      cancelled = true;
    };
  }, [updateSession]);

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
        (!trimmedMobile || o.mobile === trimmedMobile)
    );

    if (!found) {
      return {
        ok: false,
        error:
          'Invalid ECI Officer credentials. Select one of the 5 demo officer roles or use Officer ID 1234 (ECI001) and Mobile 9876543210.',
      };
    }

    return { ok: true, admin: found, officer: found };
  }, []);

  const completeAdminLogin = useCallback(
    (adminId = 'ECI-ADMIN-001') => {
      const target =
        INITIAL_ADMIN_OFFICERS.find((a) => a.id === adminId) ||
        INITIAL_ADMIN_OFFICERS[0];
      const now = Date.now();
      updateSession({
        role: 'ADMIN',
        voterId: null,
        adminId: target.id,
        adminRole: target.adminRole,
        authenticatedAt: new Date(now).toISOString(),
        expiresAt: now + OTP_CONFIG.SESSION_DURATION_MS,
      });
    },
    [updateSession]
  );

  const switchActiveAdmin = useCallback(
    (adminId) => {
      const found = INITIAL_ADMIN_OFFICERS.find((a) => a.id === adminId);
      if (!found) return { ok: false };
      completeAdminLogin(found.id);
      return { ok: true, officer: found };
    },
    [completeAdminLogin]
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

  const loginAdminWithPassword = useCallback(
    async ({ identifier, password }) => {
      const res = await apiClient.admin.login({ identifier, password });
      const adminDto = res?.data?.admin;
      const freshCsrf = res?.data?.csrfToken;
      if (!adminDto) {
        throw new Error('Unexpected login response from administrator API.');
      }

      setSessionExpiredNotice(false);
      setBackendAdmin(adminDto);
      setBackendUser({
        id: adminDto.userId,
        identifier: adminDto.officerCode,
        userType: 'ADMIN',
        role: adminDto.role,
        isActive: adminDto.isActive,
        adminUser: adminDto,
      });
      if (freshCsrf) {
        setCsrfToken(freshCsrf);
      }

      const now = Date.now();
      updateSession({
        role: 'ADMIN',
        voterId: null,
        adminId: adminDto.id,
        adminRole: adminDto.role,
        authenticatedAt: new Date(now).toISOString(),
        expiresAt: now + OTP_CONFIG.SESSION_DURATION_MS,
      });

      return adminDto;
    },
    [updateSession]
  );

  const refreshAdminSession = useCallback(async () => {
    if (!frontendEnv.isBackendApiMode) return null;
    const res = await apiClient.admin.getMe();
    const adminDto = res?.data?.admin;
    if (adminDto) {
      setBackendAdmin(adminDto);
      if (res?.data?.csrfToken) setCsrfToken(res.data.csrfToken);
    }
    return adminDto;
  }, []);

  const logout = useCallback(async () => {
    if (frontendEnv.isBackendApiMode && csrfToken) {
      try {
        if (session.role === 'ADMIN') {
          await apiClient.admin.logout(csrfToken);
        } else {
          await apiClient.auth.logout(csrfToken);
        }
      } catch {
        // Safe to ignore on frontend logout
      }
    }
    setSessionExpiredNotice(false);
    clearLocalSessionState();
  }, [clearLocalSessionState, csrfToken, session.role]);

  const logoutAll = useCallback(async () => {
    if (frontendEnv.isBackendApiMode && csrfToken) {
      try {
        if (session.role === 'ADMIN') {
          await apiClient.admin.logoutAll(csrfToken);
        } else {
          await apiClient.auth.logoutAll(csrfToken);
        }
      } catch {
        // Safe to ignore on frontend logout
      }
    }
    setSessionExpiredNotice(false);
    clearLocalSessionState();
  }, [clearLocalSessionState, csrfToken, session.role]);

  const currentAdmin =
    session.role === 'ADMIN'
      ? frontendEnv.isBackendApiMode
        ? backendAdmin
        : INITIAL_ADMIN_OFFICERS.find((a) => a.id === session.adminId) ||
          INITIAL_ADMIN_OFFICERS[0]
      : null;

  const isVoter = session.role === 'VOTER';
  const isAdmin = session.role === 'ADMIN' && Boolean(currentAdmin);

  const adminPermissions = currentAdmin
    ? currentAdmin.permissions || getRolePermissions(currentAdmin.role || currentAdmin.adminRole)
    : [];

  const hasAdminPermission = useCallback(
    (permission) => checkAdminPermission(currentAdmin, permission),
    [currentAdmin]
  );

  const canAccessAdminRoute = useCallback(
    (routePath) => canAdminAccessRoute(currentAdmin, routePath),
    [currentAdmin]
  );

  const canPerformAdminAction = useCallback(
    (actionType, domain, targetScope) =>
      canAdminPerformAction(currentAdmin, actionType, domain, targetScope),
    [currentAdmin]
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        otpChallenge,
        backendUser,
        backendAdmin,
        csrfToken,
        isBackendApi: frontendEnv.isBackendApiMode,
        isBackendApiMode: frontendEnv.isBackendApiMode,
        isAuthInitialized,
        sessionExpiredNotice,
        clearSessionExpiredNotice: () => setSessionExpiredNotice(false),
        setCsrfToken,
        isAuthenticated: Boolean(session.role),
        isVoter,
        isAdmin,
        isVoterAuthenticated: isVoter,
        isAdminAuthenticated: isAdmin,
        activeVoterId: session.voterId,
        currentAdmin,
        adminPermissions,
        hasAdminPermission,
        adminOfficers: INITIAL_ADMIN_OFFICERS,
        verifyVoterCredentials,
        completeVoterLogin,
        requestVoterOtp,
        verifyVoterOtp,
        switchActiveVoter,
        verifyAdminCredentials,
        completeAdminLogin,
        loginAdminWithPassword,
        refreshAdminSession,
        switchActiveAdmin,
        requestAdminOtp,
        verifyAdminOtp,
        canAccessAdminRoute,
        canPerformAdminAction,
        logout,
        logoutAll,
        logoutAdmin: logout,
        logoutVoter: logout,
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
