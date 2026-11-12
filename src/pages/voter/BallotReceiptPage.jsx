import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import { frontendEnv } from '../../config/env';
import { apiClient } from '../../services/apiClient';
import BallotHeader from '../../components/ballot/BallotHeader';
import DemoReceipt from '../../components/ballot/DemoReceipt';
import { PARTICIPATION_STATUSES } from '../../utils/constants';

function BackendBallotReceiptPage() {
  const { electionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.voter.getElectionParticipation(electionId);
        if (active) setRecord(res?.data || null);
      } catch (err) {
        if (active) setError(err?.detail || err?.message || 'Participation confirmation not found.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [electionId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Loading participation confirmation...
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-4">
        <h1 className="text-xl font-extrabold text-slate-900">
          Participation Confirmation Not Found
        </h1>
        <p className="text-xs text-slate-600">{error}</p>
        <Link
          to="/voter/dashboard"
          className="inline-block px-4 py-2 rounded-xl bg-[#002868] text-white text-xs font-bold"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-emerald-200 p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
          {record.status}
        </span>
        <span className="text-xs font-mono text-slate-500">{record.demoReference}</span>
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900">
        Demo Participation Confirmed
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <p className="text-slate-500">Election</p>
          <p className="font-bold text-slate-900">{record.electionName}</p>
        </div>
        <div>
          <p className="text-slate-500">Election Type</p>
          <p className="font-bold text-slate-900">{record.electionType?.replace('_', ' ')}</p>
        </div>
        <div>
          <p className="text-slate-500">Constituency</p>
          <p className="font-bold text-slate-900">
            {record.constituency?.name || record.constituency?.id || 'Mapped Constituency'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Confirmation Timestamp</p>
          <p className="font-bold text-slate-900">
            {new Date(record.participatedAt).toLocaleString()}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-slate-500">Demo Reference ID</p>
          <p className="font-mono font-bold text-slate-900">{record.referenceId}</p>
        </div>
      </div>
      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
        {record.disclaimer} Candidate selections are never included in receipts or participation
        records.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/voter/dashboard"
          className="px-4 py-2 rounded-xl bg-[#002868] text-white text-xs font-bold"
        >
          Back to Voter Dashboard
        </Link>
        <Link
          to="/voter/history"
          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold"
        >
          View Participation History
        </Link>
      </div>
    </div>
  );
}

/**
 * Phase 4 — Section 12: Non-Sensitive Demo Confirmation Receipt Page.
 * Route: /voter/elections/:electionId/receipt
 */
export default function BallotReceiptPage() {
  if (frontendEnv.isBackendApiMode) {
    return <BackendBallotReceiptPage />;
  }
  return <LocalDemoBallotReceiptPage />;
}

function LocalDemoBallotReceiptPage() {
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
