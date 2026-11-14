import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  KeyRound,
  RefreshCw,
  Clock,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { DEMO_OTP_CODES, OTP_CONFIG } from '../../utils/constants';
import { eciLogo } from '../../assets';
import { frontendEnv } from '../../config/env';
import { apiClient } from '../../services/apiClient';

export default function VoterLogin() {
  const navigate = useNavigate();
  const {
    requestVoterOtp,
    verifyVoterOtp,
    completeVoterLogin,
    setCsrfToken,
    otpChallenge,
    isVoterAuthenticated,
  } = useAuth();
  const { voters, states, constituencies } = useElection();
  const { notifySuccess, notifyError, notifyInfo } = useNotification();

  const [loginIdentifier, setLoginIdentifier] = useState('DEMO-EPIC-001');
  const [phoneNumber, setPhoneNumber] = useState('9876543210');
  const [otpRequested, setOtpRequested] = useState(false);
  const [backendChallengeId, setBackendChallengeId] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [expectedOtp, setExpectedOtp] = useState(DEMO_OTP_CODES.PRIMARY);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expirySecondsLeft, setExpirySecondsLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchedVoterPreview, setMatchedVoterPreview] = useState(null);

  useEffect(() => {
    if (isVoterAuthenticated) {
      navigate('/voter/dashboard', { replace: true });
    }
  }, [isVoterAuthenticated, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0 && expirySecondsLeft <= 0) return undefined;
    const id = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
      setExpirySecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown, expirySecondsLeft]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (frontendEnv.isBackendApi) {
      try {
        const res = await apiClient.auth.requestOtp({
          identifier: loginIdentifier.trim(),
          phoneNumber: phoneNumber.trim(),
        });
        const challengeId = res.data.challengeId;
        setOtpRequested(true);
        setBackendChallengeId(challengeId);
        setResendCooldown(OTP_CONFIG.RESEND_COOLDOWN_SECONDS);
        setExpirySecondsLeft(Math.floor(res.data.expiresInSeconds || 300));

        let devCode = '';
        try {
          const devRes = await apiClient.auth.getDevOtp(
            loginIdentifier.trim() || phoneNumber.trim()
          );
          if (devRes?.data?.otp) {
            devCode = devRes.data.otp;
            setExpectedOtp(devCode);
            setOtpInput(devCode);
          }
        } catch {
          // Dev route unavailable in production
        }

        notifyInfo(
          devCode
            ? `Development Backend OTP generated: ${devCode}`
            : 'OTP challenge generated. Please enter your code.'
        );
        return;
      } catch (err) {
        notifyError(
          err?.detail || err?.message || 'Failed to request OTP from backend.'
        );
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    setTimeout(() => {
      const res = requestVoterOtp({
        voterIdentifier: loginIdentifier.trim(),
        phoneNumber: phoneNumber.trim(),
        isResend: false,
      });
      setIsSubmitting(false);

      if (!res.ok) {
        notifyError(res.error);
        return;
      }

      setMatchedVoterPreview(res.voter);
      setOtpRequested(true);
      setExpectedOtp(res.otpCode);
      setOtpInput(res.otpCode);
      setResendCooldown(OTP_CONFIG.RESEND_COOLDOWN_SECONDS);
      setExpirySecondsLeft(Math.floor(OTP_CONFIG.EXPIRY_MS / 1000));
      notifyInfo(
        `Development Demo OTP generated locally: ${res.otpCode} (No real SMS is sent in this frontend prototype).`
      );
    }, 200);
  };

  const handleResendOtp = async () => {
    if (frontendEnv.isBackendApi) {
      setIsSubmitting(true);
      try {
        const res = await apiClient.auth.requestOtp({
          identifier: loginIdentifier.trim(),
          phoneNumber: phoneNumber.trim(),
        });
        const challengeId = res.data.challengeId;
        setBackendChallengeId(challengeId);
        setResendCooldown(OTP_CONFIG.RESEND_COOLDOWN_SECONDS);
        setExpirySecondsLeft(Math.floor(res.data.expiresInSeconds || 300));

        let devCode = '';
        try {
          const devRes = await apiClient.auth.getDevOtp(
            loginIdentifier.trim() || phoneNumber.trim()
          );
          if (devRes?.data?.otp) {
            devCode = devRes.data.otp;
            setExpectedOtp(devCode);
            setOtpInput(devCode);
          }
        } catch {}

        notifyInfo(
          devCode
            ? `Resent Development Backend OTP: ${devCode}`
            : 'New OTP code issued.'
        );
        return;
      } catch (err) {
        notifyError(
          err?.detail || err?.message || 'Failed to resend OTP from backend.'
        );
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    const res = requestVoterOtp({
      voterIdentifier: loginIdentifier.trim(),
      phoneNumber: phoneNumber.trim(),
      isResend: true,
    });
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    setExpectedOtp(res.otpCode);
    setOtpInput(res.otpCode);
    setResendCooldown(OTP_CONFIG.RESEND_COOLDOWN_SECONDS);
    setExpirySecondsLeft(Math.floor(OTP_CONFIG.EXPIRY_MS / 1000));
    notifyInfo(
      `Generated new Development Demo OTP: ${res.otpCode} (Attempt counter reset).`
    );
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (expirySecondsLeft <= 0) {
      notifyError(
        'This Demo OTP has expired. Please click "Resend Demo OTP" to generate a new code.'
      );
      return;
    }

    setIsSubmitting(true);

    if (frontendEnv.isBackendApi && backendChallengeId) {
      try {
        const verifyRes = await apiClient.auth.verifyOtp({
          challengeId: backendChallengeId,
          otp: otpInput.trim(),
        });
        const userData = verifyRes.data.user;
        const voterData = verifyRes.data.voterProfile;

        try {
          const csrfRes = await apiClient.auth.getCsrf();
          if (csrfRes?.data?.csrfToken && setCsrfToken) {
            setCsrfToken(csrfRes.data.csrfToken);
          }
        } catch {}

        completeVoterLogin(voterData?.id || userData.id);
        notifySuccess(
          `Session established for ${voterData?.fullName || userData.mobileNumber || 'Voter'}. Redirecting to dashboard.`
        );
        navigate('/voter/dashboard');
        return;
      } catch (err) {
        notifyError(err?.detail || err?.message || 'OTP verification failed.');
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    setTimeout(() => {
      const res = verifyVoterOtp({
        voterIdentifier: loginIdentifier.trim(),
        phoneNumber: phoneNumber.trim(),
        otpInput: otpInput.trim(),
        expectedOtp,
      });
      setIsSubmitting(false);

      if (!res.ok) {
        notifyError(res.error);
        return;
      }

      notifySuccess(
        `Simulated session established for ${res.voter.fullName}. Redirecting to Voter Dashboard.`
      );
      navigate('/voter/dashboard');
    }, 200);
  };

  const handleQuickFillVoter = (voter) => {
    setLoginIdentifier(voter.epicReference || voter.epicRef);
    setPhoneNumber(voter.mobile);
    setOtpRequested(false);
    setOtpInput('');
    setMatchedVoterPreview(voter);
    notifyInfo(
      `Loaded demo credentials for ${voter.fullName} (${voter.stateId}). Click "Generate Demo OTP" to continue.`
    );
  };

  const attemptsRemaining = otpChallenge
    ? Math.max(0, otpChallenge.maxAttempts - otpChallenge.attemptsUsed)
    : OTP_CONFIG.MAX_ATTEMPTS;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Demonstration Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-950">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold block text-sm">
            Simulated Voter Authentication &amp; Local OTP Demonstration
          </strong>
          This login flow validates against local demonstration voter records only.
          No real SMS or email OTP is dispatched; use the clearly labelled
          development-only OTP panel displayed during verification.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Login & Simulated OTP Form */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
            <img src={eciLogo} alt="ECI" className="h-11 w-11 object-contain shrink-0" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
                Phase 3 • Voter Portal Access
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Simulated Voter Login
              </h1>
            </div>
          </div>

          <form
            onSubmit={otpRequested ? handleVerifyOtp : handleRequestOtp}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Demo EPIC / Voter ID Reference (or Registered Mobile) *
              </label>
              <input
                type="text"
                required
                disabled={otpRequested}
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="e.g. DEMO-EPIC-001, WBX1234567, or 9876543210"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868] disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Registered 10-Digit Mobile Number (Optional if EPIC entered)
              </label>
              <input
                type="tel"
                disabled={otpRequested}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 9876543210 or 9000000001"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868] disabled:bg-slate-100"
              />
            </div>

            {otpRequested && (
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-3.5">
                {/* Development-Only Demo OTP Display Box */}
                <div className="p-3 rounded-lg bg-slate-900 text-white text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      Development-Only Demo OTP
                    </span>
                    <span className="font-mono text-sm font-extrabold bg-white/15 px-2.5 py-0.5 rounded text-emerald-300">
                      {expectedOtp}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    No real SMS is sent. Enter <code className="font-mono font-bold text-white">{expectedOtp}</code> below to complete local verification for{' '}
                    <strong>{matchedVoterPreview?.fullName}</strong>.
                  </p>
                </div>

                {/* Expiry & Attempt Counters */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      expirySecondsLeft > 20 ? 'text-slate-700' : 'text-red-600'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {expirySecondsLeft > 0
                      ? `OTP Expires in ${expirySecondsLeft}s`
                      : 'OTP Expired — Please Resend'}
                  </span>
                  <span className="font-semibold text-slate-700">
                    Attempts Remaining: <strong>{attemptsRemaining}</strong> /{' '}
                    {OTP_CONFIG.MAX_ATTEMPTS}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#002868] mb-1">
                    Enter 6-Digit Demo OTP *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    disabled={
                      expirySecondsLeft <= 0 || Boolean(otpChallenge?.locked)
                    }
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="Enter 6-digit Demo OTP"
                    className="w-full px-3.5 py-2.5 text-base font-mono tracking-widest border border-blue-300 rounded-lg bg-white disabled:bg-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={handleResendOtp}
                    className="inline-flex items-center gap-1 font-bold text-[#002868] hover:underline disabled:text-slate-400 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {resendCooldown > 0
                      ? `Resend Demo OTP in ${resendCooldown}s`
                      : 'Resend Demo OTP (654321)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpRequested(false);
                      setOtpInput('');
                    }}
                    className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    Change Voter ID
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#002868] hover:bg-blue-900 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Processing Simulated Verification...'
                  : otpRequested
                  ? 'Verify Demo OTP & Enter Voter Portal'
                  : 'Generate Demo OTP'}
              </span>
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>New to the demonstration portal?</span>
            <Link
              to="/voter/register"
              className="font-bold text-[#002868] hover:underline"
            >
              Complete 4-Step Demo Voter Registration &rarr;
            </Link>
          </div>
        </div>

        {/* Right Column: Deterministic Multi-State Demo Account Login Guide */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-900 text-xs font-bold uppercase">
                Demo Account Login Guide
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Deterministic Sample Voters (5 States/UTs)
              </h2>
              <p className="text-xs text-slate-600">
                Click <strong>Use Demo Account</strong> on any sample voter below to
                inspect state-specific Parliamentary (PC) and Assembly (AC)
                jurisdictions and simultaneous elections.
              </p>
            </div>
          </div>

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {voters.map((v) => {
              const stObj = states.find((s) => s.id === v.stateId);
              const pcObj = constituencies.find(
                (c) => c.id === v.parliamentaryConstituencyId
              );
              const acObj = constituencies.find(
                (c) => c.id === v.assemblyConstituencyId
              );

              return (
                <div
                  key={v.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-[#002868] bg-slate-50/70 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#002868] text-white text-[10px] font-bold">
                          {stObj?.name || v.stateId} ({v.stateId})
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {v.id}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">
                        {v.fullName}
                      </h3>
                      <p className="text-xs text-slate-600">
                        EPIC:{' '}
                        <code className="font-mono font-bold text-[#002868]">
                          {v.epicReference}
                        </code>{' '}
                        (or <code className="font-mono">{v.epicRef}</code>) &middot;
                        Mobile: <code className="font-mono font-bold">{v.mobile}</code>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickFillVoter(v)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Use Demo Account
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200/80">
                    <div>
                      <span className="text-slate-500 block">
                        Lok Sabha Parliamentary (PC):
                      </span>
                      <span className="font-bold text-indigo-900">
                        {pcObj?.name || v.parliamentaryConstituencyId}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">
                        State Assembly (AC):
                      </span>
                      <span className="font-bold text-teal-900">
                        {acObj?.name || v.assemblyConstituencyId}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
