import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import BallotHeader from '../../components/ballot/BallotHeader';
import DemoReceipt from '../../components/ballot/DemoReceipt';
import { PARTICIPATION_STATUSES } from '../../utils/constants';

/**
 * Phase 4 — Section 12: Non-Sensitive Demo Confirmation Receipt Page.
 * Route: /voter/elections/:electionId/receipt
 */
export default function BallotReceiptPage() {
  const { electionId } = useParams();
  const {
    currentVoter,
    voterState,
    eligibleElections,
    getConstituencyForVoterElection,
    getElectionParticipationStatus,
  } = useVoter();
  const { elections, states } = useElection();

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

  const remainingPendingElections = useMemo(() => {
    return eligibleElections.filter((el) => {
      const elId = el.id || el.electionId;
      if (elId === electionId) return false;
      return (
        getElectionParticipationStatus(el) === PARTICIPATION_STATUSES.PENDING
      );
    });
  }, [eligibleElections, electionId, getElectionParticipationStatus]);

  if (!currentVoter) return null;

  if (!election) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4">
        <h1 className="text-xl font-extrabold text-slate-900">
          Election Receipt Not Found
        </h1>
        <p className="text-xs text-slate-600">
          The requested election ID (&ldquo;{electionId}&rdquo;) was not found.
        </p>
        <Link
          to="/voter/elections"
          className="inline-block px-5 py-2.5 rounded-xl bg-[#002868] text-white text-xs font-bold"
        >
          &larr; Return to My Elections
        </Link>
      </div>
    );
  }

  const participationRecord =
    currentVoter.elections?.[election.id || election.electionId];
  const isCompleted =
    participationRecord?.status === 'VOTED' ||
    participationRecord?.participated === true;

  if (!isCompleted) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-4">
        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase">
          Participation Pending
        </span>
        <h1 className="text-xl font-extrabold text-slate-900">
          No Completed Demo Participation Receipt for {election.name || election.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          You have not yet completed the demonstration ballot workflow for this
          election.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to={`/voter/elections/${
              election.id || election.electionId
            }/ballot`}
            className="px-5 py-2.5 rounded-xl bg-[#002868] text-white text-xs font-bold"
          >
            Open Demo Ballot &rarr;
          </Link>
          <Link
            to="/voter/elections"
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
          >
            Back to My Elections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ballot-receipt-page">
      <BallotHeader
        election={election}
        constituency={eligibleConstituency}
        stateName={electionStateObj?.name || electionStateObj?.stateName}
        voterEpic={currentVoter.voterRef}
        currentStep="RECEIPT"
      />

      <DemoReceipt
        election={election}
        constituency={eligibleConstituency}
        stateName={electionStateObj?.name || electionStateObj?.stateName}
        participationRecord={participationRecord}
        remainingEligibleElections={remainingPendingElections}
      />
    </div>
  );
}
