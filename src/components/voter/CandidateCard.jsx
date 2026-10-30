import React from 'react';
import { defaultAvatar, eciLogo } from '../../assets';
import { ELECTION_TYPES } from '../../utils/constants';

export default function CandidateCard({
  candidate,
  party,
  election,
  constituency,
  stateName,
  onSelectProfile,
}) {
  const isLokSabha = candidate.electionType === ELECTION_TYPES.LOK_SABHA;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-start gap-4">
          <img
            src={candidate.photograph || defaultAvatar}
            alt={candidate.name}
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full object-cover border border-slate-200 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold text-[#004d99]">
                {isLokSabha ? 'Lok Sabha (PC)' : 'State Assembly (AC)'}
              </span>
              <span aria-hidden="true">&middot;</span>
              <span className="truncate">
                {constituency ? constituency.name : candidate.constituencyId}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 truncate mt-0.5">
              {candidate.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <img
                src={party?.symbol || eciLogo}
                alt={party?.abbreviation || 'Party Symbol'}
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full object-contain border border-slate-200 shrink-0"
              />
              <span className="text-xs font-medium text-slate-700 truncate">
                {party ? `${party.name} (${party.abbreviation})` : candidate.partyId}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
          <p>
            <strong className="text-slate-800">Election:</strong>{' '}
            {election ? election.name : candidate.electionId}
          </p>
          {stateName && (
            <p>
              <strong className="text-slate-800">State / UT:</strong> {stateName}
            </p>
          )}
          {candidate.education && (
            <p>
              <strong className="text-slate-800">Education:</strong>{' '}
              {candidate.education}
            </p>
          )}
          {candidate.biography && (
            <p className="line-clamp-2 text-slate-600 mt-1">
              {candidate.biography}
            </p>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Status: <strong className="text-slate-800">{candidate.status}</strong> &middot;{' '}
          {candidate.metadataSource || 'DEMO_SAMPLE'}
        </span>
        {onSelectProfile && (
          <button
            type="button"
            onClick={() => onSelectProfile(candidate)}
            className="font-semibold text-[#004d99] hover:underline cursor-pointer"
          >
            View Manifesto
          </button>
        )}
      </div>
    </div>
  );
}
