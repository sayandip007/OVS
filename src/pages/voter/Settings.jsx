import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { DEMO_OTP_CODES } from '../../utils/constants';

export default function Settings() {
  const navigate = useNavigate();
  const { session, loginVoterDirect, logout } = useAuth();
  const { currentVoter } = useVoter();
  const { voters, states, constituencies, resetDemoEnvironment } = useElection();
  const { notifySuccess, notifyInfo } = useNotification();

  if (!currentVoter) return null;

  const handleQuickSwitchVoter = (voter) => {
    loginVoterDirect(voter);
    notifySuccess(
      `Switched active demo voter session to ${voter.fullName} (${voter.stateId} • EPIC: ${voter.voterRef}).`
    );
    navigate('/voter/dashboard');
  };

  const handleResetAllDemoData = () => {
    resetDemoEnvironment();
    notifyInfo('All localStorage datasets and participation states reset to initial defaults.');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Portal Preferences &amp; Sandbox Controls
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Voter Portal Settings &amp; Demo Account Switcher
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Inspect your simulated authentication session, switch between the 5 state/UT
            demo voters, or reset local demonstration state.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetAllDemoData}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs cursor-pointer"
        >
          Reset Demo Data to Initial Defaults
        </button>
      </div>

      {/* Active Simulated Session Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-extrabold text-slate-900">
          1. Active Simulated Session Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Authenticated Voter</span>
            <strong className="text-slate-900 text-sm">
              {currentVoter.fullName} ({currentVoter.voterId})
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Demo EPIC &amp; Mobile</span>
            <strong className="text-[#002868] font-mono text-sm">
              {currentVoter.voterRef} • +91-{currentVoter.mobile}
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Simulated OTP Reference</span>
            <strong className="text-emerald-700 font-mono text-sm">
              {DEMO_OTP_CODES.VOTER_LOGIN} (Dev-Only)
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Session Expiry</span>
            <strong className="text-slate-900">
              {session?.expiresAt
                ? new Date(session.expiresAt).toLocaleTimeString('en-IN')
                : 'Active Browser Session'}
            </strong>
          </div>
        </div>
      </div>

      {/* Multi-State Demo Voter Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            2. Quick-Switch Multi-State Demo Voter Accounts
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Instantly switch between pre-configured sample voters across West Bengal,
            Maharashtra, Uttar Pradesh, Tamil Nadu, and Delhi to test state-specific
            Assembly eligibility and simultaneous election tracking.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {voters.map((v) => {
            const isCurrent = v.voterId === currentVoter.voterId;
            const st = states.find((s) => s.stateId === v.stateId);
            const pc = constituencies.find(
              (c) => c.constituencyId === v.parliamentaryConstituencyId
            );
            const ac = constituencies.find(
              (c) => c.constituencyId === v.assemblyConstituencyId
            );

            return (
              <div
                key={v.voterId}
                className={`p-4 rounded-xl border-2 flex flex-col justify-between gap-3 ${
                  isCurrent
                    ? 'border-[#002868] bg-blue-50/40'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                      {v.voterRef}
                    </span>
                    <span className="text-[11px] font-bold text-[#002868]">
                      {st?.stateName || v.stateId}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 pt-1">
                    {v.fullName}
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Mobile: <code className="font-mono">{v.mobile}</code>
                  </p>
                  <p className="text-[11px] text-slate-600">
                    PC: <strong>{pc?.name || v.parliamentaryConstituencyId}</strong>
                  </p>
                  <p className="text-[11px] text-slate-600">
                    AC: <strong>{ac?.name || v.assemblyConstituencyId}</strong>
                  </p>
                </div>

                {isCurrent ? (
                  <span className="w-full py-2 text-center rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold">
                    ✓ Currently Active Voter
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleQuickSwitchVoter(v)}
                    className="w-full py-2 rounded-lg bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Switch to {v.fullName} &rarr;
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sign Out Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">
            End Current Voter Portal Session
          </h2>
          <p className="text-xs text-slate-600">
            Sign out of the Voter Portal and return to the simulated EPIC/Mobile login page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/voter/login');
          }}
          className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
        >
          Logout from Voter Portal
        </button>
      </div>
    </div>
  );
}
