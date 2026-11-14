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
  FileCheck2,
  Info,
} from 'lucide-react';
import {
  ELECTION_TYPES,
  ELECTION_STATUS_LABELS,
  PARTICIPATION_STATUS_STYLES,
} from '../../utils/constants';
import { getElectionStatusExplanation } from '../../services/ballotValidationService';

export default function ElectionCard({
  election,
  constituency,
  stateName,
  candidates = [],
  candidateCount,
  participationStatus = 'PENDING',
  participatedAt = null,
  referenceId = null,
  demoReference = null,
  controlledDemoPollingMode = false,
  onStartParticipation,
  onParticipate,
}) {
  const elId = election.id || election.electionId;
  const isLokSabha =
    (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA;
  const statusStyle =
    PARTICIPATION_STATUS_STYLES[participationStatus] ||
    PARTICIPATION_STATUS_STYLES.PENDING;
  const isVoted = participationStatus === 'VOTED';
  const isPollingActive =
    election.status === 'POLLING_ACTIVE' ||
    election.status === 'ACTIVE' ||
    controlledDemoPollingMode;
  const canOpenBallot = !isVoted && isPollingActive && election.status !== 'CANCELLED';

  const countToDisplay =
    candidateCount !== undefined ? candidateCount : candidates.length;
  const resolvedRef = demoReference || referenceId;
  const handleCustomClick = onStartParticipation || onParticipate;

  const ballotButtonLabel = isLokSabha
    ? 'Vote in Lok Sabha'
    : 'Vote in Assembly';

  return (
    <div
      data-testid={`election-card-${elId}`}
      className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between gap-5"
    >
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
              {elId} &middot; {election.year || 2029}
            </span>
          </div>

          <span
            data-testid={`election-status-badge-${elId}`}
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

        <p className="text-xs font-bold text-[#002868] mt-1">
          {isLokSabha
            ? 'Parliamentary Election — Select your Member of Parliament.'
            : 'State Legislative Assembly Election — Select your Member of Legislative Assembly.'}
        </p>

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
                State:{' '}
                {stateName ||
                  election.stateId ||
                  constituency?.stateId ||
                  'All India'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-[#002868] shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-500">
                Status:{' '}
                <strong className="text-slate-800">
                  {ELECTION_STATUS_LABELS[election.status] || election.status}
                </strong>
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
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Contesting Demo Candidates in {constituency?.name || 'Constituency'}
            </span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {countToDisplay} Nominated + NOTA
            </span>
          </div>
        </div>

        {/* Explanation if election is not active and not yet voted */}
        {!canOpenBallot && !isVoted && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
            <span>{getElectionStatusExplanation(election.status)}</span>
          </div>
        )}
      </div>

      {/* Footer Links & Ballot Actions */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Link
            to={`/voter/candidates?electionId=${elId}&constituencyId=${
              constituency?.id || constituency?.constituencyId || ''
            }`}
            className="font-bold text-[#002868] hover:underline"
          >
            Candidate Directory &rarr;
          </Link>

          <Link
            to={`/voter/elections/${elId}/info`}
            className="font-bold text-slate-700 hover:text-[#002868] hover:underline"
          >
            Election Info
          </Link>

          {participatedAt && (
            <span className="text-emerald-800 font-medium tabular-nums">
              Recorded: {new Date(participatedAt).toLocaleDateString('en-IN')}
              {resolvedRef ? ` (${resolvedRef})` : ''}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isVoted ? (
            <Link
              to={`/voter/elections/${elId}/receipt`}
              data-testid={`view-receipt-btn-${elId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-800 text-white hover:bg-emerald-900 transition-colors"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>View Receipt</span>
            </Link>
          ) : canOpenBallot ? (
            <Link
              to={`/voter/elections/${elId}/ballot${
                controlledDemoPollingMode ? '?demoMode=true' : ''
              }`}
              data-testid={`open-ballot-btn-${elId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold bg-[#002868] text-white hover:bg-blue-900 transition-colors shadow-xs"
            >
              <span>{ballotButtonLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : handleCustomClick ? (
            <button
              type="button"
              onClick={() => handleCustomClick(election, constituency)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <span>Inspect Election Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Link
              to={`/voter/elections/${elId}/info`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 transition-colors"
            >
              <span>View Election Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
