import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import VotingStatus from '../../components/voter/VotingStatus';
import ElectionCard from '../../components/voter/ElectionCard';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import {
  ELECTION_TYPES,
  ELECTION_STATUSES,
  PARTICIPATION_STATUSES,
  PARTICIPATION_STATUS_STYLES,
} from '../../utils/constants';

const HUB_TABS = [
  { id: 'ALL', label: 'All Elections' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'PENDING_PARTICIPATION', label: 'Participation Pending' },
];

export default function ElectionHub() {
  const [searchParams] = useSearchParams();
  const initialElectionId = searchParams.get('electionId');

  const {
    currentVoter,
    voterParliamentaryConstituency,
    voterAssemblyConstituency,
    eligibleElections,
    participationSummary,
    getElectionParticipationStatus,
    getConstituencyForVoterElection,
    getCandidatesForVoterElection,
    simulateParticipationForCurrentVoter,
  } = useVoter();
  const { states, parties, candidates } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [activeTab, setActiveTab] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [electionStatusFilter, setElectionStatusFilter] = useState('ALL');
  const [participationFilter, setParticipationFilter] = useState('ALL');

  const [inspectedElection, setInspectedElection] = useState(() => {
    if (!initialElectionId) return null;
    return eligibleElections.find((e) => e.electionId === initialElectionId) || null;
  });

  const availableYears = useMemo(() => {
    const yrs = new Set(eligibleElections.map((e) => String(e.year)));
    return Array.from(yrs).sort((a, b) => Number(b) - Number(a));
  }, [eligibleElections]);

  const filteredElections = useMemo(() => {
    return eligibleElections.filter((election) => {
      const partStatus = getElectionParticipationStatus(election);

      // Tab filter
      if (activeTab === 'ACTIVE' && election.status !== ELECTION_STATUSES.ACTIVE) {
        return false;
      }
      if (activeTab === 'UPCOMING' && election.status !== ELECTION_STATUSES.UPCOMING) {
        return false;
      }
      if (
        activeTab === 'COMPLETED' &&
        election.status !== ELECTION_STATUSES.COMPLETED &&
        partStatus !== PARTICIPATION_STATUSES.VOTED
      ) {
        return false;
      }
      if (
        activeTab === 'PENDING_PARTICIPATION' &&
        partStatus !== PARTICIPATION_STATUSES.PENDING
      ) {
        return false;
      }

      // Dropdown filters
      if (typeFilter !== 'ALL' && election.electionType !== typeFilter) return false;
      if (yearFilter !== 'ALL' && String(election.year) !== yearFilter) return false;
      if (stateFilter !== 'ALL') {
        const elState = election.stateId || currentVoter?.stateId;
        if (elState !== stateFilter && election.stateId !== 'ALL_INDIA') return false;
      }
      if (
        electionStatusFilter !== 'ALL' &&
        election.status !== electionStatusFilter
      ) {
        return false;
      }
      if (participationFilter !== 'ALL' && partStatus !== participationFilter) {
        return false;
      }

      return true;
    });
  }, [
    eligibleElections,
    activeTab,
    typeFilter,
    yearFilter,
    stateFilter,
    electionStatusFilter,
    participationFilter,
    getElectionParticipationStatus,
    currentVoter?.stateId,
  ]);

  if (!currentVoter) return null;

  const handleSimulateParticipation = (election) => {
    const res = simulateParticipationForCurrentVoter(election.electionId);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Demo participation status updated to VOTED for ${election.title} (Ref: ${res.referenceId}). Other eligible elections remain independent.`
    );
  };

  const resetFilters = () => {
    setActiveTab('ALL');
    setTypeFilter('ALL');
    setYearFilter('ALL');
    setStateFilter('ALL');
    setElectionStatusFilter('ALL');
    setParticipationFilter('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Simultaneous Election Progress Bar */}
      <VotingStatus summary={participationSummary} />

      {/* Page Header & Phase 3 Notice */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Voter Eligibility &amp; Simultaneous Election Tracker
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              My Eligible Elections ({eligibleElections.length})
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Displaying elections matched strictly to your Parliamentary Constituency (
              <strong>{voterParliamentaryConstituency?.name} PC</strong>) and State Assembly
              Constituency (<strong>{voterAssemblyConstituency?.name} AC</strong>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/voter/history"
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800"
            >
              Participation History
            </Link>
            <Link
              to="/voter/candidates"
              className="px-4 py-2 rounded-xl bg-[#002868] hover:bg-blue-900 text-xs font-bold text-white"
            >
              Candidate Directory &rarr;
            </Link>
          </div>
        </div>

        {/* Tabs: All Elections | Active | Upcoming | Completed | Participation Pending */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {HUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#002868] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 5 Filters: Election Type, Year, State, Election Status, Participation Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Election Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Types (LS &amp; Assembly)</option>
              <option value={ELECTION_TYPES.LOK_SABHA}>Lok Sabha (PC)</option>
              <option value={ELECTION_TYPES.STATE_ASSEMBLY}>State Assembly (AC)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Election Year
            </label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              State / Jurisdiction
            </label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Eligible Jurisdictions</option>
              {states
                .filter((st) => st.stateId === currentVoter.stateId)
                .map((st) => (
                  <option key={st.stateId} value={st.stateId}>
                    {st.stateName} ({st.stateId})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Election Status
            </label>
            <select
              value={electionStatusFilter}
              onChange={(e) => setElectionStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Schedule Statuses</option>
              <option value={ELECTION_STATUSES.ACTIVE}>Active</option>
              <option value={ELECTION_STATUSES.UPCOMING}>Upcoming</option>
              <option value={ELECTION_STATUSES.COMPLETED}>Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Participation Status
            </label>
            <select
              value={participationFilter}
              onChange={(e) => setParticipationFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Participation States</option>
              <option value={PARTICIPATION_STATUSES.PENDING}>Pending</option>
              <option value={PARTICIPATION_STATUSES.VOTED}>Voted (Completed)</option>
              <option value={PARTICIPATION_STATUSES.UPCOMING}>Upcoming</option>
              <option value={PARTICIPATION_STATUSES.CLOSED}>Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filtered Eligible Election Cards */}
      {filteredElections.length === 0 ? (
        <EmptyState
          title="No Eligible Elections Match Current Filters"
          description="Try clearing your tab or dropdown filters to view all elections mapped to your Parliamentary and Assembly constituencies."
          actionLabel="Reset All Election Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredElections.map((election) => {
            const targetConstituency = getConstituencyForVoterElection(election);
            const partStatus = getElectionParticipationStatus(election);
            const record = currentVoter.elections?.[election.electionId];
            const candidateCount = candidates.filter(
              (c) =>
                c.electionId === election.electionId &&
                c.constituencyId === targetConstituency?.constituencyId &&
                c.approvalStatus === 'APPROVED'
            ).length;

            return (
              <ElectionCard
                key={election.electionId}
                election={election}
                constituency={targetConstituency}
                participationStatus={partStatus}
                participatedAt={record?.participatedAt}
                candidateCount={candidateCount}
                onParticipate={(el) => setInspectedElection(el)}
                onSimulateStatus={handleSimulateParticipation}
              />
            );
          })}
        </div>
      )}

      {/* Election Inspection Modal (Displays Status, Schedule, and Contesting Candidates) */}
      <Modal
        isOpen={Boolean(inspectedElection)}
        onClose={() => setInspectedElection(null)}
        title={
          inspectedElection
            ? `${inspectedElection.title} (${inspectedElection.electionId})`
            : 'Election Details'
        }
      >
        {inspectedElection && (
          <div className="space-y-4 text-xs">
            {(() => {
              const targetConst = getConstituencyForVoterElection(inspectedElection);
              const partStatus = getElectionParticipationStatus(inspectedElection);
              const statusStyle =
                PARTICIPATION_STATUS_STYLES[partStatus] ||
                PARTICIPATION_STATUS_STYLES.PENDING;
              const elCandidates = getCandidatesForVoterElection(inspectedElection);
              const record = currentVoter.elections?.[inspectedElection.electionId];

              return (
                <>
                  <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                        {inspectedElection.electionType === ELECTION_TYPES.LOK_SABHA
                          ? 'Lok Sabha Parliamentary Constituency'
                          : 'State Legislative Assembly Constituency'}
                      </span>
                      <h3 className="text-base font-extrabold mt-0.5">
                        {targetConst?.name} ({targetConst?.code})
                      </h3>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                    >
                      {statusStyle.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Polling Date</span>
                      <strong className="text-slate-900">
                        {inspectedElection.schedule?.pollingDate || 'TBA'}
                      </strong>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Counting Date</span>
                      <strong className="text-slate-900">
                        {inspectedElection.schedule?.countingDate || 'TBA'}
                      </strong>
                    </div>
                  </div>

                  {record?.participated && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                      <strong>Participation Completed:</strong> Marked VOTED on{' '}
                      {new Date(record.participatedAt).toLocaleString('en-IN')} (Demo Ref:{' '}
                      <code className="font-mono font-bold">
                        {record.referenceId || 'DEMO-REF-VERIFIED'}
                      </code>
                      ). No candidate or party choice is stored in your voter record.
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase text-slate-600">
                        Contesting Candidates in {targetConst?.name} ({elCandidates.length})
                      </span>
                      <Link
                        to={`/voter/candidates?electionId=${inspectedElection.electionId}`}
                        className="font-bold text-[#002868] hover:underline"
                      >
                        Open in Candidate Directory &rarr;
                      </Link>
                    </div>
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                      {elCandidates.map((cand) => {
                        const party = parties.find((p) => p.partyId === cand.partyId);
                        return (
                          <div
                            key={cand.candidateId}
                            className="p-2.5 bg-white flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={cand.photoUrl}
                                alt={cand.name}
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                              />
                              <div>
                                <strong className="text-slate-900 block">
                                  {cand.name}
                                </strong>
                                <span className="text-[11px] text-slate-500">
                                  {party?.partyName} ({party?.abbreviation})
                                </span>
                              </div>
                            </div>
                            <span className="text-[11px] font-mono text-slate-500">
                              Ballot #{cand.ballotNumber}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-slate-700 flex flex-wrap items-center justify-between gap-3">
                    <span>
                      <strong>Phase 3 Note:</strong> Actual ballot candidate selection and
                      vote confirmation are scheduled for Phase 4. You can test independent
                      participation status transitions below:
                    </span>
                    {partStatus === PARTICIPATION_STATUSES.PENDING && (
                      <button
                        type="button"
                        onClick={() => handleSimulateParticipation(inspectedElection)}
                        className="px-3.5 py-2 rounded-lg bg-[#002868] text-white font-bold cursor-pointer"
                      >
                        Simulate Participation (Mark VOTED)
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
