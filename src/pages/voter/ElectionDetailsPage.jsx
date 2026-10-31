import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import BallotHeader from '../../components/ballot/BallotHeader';
import CandidateProfileModal from '../../components/ballot/CandidateProfileModal';
import {
  ELECTION_TYPES,
  ELECTION_STATUS_LABELS,
  PARTICIPATION_STATUS_STYLES,
} from '../../utils/constants';
import {
  getElectionStatusExplanation,
  filterAndSortBallotCandidates,
} from '../../services/ballotValidationService';
import { defaultAvatar, eciLogo } from '../../assets';

/**
 * Phase 4 — Section 5: Dedicated Election Information & Pre-Ballot Eligibility Screen.
 * Route: /voter/elections/:electionId/info (and /voter/elections/:electionId)
 */
export default function ElectionDetailsPage() {
  const { electionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    currentVoter,
    voterState,
    controlledDemoPollingMode,
    setControlledDemoPollingMode,
    getConstituencyForVoterElection,
    getElectionParticipationStatus,
    checkBallotEligibilityForVoter,
    recordCandidateView,
  } = useVoter();
  const { elections, candidates, parties, states } = useElection();

  const [profileModalData, setProfileModalData] = useState(null);

  const demoParamOverride = searchParams.get('demoMode') === 'true';

  const election = useMemo(
    () =>
      elections.find((e) => (e.id || e.electionId) === electionId) || null,
    [elections, electionId]
  );

  const eligibleConstituency = useMemo(
    () => (election ? getConstituencyForVoterElection(election) : null),
    [election, getConstituencyForVoterElection]
  );

  const electionStateObj = useMemo(() => {
    const stId = election?.stateId || eligibleConstituency?.stateId || currentVoter?.stateId;
    return states.find((s) => (s.id || s.stateId) === stId) || voterState;
  }, [election, eligibleConstituency, currentVoter, states, voterState]);

  const ballotCandidates = useMemo(() => {
    if (!election || !eligibleConstituency) return [];
    return filterAndSortBallotCandidates({
      candidates,
      electionId: election.id || election.electionId,
      constituencyId:
        eligibleConstituency.id || eligibleConstituency.constituencyId,
      electionType: election.type || election.electionType,
      parties,
    });
  }, [candidates, election, eligibleConstituency, parties]);

  if (!currentVoter) return null;

  if (!election) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4">
        <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold uppercase">
          Invalid Election ID
        </span>
        <h1 className="text-xl font-extrabold text-slate-900">
          Election &ldquo;{electionId}&rdquo; Was Not Found
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          The requested election ID does not exist in the local demonstration
          dataset. Please return to My Elections to select a valid Lok Sabha or
          State Legislative Assembly election.
        </p>
        <div>
          <Link
            to="/voter/elections"
            className="inline-block px-5 py-2.5 rounded-xl bg-[#002868] text-white text-xs font-bold"
          >
            &larr; Return to My Elections
          </Link>
        </div>
      </div>
    );
  }

  const isLokSabha =
    (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA;
  const participationStatus = getElectionParticipationStatus(election);
  const statusStyle =
    PARTICIPATION_STATUS_STYLES[participationStatus] ||
    PARTICIPATION_STATUS_STYLES.PENDING;
  const validation = checkBallotEligibilityForVoter(election, demoParamOverride);
  const statusExplanation = getElectionStatusExplanation(election.status);

  const handleViewCandidateProfile = (cand, party) => {
    recordCandidateView(cand.id || cand.candidateId);
    setProfileModalData({ candidate: cand, party });
  };

  return (
    <div className="space-y-6" data-testid="election-info-screen">
      {/* 1. Prominent Ballot Header with Role Distinction & 4-Step Indicator */}
      <BallotHeader
        election={election}
        constituency={eligibleConstituency}
        stateName={electionStateObj?.name || electionStateObj?.stateName}
        voterEpic={currentVoter.voterRef}
        currentStep="INFO"
      />

      {/* 2. Eligibility Verification & Open Ballot Call-to-Action Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Pre-Ballot Eligibility &amp; Schedule Verification
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
              {isLokSabha
                ? 'Parliamentary Election — Select your Member of Parliament.'
                : 'State Legislative Assembly Election — Select your Member of Legislative Assembly.'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold">
              Election Status:{' '}
              {ELECTION_STATUS_LABELS[election.status] || election.status}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyle.badgeClass}`}
            >
              Participation: {statusStyle.label}
            </span>
          </div>
        </div>

        {/* Comprehensive Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Election Name &amp; Year
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {election.name || election.title} ({election.year || 2029})
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Eligible {isLokSabha ? 'Parliamentary (PC)' : 'Assembly (AC)'} Seat
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {eligibleConstituency?.name || 'Not Mapped'} (
              {eligibleConstituency?.code || eligibleConstituency?.id || 'N/A'})
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Polling Schedule Window
            </span>
            <strong className="text-sm text-emerald-800 mt-0.5 block tabular-nums">
              {election.pollingStartDate || election.pollingDate || 'TBA'} to{' '}
              {election.pollingEndDate || election.pollingDate || 'TBA'}
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              Contesting Demo Candidates
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {ballotCandidates.length} Candidates + NOTA
            </strong>
          </div>
        </div>

        {/* Status / Eligibility Action Box */}
        {validation.canOpenBallot ? (
          <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold uppercase text-[10px]">
                Eligibility Verified
              </span>
              <h3 className="text-base font-extrabold text-emerald-950">
                Ready to Open{' '}
                {isLokSabha
                  ? 'Lok Sabha General Election'
                  : 'State Legislative Assembly'}{' '}
                Demo Ballot
              </h3>
              <p className="text-emerald-900">{statusExplanation}</p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/voter/elections/${election.id || election.electionId}/ballot${
                    controlledDemoPollingMode || demoParamOverride
                      ? '?demoMode=true'
                      : ''
                  }`
                )
              }
              data-testid="proceed-to-ballot-btn"
              className="px-6 py-3 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs sm:text-sm font-extrabold shadow-xs shrink-0 cursor-pointer"
            >
              {isLokSabha
                ? 'Open Lok Sabha Demo Ballot \u2192'
                : 'Open Assembly Demo Ballot \u2192'}
            </button>
          </div>
        ) : validation.alreadyParticipated ? (
          <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-800 text-white font-bold uppercase text-[10px]">
                Participation Completed (VOTED)
              </span>
              <h3 className="text-base font-extrabold text-emerald-950">
                You Have Already Completed Demo Participation for This Election
              </h3>
              <p className="text-emerald-900">{validation.reason}</p>
            </div>

            <Link
              to={`/voter/elections/${
                election.id || election.electionId
              }/receipt`}
              className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold shrink-0"
            >
              View Demo Confirmation Receipt &rarr;
            </Link>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <span className="px-2 py-0.5 rounded bg-amber-800 text-white font-bold uppercase text-[10px]">
                  Ballot Currently Unavailable ({validation.code})
                </span>
                <h3 className="text-base font-extrabold text-amber-950">
                  Why This Demo Ballot Cannot Be Opened Right Now
                </h3>
                <p className="text-amber-900 leading-relaxed">
                  {validation.reason}
                </p>
              </div>

              {/* Controlled Demo Test Mode Toggle for UPCOMING / READY Elections */}
              {['ELECTION_NOT_ACTIVE', 'POLLING_NOT_STARTED'].includes(
                validation.code
              ) && (
                <button
                  type="button"
                  onClick={() => setControlledDemoPollingMode(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  Enable Controlled Demo Test Polling Mode
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Contesting Candidates Directory Preview for This Constituency */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Constituency Candidate Roll
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Contesting Demo Candidates in {eligibleConstituency?.name} (
              {ballotCandidates.length})
            </h2>
          </div>

          <Link
            to={`/voter/candidates?electionId=${
              election.id || election.electionId
            }`}
            className="text-xs font-bold text-[#002868] hover:underline"
          >
            Open Full Candidate Directory &rarr;
          </Link>
        </div>

        {ballotCandidates.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">
            No contesting candidates are currently nominated for this constituency
            in the demo dataset.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ballotCandidates.map((cand, idx) => {
              const party = parties.find(
                (p) => (p.id || p.partyId) === cand.partyId
              );
              return (
                <div
                  key={cand.id || cand.candidateId}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {cand.ballotNumber || idx + 1}
                    </span>
                    <img
                      src={cand.photograph || cand.photoUrl || defaultAvatar}
                      alt={cand.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-300 bg-white shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {cand.name}
                      </h3>
                      <p className="text-xs text-slate-600 truncate">
                        {party?.name || party?.partyName || 'Independent'} (
                        {party?.abbreviation || 'IND'})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <img
                      src={party?.symbol || party?.symbolUrl || eciLogo}
                      alt={party?.abbreviation || 'Symbol'}
                      className="w-8 h-8 rounded object-contain bg-white border border-slate-200 p-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleViewCandidateProfile(cand, party)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#002868] cursor-pointer"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Important Ballot Instructions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3 text-xs text-slate-700">
        <h2 className="text-base font-extrabold text-slate-900">
          Important Demonstration Ballot Instructions
        </h2>
        <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
          <li>
            Verify that the election title and your eligible{' '}
            <strong>
              {isLokSabha
                ? 'Parliamentary Constituency (MP)'
                : 'Assembly Constituency (MLA)'}
            </strong>{' '}
            match your intended election before selecting a candidate.
          </li>
          <li>
            You may inspect any candidate&rsquo;s profile, biography, education,
            and manifesto without automatically selecting them on the ballot.
          </li>
          <li>
            Select exactly <strong>one candidate</strong> or{' '}
            <strong>None of the Above (NOTA)</strong>, then proceed to the
            Review screen.
          </li>
          <li>
            Completing this election updates only{' '}
            <strong>{election.id || election.electionId}</strong>. Any other
            simultaneous election remains independent.
          </li>
        </ol>
      </div>

      {/* Candidate Profile Modal */}
      <CandidateProfileModal
        isOpen={Boolean(profileModalData)}
        onClose={() => setProfileModalData(null)}
        candidate={profileModalData?.candidate}
        party={profileModalData?.party}
        constituency={eligibleConstituency}
        election={election}
        stateName={electionStateObj?.name || electionStateObj?.stateName}
      />
    </div>
  );
}
