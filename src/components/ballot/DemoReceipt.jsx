import React from 'react';
import { Link } from 'react-router-dom';
import { ELECTION_TYPES, getDemoReferenceIso } from '../../utils/constants';

/**
 * Non-Sensitive Demo Confirmation Receipt Component.
 * Displays:
 * - Demo participation completed status
 * - Election name
 * - Election type
 * - Constituency
 * - Participation date and time
 * - Non-sensitive demo reference
 * - Clear demonstration disclaimer
 * - Print confirmation, Return to dashboard, and View remaining eligible elections
 *
 * STRICT PRIVACY RULE: Never receives or displays candidate selected, party selected,
 * ballot choice, or candidate photograph.
 */
export default function DemoReceipt({
  election,
  constituency,
  stateName,
  participationRecord,
  remainingEligibleElections = [],
}) {
  if (!election) return null;

  const isLokSabha =
    (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA;
  const demoRef =
    participationRecord?.demoReference ||
    participationRecord?.referenceId ||
    (isLokSabha ? 'DEMO-LS-000001' : 'DEMO-ASM-000001');
  const rawTimestamp = participationRecord?.participatedAt || getDemoReferenceIso();
  const participatedAt = new Date(rawTimestamp).toLocaleString('en-IN');

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <div
      className="bg-white rounded-2xl border-2 border-emerald-300 shadow-xs overflow-hidden"
      data-testid="demo-confirmation-receipt"
    >
      {/* Top Status Header */}
      <div className="bg-emerald-800 text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white text-emerald-800 flex items-center justify-center text-2xl font-extrabold shrink-0">
            &#10003;
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 block">
              Official Voting Acknowledgement
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold">
              Ballot Submitted Successfully
            </h2>
          </div>
        </div>

        <span
          data-testid="receipt-demo-reference"
          className="px-3.5 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-400/40 font-mono text-xs sm:text-sm font-bold"
        >
          Ref: {demoRef}
        </span>
      </div>

      {/* Receipt Body (Contains ZERO candidate or party selection data) */}
      <div className="p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Election Name
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {election.name || election.title}
            </strong>
            <span className="text-[11px] font-mono text-slate-500">
              Election ID: {election.id || election.electionId}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Election Type
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {isLokSabha
                ? 'Lok Sabha General Election (PARLIAMENTARY)'
                : 'State Legislative Assembly Election (ASSEMBLY)'}
            </strong>
            <span className="text-[11px] text-slate-500">
              Year: {election.year || 2029}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Constituency
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {constituency?.name || 'Mapped Constituency'} (
              {constituency?.code || constituency?.id || 'N/A'})
            </strong>
            <span className="text-[11px] text-slate-500">
              State / UT: {stateName || election.stateId || constituency?.stateId || 'All India'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Participation Status
            </span>
            <strong className="text-sm text-emerald-700 mt-0.5 block">
              VOTED (Confirmed)
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Participation Date &amp; Time
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block tabular-nums">
              {participatedAt}
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Acknowledgement Reference
            </span>
            <strong className="text-sm font-mono text-[#002868] mt-0.5 block">
              {demoRef}
            </strong>
          </div>
        </div>

        {/* Ballot Secrecy & Verification Notice */}
        <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-950 space-y-1">
          <strong className="block uppercase tracking-wider text-[11px] text-[#002868]">
            Secret Ballot Guarantee
          </strong>
          <p className="leading-relaxed text-blue-900">
            This receipt confirms your participation in <strong>{election.name || election.title}</strong>.
            Your ballot choice is strictly confidential with zero candidate link stored. Tally records are
            independently simulated using certified counting sessions.
          </p>
        </div>

        {/* Remaining Simultaneous / Eligible Elections Section */}
        {remainingEligibleElections.length > 0 && (
          <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-3 print:hidden">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#002868] block">
                Simultaneous Election Tracker
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                You Have {remainingEligibleElections.length} Remaining Eligible
                Election{remainingEligibleElections.length > 1 ? 's' : ''} Pending
              </h3>
              <p className="text-xs text-slate-600">
                Completing {election.name || election.title} does not mark your
                other eligible election as completed. You can proceed to your
                remaining election below:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {remainingEligibleElections.map((remEl) => {
                const remId = remEl.id || remEl.electionId;
                const remIsLS =
                  (remEl.type || remEl.electionType) === ELECTION_TYPES.LOK_SABHA;
                return (
                  <div
                    key={remId}
                    className="p-3.5 rounded-xl bg-white border border-blue-200 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase text-indigo-800 block">
                        {remIsLS ? 'Lok Sabha (PC)' : 'State Assembly (AC)'}
                      </span>
                      <strong className="text-xs sm:text-sm text-slate-900 block">
                        {remEl.name || remEl.title}
                      </strong>
                    </div>
                    <Link
                      to={`/voter/elections/${remId}/ballot`}
                      className="px-3.5 py-2 rounded-lg bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold shrink-0"
                    >
                      Open {remIsLS ? 'Lok Sabha' : 'Assembly'} Ballot &rarr;
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer"
          >
            Print Confirmation Receipt
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/voter/elections"
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold"
            >
              View All Eligible Elections
            </Link>
            <Link
              to="/voter/dashboard"
              className="px-5 py-2.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold shadow-xs"
            >
              Return to Voter Dashboard &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
