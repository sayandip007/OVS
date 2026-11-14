import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import VotingStatus from '../../components/voter/VotingStatus';
import ElectionCard from '../../components/voter/ElectionCard';
import EmptyState from '../../components/common/EmptyState';
import {
  ELECTION_TYPES,
  ELECTION_STATUSES,
  PARTICIPATION_STATUSES,
} from '../../utils/constants';

const HUB_TABS = [
  { id: 'ALL', label: 'All Elections' },
  { id: 'ACTIVE', label: 'Active Polling' },
  { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'PENDING_PARTICIPATION', label: 'Participation Pending' },
];

export default function ElectionHub() {
  const navigate = useNavigate();

  const {
    currentVoter,
    voterState,
    voterParliamentaryConstituency,
    voterAssemblyConstituency,
    eligibleElections,
    participationSummary,
    controlledDemoPollingMode,
    setControlledDemoPollingMode,
    getElectionParticipationStatus,
    getConstituencyForVoterElection,
  } = useVoter();
  const { states, candidates } = useElection();

  const [activeTab, setActiveTab] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [electionStatusFilter, setElectionStatusFilter] = useState('ALL');
  const [participationFilter, setParticipationFilter] = useState('ALL');

  const availableYears = useMemo(() => {
    const yrs = new Set(eligibleElections.map((e) => String(e.year)));
    return Array.from(yrs).sort((a, b) => Number(b) - Number(a));
  }, [eligibleElections]);

  const filteredElections = useMemo(() => {
    return eligibleElections.filter((election) => {
      const partStatus = getElectionParticipationStatus(election);
      const isPollingOpen =
        election.status === 'POLLING_ACTIVE' || election.status === 'ACTIVE';
      const isCompletedStatus =
        election.status === 'RESULTS_DECLARED' ||
        election.status === 'POLLING_COMPLETED' ||
        election.status === 'COMPLETED';

      // Tab filter
      if (activeTab === 'ACTIVE' && !isPollingOpen) {
        return false;
      }
      if (activeTab === 'UPCOMING' && election.status !== 'UPCOMING') {
        return false;
      }
      if (
        activeTab === 'COMPLETED' &&
        !isCompletedStatus &&
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
      const elType = election.type || election.electionType;
      if (typeFilter !== 'ALL' && elType !== typeFilter) return false;
      if (yearFilter !== 'ALL' && String(election.year) !== yearFilter)
        return false;
      if (stateFilter !== 'ALL') {
        const elState = election.stateId || currentVoter?.stateId;
        if (elState !== stateFilter && election.stateId !== null) return false;
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

      {/* Page Header & Controlled Demo Mode Toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Electoral Hub
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              My Eligible Elections ({eligibleElections.length})
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Active elections for <strong>{voterParliamentaryConstituency?.name} PC</strong> and <strong>{voterAssemblyConstituency?.name} AC</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                setControlledDemoPollingMode((prev) => !prev)
              }
              data-testid="toggle-controlled-demo-polling-btn"
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                controlledDemoPollingMode
                  ? 'bg-amber-500 text-slate-950 border-amber-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="Enable controlled test polling mode to test upcoming elections without changing system dates"
            >
              {controlledDemoPollingMode
                ? 'Controlled Demo Polling: ON'
                : 'Enable Controlled Demo Polling Mode'}
            </button>
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
              <option value={ELECTION_TYPES.STATE_ASSEMBLY}>
                State Assembly (AC)
              </option>
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
              <option value={ELECTION_STATUSES.POLLING_ACTIVE}>
                Polling Active
              </option>
              <option value={ELECTION_STATUSES.UPCOMING}>Upcoming</option>
              <option value={ELECTION_STATUSES.RESULTS_DECLARED}>
                Results Declared
              </option>
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
              <option value={PARTICIPATION_STATUSES.VOTED}>
                Voted (Completed)
              </option>
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
            const elId = election.id || election.electionId;
            const targetConstituency = getConstituencyForVoterElection(election);
            const partStatus = getElectionParticipationStatus(election);
            const record = currentVoter.elections?.[elId];
            const candidateCount = candidates.filter(
              (c) =>
                c.electionId === elId &&
                c.constituencyId ===
                  (targetConstituency?.id ||
                    targetConstituency?.constituencyId) &&
                (c.status || c.approvalStatus) === 'APPROVED'
            ).length;

            return (
              <ElectionCard
                key={elId}
                election={election}
                constituency={targetConstituency}
                stateName={voterState?.name || voterState?.stateName}
                participationStatus={partStatus}
                participatedAt={record?.participatedAt}
                referenceId={record?.referenceId}
                demoReference={record?.demoReference}
                candidateCount={candidateCount}
                controlledDemoPollingMode={controlledDemoPollingMode}
                onParticipate={(el) =>
                  navigate(`/voter/elections/${el.id || el.electionId}/info`)
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
