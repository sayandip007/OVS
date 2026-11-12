import React, { useState, useEffect, useMemo } from 'react';
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { frontendEnv } from '../../config/env';
import { apiClient } from '../../services/apiClient';
import BallotHeader from '../../components/ballot/BallotHeader';
import BallotCandidateCard from '../../components/ballot/BallotCandidateCard';
import NOTACard from '../../components/ballot/NOTACard';
import CandidateProfileModal from '../../components/ballot/CandidateProfileModal';
import BallotReview from '../../components/ballot/BallotReview';
import DemoConfirmationModal from '../../components/ballot/DemoConfirmationModal';
import EmptyState from '../../components/common/EmptyState';
import { ELECTION_TYPES, NOTA_OPTION } from '../../utils/constants';
import {
  filterAndSortBallotCandidates,
  resolveTemporaryBallotSelection,
} from '../../services/ballotValidationService';

function BackendBallotPage() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const { csrfToken } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  // STRICT PRIVACY: Temporary candidate selection exists ONLY in volatile React state.
  // Never stored in localStorage, sessionStorage, IndexedDB, cookies, URL, or sent to backend.
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [step, setStep] = useState('BALLOT'); // 'BALLOT' | 'REVIEW'
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ballotError, setBallotError] = useState(null);
  const [ballot, setBallot] = useState(null);

  useEffect(() => {
    setSelectedCandidateId(null);
    setStep('BALLOT');
    setConfirmOpen(false);
    return () => {
      setSelectedCandidateId(null);
    };
  }, [electionId]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setBallotError(null);
      try {
        const res = await apiClient.voter.getBallot(electionId);
        if (active) setBallot(res?.data || null);
      } catch (err) {
        if (active) {
          setBallotError(err?.detail || err?.message || 'Unable to load demo ballot.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [electionId]);

  const selectedCandidate = useMemo(
    () =>
      (ballot?.candidates || []).find((c) => c.candidateId === selectedCandidateId) ||
      null,
    [ballot, selectedCandidateId]
  );

  const handleConfirmParticipation = async () => {
    setSubmitting(true);
    try {
      // STRICT PRIVACY: Empty body only — candidateId is NEVER transmitted.
      await apiClient.voter.confirmParticipation(electionId, csrfToken);
      setSelectedCandidateId(null);
      setConfirmOpen(false);
      notifySuccess('Demo participation recorded. Candidate choice was not transmitted.');
      navigate(`/voter/elections/${encodeURIComponent(electionId)}/receipt`);
    } catch (err) {
      if (err?.status === 401) {
        setSelectedCandidateId(null);
        notifyError('Your session has expired. Please sign in again.');
        navigate('/voter/login');
        return;
      }
      notifyError(err?.detail || err?.message || 'Could not record participation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Loading demo ballot...
      </div>
    );
  }

  if (ballotError || !ballot) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-4">
        <h1 className="text-xl font-extrabold text-slate-900">Ballot Unavailable</h1>
        <p className="text-sm text-slate-600">{ballotError || 'Ballot could not be loaded.'}</p>
        <Link
          to="/voter/dashboard"
          className="inline-block px-4 py-2 rounded-xl bg-[#002868] text-white text-xs font-bold"
        >
          Back to Voter Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-blue-100 text-[#002868] text-[11px] font-bold uppercase">
              {ballot.election.type.replace('_', ' ')} DEMO BALLOT
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1">
              {ballot.election.name}
            </h1>
            <p className="text-xs text-slate-600">
              Constituency: <strong>{ballot.constituency.name}</strong> ({ballot.constituency.id})
              {ballot.election.state?.name ? ` • ${ballot.election.state.name}` : ''}
            </p>
          </div>
          <Link
            to="/voter/dashboard"
            onClick={() => setSelectedCandidateId(null)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
          >
            Cancel & Clear Selection
          </Link>
        </div>
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {ballot.disclaimer}
        </p>
      </div>

      {step === 'BALLOT' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ballot.candidates.map((cand) => {
              const isSelected = selectedCandidateId === cand.candidateId;
              return (
                <button
                  key={cand.nominationId}
                  type="button"
                  onClick={() => setSelectedCandidateId(cand.candidateId)}
                  className={`text-left p-4 rounded-2xl border-2 transition space-y-2 ${
                    isSelected
                      ? 'border-[#002868] bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {cand.photoUrl && (
                        <img
                          src={cand.photoUrl}
                          alt={cand.fullName}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                        />
                      )}
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">
                          {cand.ballotOrder}. {cand.fullName}
                        </p>
                        <p className="text-xs text-slate-600">
                          {cand.isIndependent
                            ? 'Independent Candidate'
                            : `${cand.party?.name} (${cand.party?.abbreviation})`}
                        </p>
                      </div>
                    </div>
                    {cand.party?.symbolUrl && (
                      <img
                        src={cand.party.symbolUrl}
                        alt={cand.party.symbolName || cand.party.name}
                        className="w-8 h-8 object-contain"
                      />
                    )}
                  </div>
                  {(cand.education || cand.profession || cand.bio) && (
                    <p className="text-[11px] text-slate-600">
                      {[cand.profession, cand.education, cand.bio].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!selectedCandidate}
              onClick={() => setStep('REVIEW')}
              className="px-5 py-2.5 rounded-xl bg-[#002868] text-white text-sm font-bold disabled:opacity-40"
            >
              Review Selection
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            Review Temporary Selection (Browser Memory Only)
          </h2>
          <p className="text-sm text-slate-700">
            Selected Candidate: <strong>{selectedCandidate?.fullName}</strong> (
            {selectedCandidate?.isIndependent
              ? 'Independent'
              : selectedCandidate?.party?.name}
            )
          </p>
          <p className="text-xs text-slate-600">
            When you confirm, only your participation status is sent to the server. Your candidate
            selection stays strictly in local memory and is cleared immediately after confirmation.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep('BALLOT')}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold"
            >
              Change Selection
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="px-5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold"
            >
              Proceed to Final Confirmation
            </button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-extrabold text-slate-900">
              Confirm Educational Demo Participation
            </h3>
            <p className="text-xs text-slate-600">
              This action records that you participated in{' '}
              <strong>{ballot.election.name}</strong> ({ballot.constituency.name}). Your candidate
              selection is <strong>not</strong> transmitted or stored.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmParticipation}
                className="px-4 py-2 rounded-xl bg-[#002868] text-white text-xs font-bold"
              >
                {submitting ? 'Recording...' : 'Confirm Participation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Phase 4 — Sections 6, 7, 8, 9, 10, 14, 17:
 * Dedicated Lok Sabha & State Assembly Ballot Interface.
 * Route: /voter/elections/:electionId/ballot
 *
 * CRITICAL PRIVACY & STATE HYGIENE RULES:
 * - Temporary candidate selection (`selectedOptionId`) exists ONLY in volatile component state.
 * - Never persisted to localStorage or sessionStorage.
 * - Automatically cleared when `electionId` changes, workflow is cancelled, submission completes,
 *   or component unmounts.
 */
export default function BallotPage() {
  if (frontendEnv.isBackendApiMode) {
    return <BackendBallotPage />;
  }
  return <LocalDemoBallotPage />;
}

function LocalDemoBallotPage() {
  const { electionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    currentVoter,
    voterState,
    setControlledDemoPollingMode,
    getConstituencyForVoterElection,
    checkBallotEligibilityForVoter,
    completeDemoParticipationForCurrentVoter,
    recordCandidateView,
  } = useVoter();
  const { elections, candidates, parties, states } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const demoParamOverride = searchParams.get('demoMode') === 'true';

  // Volatile in-memory ballot state ONLY (never saved to localStorage)
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [workflowStep, setWorkflowStep] = useState('BALLOT'); // 'BALLOT' | 'REVIEW'
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [profileModalData, setProfileModalData] = useState(null);

  // Search, Party Filter, and Sort controls
  const [searchQuery, setSearchQuery] = useState('');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('BALLOT_ORDER');

  // Clear temporary selection whenever electionId changes or component unmounts
  useEffect(() => {
    setSelectedOptionId(null);
    setWorkflowStep('BALLOT');
    setConfirmModalOpen(false);
    setProfileModalData(null);
    setSearchQuery('');
    setPartyFilter('ALL');
    setSortBy('BALLOT_ORDER');

    return () => {
      setSelectedOptionId(null);
    };
  }, [electionId, currentVoter?.id]);

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
    const stId =
      election?.stateId ||
      eligibleConstituency?.stateId ||
      currentVoter?.stateId;
    return states.find((s) => (s.id || s.stateId) === stId) || voterState;
  }, [election, eligibleConstituency, currentVoter, states, voterState]);

  // All approved candidates strictly for THIS electionId + THIS constituencyId + THIS electionType
  const allConstituencyCandidates = useMemo(() => {
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

  // Filtered and sorted candidates for display
  const displayedCandidates = useMemo(() => {
    if (!election || !eligibleConstituency) return [];
    return filterAndSortBallotCandidates({
      candidates,
      electionId: election.id || election.electionId,
      constituencyId:
        eligibleConstituency.id || eligibleConstituency.constituencyId,
      electionType: election.type || election.electionType,
      parties,
      searchQuery,
      partyFilter,
      sortBy,
    });
  }, [
    candidates,
    election,
    eligibleConstituency,
    parties,
    searchQuery,
    partyFilter,
    sortBy,
  ]);

  // Parties contesting in this specific constituency for the filter dropdown
  const contestingParties = useMemo(() => {
    const partyIds = new Set(allConstituencyCandidates.map((c) => c.partyId));
    return parties.filter((p) => partyIds.has(p.id || p.partyId));
  }, [allConstituencyCandidates, parties]);

  // Resolve temporary selection against current constituency candidates (Edge Case 19: if candidate data changes, stale selection invalidates)
  const resolvedTemporarySelection = useMemo(
    () =>
      resolveTemporaryBallotSelection({
        selectedOptionId,
        ballotCandidates: allConstituencyCandidates,
        parties,
      }),
    [selectedOptionId, allConstituencyCandidates, parties]
  );

  // If candidate data changed and invalidated the selected candidate, clear selection
  useEffect(() => {
    if (selectedOptionId && !resolvedTemporarySelection) {
      setSelectedOptionId(null);
      setWorkflowStep('BALLOT');
    }
  }, [selectedOptionId, resolvedTemporarySelection]);

  if (!currentVoter) return null;

  // Edge Case 20: Invalid election ID opened manually
  if (!election) {
    return (
      <div
        className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4"
        data-testid="ballot-invalid-election"
      >
        <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold uppercase">
          Election Validation Failed (ELECTION_NOT_FOUND)
        </span>
        <h1 className="text-xl font-extrabold text-slate-900">
          Invalid Election ID: &ldquo;{electionId}&rdquo;
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          The requested election does not exist in the local demonstration
          dataset. Please select an eligible election from your Election Hub.
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

  const validation = checkBallotEligibilityForVoter(
    election,
    demoParamOverride
  );
  const isLokSabha =
    (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA;

  // Edge Case 11 / Scenario E: Voter attempts to reopen an already completed election
  if (validation.alreadyParticipated) {
    return (
      <div className="space-y-6" data-testid="ballot-already-completed-screen">
        <BallotHeader
          election={election}
          constituency={eligibleConstituency}
          stateName={electionStateObj?.name || electionStateObj?.stateName}
          voterEpic={currentVoter.voterRef}
          currentStep="RECEIPT"
        />

        <div className="bg-white rounded-2xl border-2 border-emerald-300 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-700 text-white flex items-center justify-center text-2xl font-extrabold mx-auto">
            &#10003;
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold uppercase">
            Participation Status: VOTED
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Demo Participation Already Completed for {election.name || election.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
            {validation.reason} Your participation status for{' '}
            <strong>{eligibleConstituency?.name}</strong> is locked as{' '}
            <code className="font-mono font-bold">VOTED</code> (Ref:{' '}
            <code className="font-mono font-bold">
              {validation.demoReference || 'DEMO-VERIFIED'}
            </code>
            ).
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={`/voter/elections/${
                election.id || election.electionId
              }/receipt`}
              className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold"
            >
              View Demo Confirmation Receipt &rarr;
            </Link>
            <Link
              to="/voter/elections"
              className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold"
            >
              Return to My Elections
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Edge Cases 7, 8, 9, 10: Election cancelled, not active, polling ended, or voter ineligible
  if (!validation.canOpenBallot) {
    return (
      <div className="space-y-6" data-testid="ballot-access-blocked-screen">
        <BallotHeader
          election={election}
          constituency={eligibleConstituency}
          stateName={electionStateObj?.name || electionStateObj?.stateName}
          voterEpic={currentVoter.voterRef}
          currentStep="INFO"
        />

        <div className="bg-white rounded-2xl border-2 border-amber-300 p-8 text-center space-y-4">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-950 text-xs font-bold uppercase">
            Ballot Access Blocked ({validation.code})
          </span>
          <h2 className="text-xl font-extrabold text-slate-900">
            Cannot Open Ballot for {election.name || election.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 max-w-xl mx-auto leading-relaxed">
            {validation.reason}
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {['ELECTION_NOT_ACTIVE', 'POLLING_NOT_STARTED'].includes(
              validation.code
            ) && (
              <button
                type="button"
                onClick={() => setControlledDemoPollingMode(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold cursor-pointer"
              >
                Enable Controlled Demo Test Polling Mode
              </button>
            )}
            <Link
              to={`/voter/elections/${
                election.id || election.electionId
              }/info`}
              className="px-5 py-2.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold"
            >
              &larr; View Election Information
            </Link>
            <Link
              to="/voter/elections"
              className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold"
            >
              Back to My Elections
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Handlers for candidate selection, profile viewing, review, and confirmation
  const handleSelectOption = (optionId) => {
    setSelectedOptionId(optionId);
  };

  const handleClearSelection = () => {
    setSelectedOptionId(null);
    setWorkflowStep('BALLOT');
  };

  const handleViewCandidateProfile = (cand, party) => {
    recordCandidateView(cand.id || cand.candidateId);
    setProfileModalData({ candidate: cand, party });
  };

  const handleProceedToReview = () => {
    if (!resolvedTemporarySelection) {
      notifyError(
        'Please select one candidate or NOTA before proceeding to the review screen.'
      );
      return;
    }
    setWorkflowStep('REVIEW');
  };

  const handleCompleteDemoParticipation = () => {
    if (!election || !resolvedTemporarySelection) return;

    const targetElectionId = election.id || election.electionId;
    const result = completeDemoParticipationForCurrentVoter(targetElectionId);

    // Immediately clear temporary candidate selection from memory!
    setSelectedOptionId(null);
    setConfirmModalOpen(false);

    if (!result.ok) {
      notifyError(result.error || 'Could not complete demo participation.');
      return;
    }

    notifySuccess(
      `Demo participation completed for ${
        election.name || election.title
      }! Temporary candidate choice discarded.`
    );
    navigate(`/voter/elections/${targetElectionId}/receipt`, { replace: true });
  };

  return (
    <div
      className="space-y-6"
      data-testid={
        isLokSabha ? 'lok-sabha-ballot-page' : 'state-assembly-ballot-page'
      }
    >
      {/* 1. Prominent Ballot Header */}
      <BallotHeader
        election={election}
        constituency={eligibleConstituency}
        stateName={electionStateObj?.name || electionStateObj?.stateName}
        voterEpic={currentVoter.voterRef}
        currentStep={workflowStep}
      />

      {workflowStep === 'REVIEW' && resolvedTemporarySelection ? (
        /* Step 3: Ballot Review Screen */
        <BallotReview
          election={election}
          constituency={eligibleConstituency}
          stateName={electionStateObj?.name || electionStateObj?.stateName}
          temporarySelection={resolvedTemporarySelection}
          onBackToBallot={() => setWorkflowStep('BALLOT')}
          onClearAndReturn={handleClearSelection}
          onOpenConfirmDialog={() => setConfirmModalOpen(true)}
        />
      ) : (
        /* Step 2: Candidate Ballot Selection Interface */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
          {/* Search, Party Filter, Sort, and Clear Selection Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
                {isLokSabha
                  ? 'Lok Sabha Parliamentary Constituency Ballot Unit'
                  : 'State Legislative Assembly Constituency Ballot Unit'}
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Select One Candidate or NOTA for {eligibleConstituency?.name}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedOptionId && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  data-testid="clear-ballot-selection-btn"
                  className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold cursor-pointer"
                >
                  Clear Candidate Selection
                </button>
              )}
              <Link
                to={`/voter/elections/${
                  election.id || election.electionId
                }/info`}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold"
              >
                &larr; Election Info
              </Link>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Search Candidate or Party
              </label>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by candidate or party name..."
                data-testid="ballot-candidate-search"
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Filter by Political Party
              </label>
              <select
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                data-testid="ballot-party-filter"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white"
              >
                <option value="ALL">
                  All Contesting Parties ({allConstituencyCandidates.length})
                </option>
                {contestingParties.map((p) => (
                  <option key={p.id || p.partyId} value={p.id || p.partyId}>
                    {p.name || p.partyName} ({p.abbreviation})
                  </option>
                ))}
                <option value="INDEPENDENT">Independent Candidates Only</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Sort Ballot Order
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                data-testid="ballot-sort-select"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white"
              >
                <option value="BALLOT_ORDER">
                  Official Ballot Serial Order
                </option>
                <option value="NAME_ASC">Candidate Name (A &rarr; Z)</option>
                <option value="NAME_DESC">Candidate Name (Z &rarr; A)</option>
              </select>
            </div>
          </div>

          {/* Candidate Cards List + NOTA */}
          <div
            role="radiogroup"
            aria-label={`Ballot options for ${eligibleConstituency?.name}`}
            className="space-y-3 pt-1"
          >
            {allConstituencyCandidates.length === 0 ? (
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                <strong className="block text-sm">
                  No Nominated Candidates in Demo Dataset for{' '}
                  {eligibleConstituency?.name}
                </strong>
                <p>
                  No contesting candidate records were found for this
                  constituency in the local dataset. You may still select None of
                  the Above (NOTA) below or return to the Election Hub.
                </p>
              </div>
            ) : displayedCandidates.length === 0 ? (
              <EmptyState
                title="No Candidates Match Your Search or Party Filter"
                description="Clear your search text or party filter to see all nominated candidates on this ballot."
                actionLabel="Reset Ballot Filters"
                onAction={() => {
                  setSearchQuery('');
                  setPartyFilter('ALL');
                }}
              />
            ) : (
              displayedCandidates.map((cand, index) => {
                const candId = cand.id || cand.candidateId;
                const party = parties.find(
                  (p) => (p.id || p.partyId) === cand.partyId
                );
                return (
                  <BallotCandidateCard
                    key={candId}
                    candidate={cand}
                    party={party}
                    index={index}
                    isSelected={selectedOptionId === candId}
                    onSelectCandidate={handleSelectOption}
                    onViewProfile={handleViewCandidateProfile}
                  />
                );
              })
            )}

            {/* Mandatory NOTA Option at the Bottom of Every Ballot */}
            <NOTACard
              ballotNumber={allConstituencyCandidates.length + 1}
              isSelected={selectedOptionId === NOTA_OPTION.id}
              onSelectNota={handleSelectOption}
            />
          </div>

          {/* Sticky / Bottom Selection Status & Review Action Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs sm:text-sm">
              {resolvedTemporarySelection ? (
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Temporary Selection Active (Not Saved to Storage)
                  </span>
                  <p>
                    Selected Option:{' '}
                    <strong
                      data-testid="ballot-active-selection-summary"
                      className="text-white font-extrabold"
                    >
                      {resolvedTemporarySelection.label} (
                      {resolvedTemporarySelection.partyAbbreviation})
                    </strong>
                  </p>
                </div>
              ) : (
                <p className="text-slate-300">
                  Select exactly <strong>one candidate</strong> or{' '}
                  <strong>NOTA</strong> above to enable the ballot review step.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {selectedOptionId && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                disabled={!resolvedTemporarySelection}
                onClick={handleProceedToReview}
                data-testid="review-ballot-selection-btn"
                className="px-6 py-3 rounded-xl bg-[#138808] hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs sm:text-sm font-extrabold shadow-xs transition-colors cursor-pointer"
              >
                Review Selection &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Profile Details Modal (Never auto-selects candidate) */}
      <CandidateProfileModal
        isOpen={Boolean(profileModalData)}
        onClose={() => setProfileModalData(null)}
        candidate={profileModalData?.candidate}
        party={profileModalData?.party}
        constituency={eligibleConstituency}
        election={election}
        stateName={electionStateObj?.name || electionStateObj?.stateName}
      />

      {/* Final Demo Confirmation Modal */}
      <DemoConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleCompleteDemoParticipation}
        election={election}
        constituency={eligibleConstituency}
      />
    </div>
  );
}
