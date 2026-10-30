import React, { createContext, useContext, useState, useCallback } from 'react';
import { STORAGE_KEYS, DEMO_OTP_CODES } from '../utils/constants';
import { storageService } from '../services/storageService';
import { INITIAL_ADMIN_OFFICERS } from '../data/voters';
import { useElection } from './ElectionContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { voters } = useElection();

  const [session, setSession] = useState(() =>
    storageService.getSessionItem(STORAGE_KEYS.SESSION_AUTH, {
      role: null, // 'VOTER' | 'ADMIN' | null
      voterId: null,
      adminId: null,
    })
  );

  const updateSession = useCallback((nextSession) => {
    storageService.setSessionItem(STORAGE_KEYS.SESSION_AUTH, nextSession);
    setSession(nextSession);
  }, []);

  const verifyVoterCredentials = useCallback(
    (identifier, mobile) => {
      const trimmedId = String(identifier || '').trim().toUpperCase();
      const trimmedMobile = String(mobile || '').trim();

      const found = voters.find(
        (v) =>
          ((v.epicRef || v.voterRef || '').toUpperCase() === trimmedId ||
            (v.id || v.voterId || '').toUpperCase() === trimmedId ||
            String(v.legacyLoginId || '').toUpperCase() === trimmedId) &&
          v.mobile === trimmedMobile
      );

      if (!found) {
        return {
          ok: false,
          error:
            'Voter EPIC/ID or mobile number not found. Try WBX1234567 (or 1234) with 9876543210, or DLX7654321 with 9811122233.',
        };
      }

      return { ok: true, voter: found };
    },
    [voters]
  );

  const completeVoterLogin = useCallback(
    (voterId) => {
      updateSession({
        role: 'VOTER',
        voterId,
        adminId: null,
      });
    },
    [updateSession]
  );

  const requestVoterOtp = useCallback(
    ({ voterIdentifier, phoneNumber, isResend = false }) => {
      const check = verifyVoterCredentials(voterIdentifier, phoneNumber);
      if (!check.ok) return check;
      const otpCode = isResend ? DEMO_OTP_CODES.RESEND : DEMO_OTP_CODES.PRIMARY;
      return { ok: true, voter: check.voter, otpCode };
    },
    [verifyVoterCredentials]
  );

  const verifyVoterOtp = useCallback(
    ({ voterIdentifier, phoneNumber, otpInput, expectedOtp }) => {
      const check = verifyVoterCredentials(voterIdentifier, phoneNumber);
      if (!check.ok) return check;
      const validCodes = [
        expectedOtp,
        DEMO_OTP_CODES.PRIMARY,
        DEMO_OTP_CODES.RESEND,
      ].filter(Boolean);
      if (!validCodes.includes(String(otpInput || '').trim())) {
        return {
          ok: false,
          error: 'Invalid 6-digit OTP. Use 123456 (or 654321 if resent).',
        };
      }
      completeVoterLogin(check.voter.id || check.voter.voterId);
      return { ok: true, voter: check.voter };
    },
    [verifyVoterCredentials, completeVoterLogin]
  );

  const switchActiveVoter = useCallback(
    (voterId) => {
      const exists = voters.some((v) => (v.id || v.voterId) === voterId);
      if (!exists) return false;
      updateSession({
        role: 'VOTER',
        voterId,
        adminId: null,
      });
      return true;
    },
    [voters, updateSession]
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
      updateSession({
        role: 'ADMIN',
        voterId: null,
        adminId,
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
          fullName: check.admin.name || check.admin.fullName || 'Chief Returning Officer',
        },
      };
    },
    [verifyAdminCredentials, completeAdminLogin]
  );

  const logout = useCallback(() => {
    updateSession({
      role: null,
      voterId: null,
      adminId: null,
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
