import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { DEMO_OTP_CODES } from '../../utils/constants';
import { eciLogo } from '../../assets';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { requestAdminOtp, verifyAdminOtp, isAdminAuthenticated } = useAuth();
  const { notifySuccess, notifyError, notifyInfo } = useNotification();

  const [officerIdentifier, setOfficerIdentifier] = useState('1234');
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
    notifySuccess(`Welcome, ${res.officer.fullName}! ECI Officer Console unlocked.`);
    navigate('/eci/dashboard');
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-200">
          <img src={eciLogo} alt="ECI" className="h-11 w-auto object-contain" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Restricted ECI Administration
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900">
              ECI Officer Console Login
            </h1>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
          <p className="font-bold">Demo ECI Officer Credentials:</p>
          <p>
            Officer Code: <code className="font-mono font-bold">1234</code> or{' '}
            <code className="font-mono font-bold">ECI001</code> • Mobile:{' '}
            <code className="font-mono font-bold">9876543210</code> • OTP:{' '}
            <code className="font-mono font-bold">123456</code> (Resend:{' '}
            <code className="font-mono font-bold">654321</code>)
          </p>
        </div>

        <form
          onSubmit={otpRequested ? handleVerifyOtp : handleRequestOtp}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ECI Officer ID / Badge Number *
            </label>
            <input
              type="text"
              required
              disabled={otpRequested}
              value={officerIdentifier}
              onChange={(e) => setOfficerIdentifier(e.target.value)}
              placeholder="1234 or ECI001"
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
    </div>
  );
}
