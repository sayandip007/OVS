import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { ELECTION_TYPES } from '../../utils/constants';

export default function VotingStatus({ summary }) {
  if (!summary) return null;

  const { completedCount, totalCount, label, percentage, targetElections, byElectionId } =
    summary;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-semibold text-[#004d99]">
            Simultaneous Election Participation Tracker
          </p>
          <h3 className="text-base font-bold text-slate-900">
            Eligible Elections Progress
          </h3>
        </div>
        <div className="text-right">
          <span
            data-testid="participation-progress-label"
            className="text-lg font-bold font-mono text-slate-900 tabular-nums"
          >
            {label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-[#138808] transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Independent breakdown per election */}
      {targetElections && targetElections.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          {targetElections.map((election) => {
            const statusObj = byElectionId[election.id] || { status: 'PENDING' };
            const isVoted = statusObj.status === 'VOTED';
            const isLokSabha = election.type === ELECTION_TYPES.LOK_SABHA;

            return (
              <div
                key={election.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-slate-500 font-medium">
                    {isLokSabha ? 'Lok Sabha (PC)' : 'State Assembly (AC)'}
                  </p>
                  <p className="font-semibold text-slate-900 truncate">
                    {election.name}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                    isVoted ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isVoted ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      VOTED
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      PENDING
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          No active elections found for your mapped Parliamentary or Assembly constituencies.
        </p>
      )}
    </div>
  );
}
