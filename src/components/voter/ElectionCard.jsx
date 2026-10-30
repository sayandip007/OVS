import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  Users,
  ArrowRight,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  ELECTION_TYPES,
  ELECTION_STATUS_LABELS,
  PARTICIPATION_STATUS_STYLES,
} from '../../utils/constants';

export default function ElectionCard({
  election,
  constituency,
  stateName,
  candidates = [],
  candidateCount,
  participationStatus = 'PENDING',
  participatedAt = null,
  referenceId = null,
  onStartParticipation,
  onParticipate,
  onSimulateStatus,
}) {
  const handleNavigateClick = onStartParticipation || onParticipate;
  const isLokSabha =
    (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA;
  const statusStyle =
    PARTICIPATION_STATUS_STYLES[participationStatus] ||
    PARTICIPATION_STATUS_STYLES.PENDING;
  const isVoted = participationStatus === 'VOTED';
  const isPollingActive = election.status === 'POLLING_ACTIVE';

  const countToDisplay =
    candidateCount !== undefined ? candidateCount : candidates.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between gap-5">
      <div>
        {/* Top Election Type & Participation Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                isLokSabha
                  ? 'bg-indigo-100 text-indigo-900'
                  : 'bg-teal-100 text-teal-900'
              }`}
            >
              {isLokSabha
                ? 'Lok Sabha General Election'
                : 'State Assembly Election'}
            </span>
            <span className="font-mono text-slate-500">
              {election.id || election.electionId} &middot;{' '}
              {election.year || 2029}
            </span>
          </div>

          <span
            data-testid={`election-status-badge-${election.id || election.electionId}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusStyle.badgeClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusStyle.dotClass}`} />
            {isVoted ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : participationStatus === 'CLOSED' ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <span>{statusStyle.label}</span>
          </span>
        </div>

        <h3 className="text-lg font-bold text-slate-900 leading-snug">
          {election.name || election.title}
        </h3>

        {election.description && (
          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
            {election.description}
          </p>
        )}

        {/* Constituency, State & Schedule Details */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-[#002868] shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-500">
                {isLokSabha
                  ? 'Parliamentary Constituency (PC)'
                  : 'Assembly Constituency (AC)'}
              </p>
              <p className="font-bold text-slate-900">
                {constituency ? constituency.name : 'Unassigned'}
              </p>
              <p className="text-[11px] text-slate-500">
                State: {stateName || election.stateId || constituency?.stateId || 'All India'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-[#002868] shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-500">
                Polling Schedule ({ELECTION_STATUS_LABELS[election.status] || election.status})
              </p>
              <p className="font-bold text-slate-900 tabular-nums">
                {election.pollingStartDate || election.pollingDate || 'TBD'} to{' '}
                {election.pollingEndDate || election.pollingDate || 'TBD'}
              </p>
              <p className="text-[11px] text-slate-500">
                Election Year: {election.year || 2029}
              </p>
            </div>
          </div>
        </div>

        {/* Contesting Candidates Summary */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="inline-flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Contesting Candidates in {constituency?.name || 'Constituency'}
            </span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {countToDisplay} Nominated
            </span>
          </div>

          {candidates.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-700">
              {candidates.slice(0, 3).map((cand) => (
                <li
                  key={cand.id || cand.candidateId}
                  className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0"
                >
                  <span className="font-medium text-slate-900 truncate pr-2">
                    {cand.name}
                  </span>
                  <span className="text-slate-500 shrink-0">
                    {cand.partyAbbreviation || cand.partyId}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Footer Links & Phase 3 Navigation / Demo Participation Simulation */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Link
            to={`/voter/candidates?electionId=${
              election.id || election.electionId
            }&constituencyId=${
              constituency?.id || constituency?.constituencyId || ''
            }`}
            className="font-bold text-[#002868] hover:underline"
          >
            View Candidate Information &rarr;
          </Link>

          {participatedAt && (
            <span className="text-emerald-800 font-medium tabular-nums">
              Recorded: {new Date(participatedAt).toLocaleDateString()}
              {referenceId ? ` (${referenceId})` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onSimulateStatus && !isVoted && isPollingActive && (
            <button
              type="button"
              onClick={() => onSimulateStatus(election)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 transition-colors cursor-pointer"
              title="Simulate completing this election's participation status for Phase 3 testing"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Simulate Demo Status: VOTED
            </button>
          )}

          {handleNavigateClick && (
            <button
              type="button"
              onClick={() => handleNavigateClick(election, constituency)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#002868] text-white hover:bg-blue-900 transition-colors cursor-pointer"
            >
              <span>Inspect Election Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
