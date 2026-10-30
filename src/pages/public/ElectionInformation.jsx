import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import PageHeader from '../../components/common/PageHeader';
import SearchBar from '../../components/common/SearchBar';
import EmptyState from '../../components/common/EmptyState';
import {
  ELECTION_TYPES,
  ELECTION_TYPE_LABELS,
  ELECTION_STATUS_LABELS,
  CONSTITUENCY_TYPES,
} from '../../utils/constants';

export default function ElectionInformation() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') || 'ALL';

  const { elections, states, constituencies, candidates } = useElection();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');

  const filteredElections = useMemo(() => {
    return elections.filter((el) => {
      if (typeFilter !== 'ALL' && el.electionType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && el.status !== statusFilter) return false;
      if (stateFilter !== 'ALL') {
        if (el.electionType === ELECTION_TYPES.STATE_ASSEMBLY && el.stateId !== stateFilter) {
          return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = el.title.toLowerCase().includes(q);
        const matchId = el.electionId.toLowerCase().includes(q);
        const matchDesc = (el.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchDesc) return false;
      }
      return true;
    });
  }, [elections, typeFilter, statusFilter, stateFilter, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        badge="Electoral Schedule & Jurisdiction Directory"
        title="Elections Information Portal"
        subtitle="Inspect nationwide Lok Sabha General Elections and State Legislative Assembly Elections, their polling schedules, and mapped constituencies."
        actions={
          <Link
            to="/voter/login"
            className="px-4 py-2 bg-[#FF9933] hover:bg-amber-500 text-slate-950 text-sm font-bold rounded-lg transition-colors"
          >
            Voter Login to Participate
          </Link>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search election title or ID..."
        />

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#002868]"
        >
          <option value="ALL">All Election Types</option>
          <option value={ELECTION_TYPES.LOK_SABHA}>
            Lok Sabha General Election (PARLIAMENTARY)
          </option>
          <option value={ELECTION_TYPES.STATE_ASSEMBLY}>
            State Legislative Assembly (ASSEMBLY)
          </option>
        </select>

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#002868]"
        >
          <option value="ALL">All States &amp; UTs</option>
          {states.map((st) => (
            <option key={st.stateId} value={st.stateId}>
              {st.stateName} ({st.stateId})
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#002868]"
        >
          <option value="ALL">All Lifecycle Statuses</option>
          {Object.entries(ELECTION_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Elections List */}
      {filteredElections.length === 0 ? (
        <EmptyState
          title="No Matching Elections Found"
          description="Try clearing your search query or switching the Election Type or State filter."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearch('');
            setTypeFilter('ALL');
            setStatusFilter('ALL');
            setStateFilter('ALL');
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredElections.map((election) => {
            const isLS = election.electionType === ELECTION_TYPES.LOK_SABHA;
            const stateObj = states.find((s) => s.stateId === election.stateId);
            const applicableConstituencies = isLS
              ? constituencies.filter(
                  (c) => c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
                )
              : constituencies.filter(
                  (c) =>
                    c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY &&
                    c.stateId === election.stateId
                );
            const electionCandidates = candidates.filter(
              (c) => c.electionId === election.electionId
            );

            return (
              <div
                key={election.electionId}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                          isLS
                            ? 'bg-indigo-100 text-indigo-900'
                            : 'bg-teal-100 text-teal-900'
                        }`}
                      >
                        {ELECTION_TYPE_LABELS[election.electionType]}
                      </span>
                      <span className="px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                        ID: {election.electionId}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          election.status === 'POLLING_ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : election.status === 'RESULTS_DECLARED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ELECTION_STATUS_LABELS[election.status] || election.status}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 pt-1">
                      {election.title}
                    </h2>
                    <p className="text-sm text-slate-600">{election.description}</p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Link
                      to={`/candidates?electionId=${election.electionId}`}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800"
                    >
                      Candidates ({electionCandidates.length})
                    </Link>
                    <Link
                      to={`/results?electionId=${election.electionId}`}
                      className="px-3.5 py-2 rounded-lg bg-[#002868] hover:bg-blue-900 text-xs font-bold text-white"
                    >
                      Tallies &amp; Results
                    </Link>
                  </div>
                </div>

                {/* Schedule & Scope Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-slate-500 block">Jurisdiction</span>
                    <strong className="text-slate-900">
                      {isLS
                        ? 'Nationwide (All India)'
                        : `${stateObj?.stateName || election.stateId}`}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-slate-500 block">Constituency Type</span>
                    <strong className="text-slate-900">
                      {isLS ? 'PARLIAMENTARY (PC)' : 'ASSEMBLY (AC)'} (
                      {applicableConstituencies.length} seats)
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-slate-500 block">Announcement</span>
                    <strong className="text-slate-900">
                      {election.announcementDate || 'TBA'}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-slate-500 block">Nominations Close</span>
                    <strong className="text-slate-900">
                      {election.nominationEndDate || 'TBA'}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-slate-500 block">Polling Date</span>
                    <strong className="text-emerald-800">{election.pollingDate}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-slate-500 block">Result Date</span>
                    <strong className="text-indigo-900">
                      {election.resultDate || 'TBA'}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
