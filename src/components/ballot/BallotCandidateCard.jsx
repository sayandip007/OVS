import React from 'react';
import { defaultAvatar, eciLogo } from '../../assets';

/**
 * Reusable Candidate Ballot Card for both Lok Sabha and State Assembly ballots.
 * Contains:
 * 1. Candidate photograph (with fallback)
 * 2. Candidate name
 * 3. Party name or Independent designation
 * 4. Party symbol (with fallback)
 * 5. View profile option (does NOT auto-select candidate)
 * 6. Accessible selection radio control
 */
export default function BallotCandidateCard({
  candidate,
  party,
  index = 0,
  isSelected = false,
  onSelectCandidate,
  onViewProfile,
}) {
  if (!candidate) return null;

  const candId = candidate.id || candidate.candidateId;
  const ballotNo = candidate.ballotNumber || index + 1;
  const photoSrc = candidate.photograph || candidate.photoUrl || defaultAvatar;
  const symbolSrc = party?.symbol || party?.symbolUrl || eciLogo;

  const isIndependent =
    candidate.partyId === 'PARTY-IND' ||
    candidate.partyId === 'IND' ||
    party?.abbreviation === 'IND' ||
    party?.type === 'INDEPENDENT';

  const partyNameDisplay = isIndependent
    ? 'Independent Candidate'
    : party?.name || party?.partyName || 'Independent Candidate';

  const partyAbbrDisplay = isIndependent
    ? 'IND'
    : party?.abbreviation || candidate.partyId || 'IND';

  const handleCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectCandidate(candId);
    }
  };

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={handleCardKeyDown}
      onClick={() => onSelectCandidate(candId)}
      data-testid={`ballot-candidate-card-${candId}`}
      className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-[#002868] ${
        isSelected
          ? 'border-[#002868] bg-blue-50/70 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      }`}
    >
      {/* Left: Ballot Number, Candidate Photo, Name & Party */}
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold font-mono shrink-0 ${
            isSelected
              ? 'bg-[#002868] text-white'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {ballotNo}
        </div>

        <img
          src={photoSrc}
          alt={candidate.name}
          referrerPolicy="no-referrer"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-slate-300 bg-slate-50 shrink-0"
        />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
              {candidate.name}
            </h3>
            {isIndependent && (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wider">
                Independent
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-600 truncate">
            {partyNameDisplay} ({partyAbbrDisplay})
          </p>

          <div className="pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile(candidate, party);
              }}
              data-testid={`view-profile-btn-${candId}`}
              className="text-xs font-bold text-[#002868] hover:underline focus:outline-none focus:ring-2 focus:ring-[#002868] rounded px-1 -ml-1 cursor-pointer"
            >
              View Profile &amp; Manifesto &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Right: Party Symbol, Simulated EVM Lamp & Selection Radio Control */}
      <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0">
            <img
              src={symbolSrc}
              alt={`${partyAbbrDisplay} Symbol`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Simulated EVM LED Lamp */}
          <span
            aria-hidden="true"
            title={isSelected ? 'Simulated Lamp ON' : 'Simulated Lamp OFF'}
            className={`w-4 h-4 rounded-full border transition-all ${
              isSelected
                ? 'bg-red-600 border-red-700 shadow-[0_0_10px_#dc2626]'
                : 'bg-slate-200 border-slate-300'
            }`}
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCandidate(candId);
            }}
            aria-label={`Select ${candidate.name} (${partyAbbrDisplay})`}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-2 ${
              isSelected
                ? 'bg-[#002868] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                isSelected ? 'border-white bg-white' : 'border-slate-500'
              }`}
            >
              {isSelected && (
                <span className="w-2 h-2 rounded-full bg-[#002868]" />
              )}
            </span>
            <span>{isSelected ? 'SELECTED' : 'Select Candidate'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
