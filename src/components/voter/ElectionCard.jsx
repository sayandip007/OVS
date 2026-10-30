import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import {
  ELECTION_TYPES,
  ELECTION_STATUS_LABELS,
} from '../../utils/constants';

export default function ElectionCard({
  election,
  constituency,
  stateName,
  candidates = [],
  candidateCount,
  participationStatus = 'PENDING',
  participatedAt = null,
  onStartParticipation,
  onParticipate,
}) {
  const handleParticipateClick = onStartParticipation || onParticipate;
  const isLokSabha = (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA;
  const isVoted = participationStatus === 'VOTED';
  const isPollingActive = election.status === 'POLLING_ACTIVE';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between gap-5">
      <div>
        {/* Metadata Row (Zero-Pill clean unboxed text with separators) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 mb-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-[#004d99] font-semibold">
              {isLokSabha ? 'Lok Sabha Election' : 'State Assembly Election'}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>{election.id}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{ELECTION_STATUS_LABELS[election.status] || election.status}</span>
          </div>

          <div className="flex items-center gap-1.5 font-semibold">
            {isVoted ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                VOTED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <Clock className="w-4 h-4" />
                PENDING
              </span>
            )}
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-900 leading-snug">
          {election.name}
        </h3>

        {election.description && (
          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
            {election.description}
          </p>
        )}

        {/* Constituency & Schedule Details */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-[#004d99] shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-500">
                {isLokSabha
                  ? 'Parliamentary Constituency (PC)'
                  : 'Assembly Constituency (AC)'}
              </p>
              <p className="font-semibold text-slate-900">
                {constituency ? constituency.name : 'Unassigned'}
                {!isLokSabha && stateName ? ` (${stateName})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-[#004d99] shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-500">Polling Schedule</p>
              <p className="font-semibold text-slate-900 tabular-nums">
                {election.pollingStartDate || 'TBD'} to{' '}
                {election.pollingEndDate || 'TBD'}
              </p>
            </div>
          </div>
        </div>

        {/* Contesting Candidates Preview */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="inline-flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Contesting Candidates in {constituency?.name || 'Constituency'}
            </span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {candidateCount !== undefined ? candidateCount : candidates.length} + NOTA
            </span>
          </div>

          {candidates.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-slate-700">
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
              {candidates.length > 3 && (
                <li className="text-slate-500 italic">
                  + {candidates.length - 3} more candidate(s) &amp; NOTA
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Contesting candidates &amp; NOTA option available on the electronic ballot unit.
            </p>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {participatedAt ? (
          <span className="text-xs text-emerald-700 font-medium tabular-nums">
            Demo Participation Recorded &middot;{' '}
            {new Date(participatedAt).toLocaleDateString()}
          </span>
        ) : (
          <Link
            to={`/candidates?electionId=${election.id || election.electionId}&constituencyId=${
              constituency?.id || constituency?.constituencyId || ''
            }`}
            className="text-xs font-semibold text-[#004d99] hover:underline"
          >
            View Constituency Candidates
          </Link>
        )}

        {handleParticipateClick && (
          <button
            type="button"
            disabled={isVoted || !isPollingActive || !constituency}
            onClick={() => handleParticipateClick(election, constituency)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              isVoted
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                : isPollingActive && constituency
                ? 'bg-[#004d99] text-white hover:bg-[#003d80] cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isVoted ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Participation Completed
              </>
            ) : isPollingActive ? (
              <>
                Open Demo Ballot
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : (
              'Polling Not Active'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
