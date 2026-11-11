import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { DEMO_OTP_CODES, ADMIN_ROLE_LABELS } from '../../utils/constants';
import { eciLogo } from '../../assets';
import { ShieldCheck, UserCheck, Lock, AlertTriangle } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const {
    requestAdminOtp,
    verifyAdminOtp,
    loginAdminWithPassword,
    isAdminAuthenticated,
    adminOfficers,
    isBackendApiMode,
    sessionExpiredNotice,
    clearSessionExpiredNotice,
  } = useAuth();
  const { appendAuditLog } = useElection();
  const { notifySuccess, notifyError, notifyInfo } = useNotification();

  // Backend API credentials state (Email or Officer Code + Password)
  const [backendIdentifier, setBackendIdentifier] = useState('');
  const [backendPassword, setBackendPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // LOCAL_DEMO simulated OTP state (Phases 5-7 compatibility)
  const [officerIdentifier, setOfficerIdentifier] = useState('ECI001');
  const [phoneNumber, setPhoneNumber] = useState('9876543210');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [expectedOtp, setExpectedOtp] = useState(DEMO_OTP_CODES.PRIMARY);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (isAdminAuthenticated) {
      navigate('/eci/dashboard', { replace: true });
    }
  }, [isAdminAuthenticated, navigate]);

  useEffect(() => {
    if (timer <= 0) return undefined;
    const id = setInterval(() => {
      setTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  const handleBackendLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);
    try {
      const admin = await loginAdminWithPassword({
        identifier: backendIdentifier.trim(),
        password: backendPassword,
      });
      setBackendPassword('');
      notifySuccess(
        `Welcome, ${admin.fullName}! Authenticated as ${ADMIN_ROLE_LABELS[admin.role] || admin.role}.`
      );
      navigate('/eci/dashboard');
    } catch (err) {
      const msg =
        err?.detail || err?.message || 'Invalid administrator credentials.';
      setLoginError(msg);
      notifyError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPresetOfficer = (officer) => {
    setOfficerIdentifier(officer.officerCode);
    setPhoneNumber(officer.phoneNumber);
    setOtpRequested(false);
    setOtpInput('');
  };

  const handleRequestOtp = (e) => {
    e.preventDefault();
    const res = requestAdminOtp({
      officerIdentifier: officerIdentifier.trim(),
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
    notifySuccess(`ECI Officer Demo OTP generated: Use code ${res.otpCode}`);
  };

  const handleResendOtp = () => {
    const res = requestAdminOtp({
      officerIdentifier: officerIdentifier.trim(),
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
    notifyInfo(`Resent new Officer Demo OTP: Use code ${res.otpCode}`);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const res = verifyAdminOtp({
      officerIdentifier: officerIdentifier.trim(),
      phoneNumber: phoneNumber.trim(),
      otpInput: otpInput.trim(),
      expectedOtp,
    });
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    appendAuditLog({
      adminUser: res.officer,
      actionType: 'ADMIN_LOGIN',
      targetEntity: 'ADMIN_SESSION',
      targetId: res.officer.id,
      summary: `Authenticated as ${res.officer.fullName} (${res.officer.role}).`,
    });
    notifySuccess(`Welcome, ${res.officer.fullName}! ECI Officer Console unlocked.`);
    navigate('/eci/dashboard');
  };

  // BACKEND_API Mode Login UI
  if (isBackendApiMode) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-200">
            <img src={eciLogo} alt="ECI" className="h-11 w-auto object-contain" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Secure Administrative Authentication (Backend API)
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">
                ECI Officer Console Sign In
              </h1>
            </div>
          </div>

          {sessionExpiredNotice && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>
                  Your previous session expired or was revoked on the server. Please sign in again.
                </span>
              </div>
              <button
                type="button"
                onClick={clearSessionExpiredNotice}
                className="text-red-700 font-bold underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
            <p className="font-bold">Controlled Administrator Provisioning:</p>
            <p>
              Administrator accounts cannot be self-registered through the public voter portal. Sign in using provisioned Officer Code or Administrator Email and Password.
            </p>
          </div>

          {loginError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-900"
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleBackendLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-identifier"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Administrator Email or Officer Code *
              </label>
              <input
                id="admin-identifier"
                type="text"
                required
                autoComplete="username"
                disabled={isSubmitting}
                value={backendIdentifier}
                onChange={(e) => setBackendIdentifier(e.target.value)}
                placeholder="e.g. ECI-SUPER-001 or admin@ovs-demo.local"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Administrator Password *
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                disabled={isSubmitting}
                value={backendPassword}
                onChange={(e) => setBackendPassword(e.target.value)}
                placeholder="Enter your administrator password"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#002868] hover:bg-blue-900 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-sm inline-flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {isSubmitting ? 'Authenticating...' : 'Sign In to ECI Admin Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // LOCAL_DEMO Mode Login UI (Existing Demo Experience Preserved)
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-200">
            <img src={eciLogo} alt="ECI" className="h-11 w-auto object-contain" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Simulated ECI Administration
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">
                ECI Officer Console Login
              </h1>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
            <p className="font-bold">Educational Prototype Notice:</p>
            <p>
              This portal is a local frontend simulation for electoral administration and RBAC testing. Select any of the 5 role accounts on the right or enter credentials below. Default OTP: <code className="font-mono font-bold">123456</code>.
            </p>
          </div>

          <form
            onSubmit={otpRequested ? handleVerifyOtp : handleRequestOtp}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ECI Officer ID / Badge Code *
              </label>
              <input
                type="text"
                required
                disabled={otpRequested}
                value={officerIdentifier}
                onChange={(e) => setOfficerIdentifier(e.target.value)}
                placeholder="ECI001, ECI002, ECI003, ECI004, ECI005 or 1234"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official 10-Digit Mobile Number *
              </label>
              <input
                type="tel"
                required
                disabled={otpRequested}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>

            {otpRequested && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-900">
                    Enter 6-Digit Officer OTP *
                  </label>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-mono font-bold">
                    OTP: {expectedOtp}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base font-mono tracking-widest border border-slate-300 rounded-lg bg-white"
                />
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {timer > 0 ? `Resend available in ${timer}s` : 'Need another code?'}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOtpRequested(false)}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Change Officer
                    </button>
                    <button
                      type="button"
                      disabled={timer > 0}
                      onClick={handleResendOtp}
                      className="font-bold text-[#002868] hover:underline disabled:text-slate-400 cursor-pointer"
                    >
                      Resend OTP (654321)
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#002868] hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-sm"
            >
              {otpRequested
                ? 'Verify Officer OTP & Open Console'
                : 'Request ECI Officer OTP'}
            </button>
          </form>
        </div>

        {/* Role Preset Selector Panel */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#002868]" />
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              5 Demo Admin Roles (Click to Fill)
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            Click any officer role below to auto-populate credentials and test role-based permissions:
          </p>
          <div className="space-y-2.5">
            {adminOfficers.map((officer) => {
              const isSelected = officerIdentifier === officer.officerCode;
              return (
                <button
                  key={officer.id}
                  type="button"
                  onClick={() => handleSelectPresetOfficer(officer)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#002868] bg-blue-50/70 ring-1 ring-[#002868]'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900">
                      {ADMIN_ROLE_LABELS[officer.role] || officer.role}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-bold">
                      {officer.officerCode}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                    {officer.fullName} — <span className="text-slate-500">{officer.designation}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    Mobile: {officer.phoneNumber}
                    {officer.assignedStateId ? ` • Scope: State (${officer.assignedStateId})` : ''}
                    {officer.assignedElectionIds?.length
                      ? ` • Assigned: ${officer.assignedElectionIds.join(', ')}`
                      : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
