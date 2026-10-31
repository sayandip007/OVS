import React from 'react';
import Modal from '../common/Modal';
import { defaultAvatar, eciLogo } from '../../assets';
import { ELECTION_TYPES } from '../../utils/constants';

const FALLBACK_TEXT = 'Information not available in demo dataset.';

/**
 * Reusable Candidate Profile Modal used across both the Public Candidate Directory
 * and the Lok Sabha / State Assembly Ballot interfaces.
 * Viewing a candidate profile never automatically selects the candidate on the ballot.
 */
export default function CandidateProfileModal({
  isOpen,
  onClose,
  candidate,
  party,
  constituency,
  election,
  stateName,
}) {
  if (!candidate) return null;

  const isLokSabha =
    (candidate.electionType || election?.type || election?.electionType) ===
    ELECTION_TYPES.LOK_SABHA;

  const isIndependent =
    candidate.partyId === 'PARTY-IND' ||
    candidate.partyId === 'IND' ||
    party?.abbreviation === 'IND' ||
    party?.type === 'INDEPENDENT';

  const photoSrc = candidate.photograph || candidate.photoUrl || defaultAvatar;
  const symbolSrc = party?.symbol || party?.symbolUrl || eciLogo;

  const partyDisplay = isIndependent
    ? 'Independent Candidate (IND)'
    : party
    ? `${party.name || party.partyName} (${party.abbreviation})`
    : candidate.partyId || FALLBACK_TEXT;

  const biographyText =
    candidate.biography && String(candidate.biography).trim()
      ? candidate.biography
      : FALLBACK_TEXT;

  const educationText =
    candidate.education && String(candidate.education).trim()
      ? candidate.education
      : FALLBACK_TEXT;

  const manifestoText =
    (candidate.manifesto && String(candidate.manifesto).trim()) ||
    (candidate.manifestoSummary && String(candidate.manifestoSummary).trim()) ||
    FALLBACK_TEXT;

  const declarationText =
    candidate.publicDeclaration && String(candidate.publicDeclaration).trim()
      ? candidate.publicDeclaration
      : FALLBACK_TEXT;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Candidate Profile: ${candidate.name}`}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
        >
          Close Candidate Profile
        </button>
      }
    >
      <div className="space-y-4 text-xs sm:text-sm" data-testid="candidate-profile-modal">
        {/* Candidate Identity Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b border-slate-200">
          <img
            src={photoSrc}
            alt={candidate.name}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 bg-slate-50 shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                  isLokSabha
                    ? 'bg-indigo-100 text-indigo-900'
                    : 'bg-teal-100 text-teal-900'
                }`}
              >
                {isLokSabha
                  ? 'Lok Sabha Election (MP)'
                  : 'State Assembly Election (MLA)'}
              </span>
              {candidate.ballotNumber && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                  Ballot #{candidate.ballotNumber}
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
              {candidate.name}
            </h3>

            <div className="flex items-center gap-2 pt-0.5">
              <img
                src={symbolSrc}
                alt={party?.abbreviation || 'Party Symbol'}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded object-contain bg-white border border-slate-200 p-0.5 shrink-0"
              />
              <span className="text-xs font-bold text-slate-700">
                {partyDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Constituency & Election Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Constituency</span>
            <strong className="text-slate-900">
              {constituency?.name || candidate.constituencyId || FALLBACK_TEXT}
            </strong>
            {stateName && (
              <span className="block text-[11px] text-slate-500 mt-0.5">
                State / UT: {stateName}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Election Type &amp; ID</span>
            <strong className="text-slate-900">
              {isLokSabha
                ? 'Lok Sabha General Election'
                : 'State Legislative Assembly Election'}{' '}
              ({candidate.electionId})
            </strong>
          </div>
        </div>

        {/* Biography */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Biography
          </span>
          <p className="text-xs text-slate-800 leading-relaxed">{biographyText}</p>
        </div>

        {/* Education */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Education
          </span>
          <p className="text-xs text-slate-800 leading-relaxed">{educationText}</p>
        </div>

        {/* Manifesto */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#002868] block">
            Candidate Manifesto &amp; Priorities
          </span>
          <p className="text-xs text-slate-800 leading-relaxed">{manifestoText}</p>
        </div>

        {/* Public Declaration */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Public Declaration Information
          </span>
          <p className="text-xs text-slate-700 leading-relaxed">
            {declarationText}
          </p>
        </div>
      </div>
    </Modal>
  );
}
