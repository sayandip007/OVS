import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { DEMO_OTP_CODES } from '../../utils/constants';
import { eciLogo } from '../../assets';

export default function VoterLogin() {
  const navigate = useNavigate();
  const { requestVoterOtp, verifyVoterOtp, isVoterAuthenticated } = useAuth();
  const { voters } = useElection();
  const { notifySuccess, notifyError, notifyInfo } = useNotification();

  const [voterIdentifier, setVoterIdentifier] = useState('WBX1234567');
  const [phoneNumber, setPhoneNumber] = useState('9876543210');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [expectedOtp, setExpectedOtp] = useState(DEMO_OTP_CODES.PRIMARY);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (isVoterAuthenticated) {
      navigate('/voter/dashboard', { replace: true });
    }
  }, [isVoterAuthenticated, navigate]);

  useEffect(() => {
    if (timer <= 0) return undefined;
    const id = setInterval(() => {
      setTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  const handleRequestOtp = (e) => {
    e.preventDefault();
    const res = requestVoterOtp({
      voterIdentifier: voterIdentifier.trim(),
      phoneNumber: phoneNumber.trim(),
      isResend: false,
    });
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    setOtpRequested(true);
    setExpectedOtp(res.otpCode);
    setOtpInput(res.otpCode);
    setTimer(30);
    notifySuccess(
      `Demo OTP sent to +91-${phoneNumber.trim()}: Use code ${res.otpCode}`
    );
  };

  const handleResendOtp = () => {
    const res = requestVoterOtp({
      voterIdentifier: voterIdentifier.trim(),
      phoneNumber: phoneNumber.trim(),
      isResend: true,
    });
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    setExpectedOtp(res.otpCode);
    setOtpInput(res.otpCode);
    setTimer(30);
    notifyInfo(`Resent new Demo OTP: Use code ${res.otpCode}`);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const res = verifyVoterOtp({
      voterIdentifier: voterIdentifier.trim(),
      phoneNumber: phoneNumber.trim(),
      otpInput: otpInput.trim(),
      expectedOtp,
    });
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(`Welcome, ${res.voter.fullName}! Authenticated to Voter Hub.`);
    navigate('/voter/dashboard');
  };

  const handleQuickFillVoter = (voter) => {
    setVoterIdentifier(voter.voterRef);
    setPhoneNumber(voter.mobile);
    setOtpRequested(false);
    setOtpInput('');
    notifyInfo(
      `Filled credentials for ${voter.fullName} (${voter.stateId}). Click "Send OTP" to proceed.`
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Voter OTP Login Card */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 mb-6">
            <img src={eciLogo} alt="ECI" className="h-10 w-auto object-contain" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
                Citizen Electoral Authentication
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Voter Portal Login
              </h1>
            </div>
          </div>

          <form
            onSubmit={otpRequested ? handleVerifyOtp : handleRequestOtp}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                EPIC Voter Reference / Voter ID *
              </label>
              <input
                type="text"
                required
                disabled={otpRequested}
                value={voterIdentifier}
                onChange={(e) => setVoterIdentifier(e.target.value)}
                placeholder="e.g. WBX1234567 or legacy 1234"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868] disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Registered 10-Digit Mobile Number *
              </label>
              <input
                type="tel"
                required
                disabled={otpRequested}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868] disabled:bg-slate-100"
              />
            </div>

            {otpRequested && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#002868]">
                    Enter 6-Digit Demo OTP *
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Active Demo OTP: {expectedOtp}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="Enter 6-digit OTP (123456)"
                  className="w-full px-3.5 py-2.5 text-base font-mono tracking-widest border border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#002868]"
                />
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {timer > 0
                      ? `Resend OTP available in ${timer}s`
                      : 'Did not receive code?'}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={timer > 0}
                      onClick={handleResendOtp}
                      className="font-bold text-[#002868] hover:underline disabled:text-slate-400 cursor-pointer"
                    >
                      Resend OTP (654321)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOtpRequested(false)}
                      className="text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Change ID
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#002868] hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-sm"
            >
              {otpRequested ? 'Verify OTP & Enter Voter Hub' : 'Send Demo OTP'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>Not registered on the electoral roll yet?</span>
            <Link
              to="/voter/register"
              className="font-bold text-[#002868] hover:underline"
            >
              Register as a New Voter &rarr;
            </Link>
          </div>
        </div>

        {/* Right Column: One-Click Demo Voter Profiles */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-bold uppercase">
              Demo Profiles
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-1.5">
              Quick-Fill Registered Voters
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Select any pre-configured voter below to test Simultaneous Elections across
              States, Parliamentary Constituencies, and Assembly Constituencies.
            </p>
          </div>

          <div className="space-y-3">
            {voters.map((v) => (
              <div
                key={v.voterId}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/70 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{v.fullName}</h3>
                    <p className="text-xs text-slate-600">
                      State: <strong>{v.stateId}</strong> • EPIC:{' '}
                      <code className="font-mono font-bold text-[#002868]">
                        {v.voterRef}
                      </code>{' '}
                      • Mobile: <code className="font-mono">{v.mobile}</code>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickFillVoter(v)}
                    className="px-2.5 py-1 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                  >
                    Use Profile
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/70">
                  <div>
                    <span className="text-slate-500 block">Lok Sabha (PC):</span>
                    <span className="font-semibold text-indigo-900">
                      {v.parliamentaryConstituencyId}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">State Assembly (AC):</span>
                    <span className="font-semibold text-teal-900">
                      {v.assemblyConstituencyId}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-slate-100 text-xs text-slate-600">
            <strong>Legacy Compatibility:</strong> You can also log in using the original
            demo Voter ID <code className="font-mono font-bold">1234</code> and Mobile{' '}
            <code className="font-mono font-bold">9876543210</code> with OTP{' '}
            <code className="font-mono font-bold">123456</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
