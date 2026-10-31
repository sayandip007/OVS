import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import {
  ELECTION_TYPES,
  RESULT_STATUSES,
  RESULT_STATUS_LABELS,
} from '../../utils/constants';
import { countingService } from '../../services/countingService';
import {
  SimulatedResultDisclaimer,
  PartySeatsBarChart,
  VoteShareDonutChart,
} from '../../components/results/ResultCharts';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';

export default function AssemblyResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStateId = searchParams.get('stateId') || 'WB';

  const {
    results = [],
    elections = [],
    constituencies = [],
    candidates = [],
    parties = [],
    states = [],
  } = useElection();

  const assemblyElections = useMemo(
    () =>
      elections.filter(
        (e) => (e.type || e.electionType) === ELECTION_TYPES.STATE_ASSEMBLY
      ),
    [elections]
  );

  // States that have configured Assembly elections first, plus all 36 states/UTs
  const [selectedStateId, setSelectedStateId] = useState(initialStateId);

  const matchedElection = useMemo(
    () =>
      assemblyElections.find((e) => e.stateId === selectedStateId) || null,
    [assemblyElections, selectedStateId]
  );

  const assemblyAnalytics = useMemo(
    () =>
      countingService.computeStateAssemblyAnalytics({
        electionId: matchedElection?.id || matchedElection?.electionId,
        stateId: selectedStateId,
        results,
        elections,
        constituencies,
        candidates,
        parties,
        states,
        publicOnly: true,
      }),
    [
      matchedElection,
      selectedStateId,
      results,
      elections,
      constituencies,
      candidates,
      parties,
      states,
    ]
  );

  const handleStateChange = (nextStateId) => {
    setSelectedStateId(nextStateId);
    setSearchParams({ stateId: nextStateId });
  };

  const handleExportAssemblySummary = () => {
    const csv = countingService.exportAssemblyStateSummaryCSV(assemblyAnalytics);
    countingService.triggerCsvDownload(
      `assembly-state-summary-${selectedStateId}-${
        assemblyAnalytics.electionId || '2029'
      }.csv`,
      csv
    );
  };

  const handleExportPartySummary = () => {
    const csv = countingService.exportPartyWiseResultCSV(
      {
        electionId: assemblyAnalytics.electionId,
        stateId: selectedStateId,
        partyRows: assemblyAnalytics.partyRows,
      },
      `${selectedStateId}_ASSEMBLY`
    );
    countingService.triggerCsvDownload(
      `assembly-party-wise-${selectedStateId}.csv`,
      csv
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <Link
            to="/results"
            className="inline-flex items-center gap-1.5 font-semibold text-[#002868] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Public Results Hub
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-900">
            State Legislative Assembly Results Dashboard
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportAssemblySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Assembly State Summary CSV
          </button>
          <button
            type="button"
            onClick={handleExportPartySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            State Party-Wise CSV
          </button>
        </div>
      </div>

      <SimulatedResultDisclaimer compact />

      {/* Header & State Selector */}
      <div className="bg-[#002868] text-white rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-amber-300 font-semibold">
            State Legislative Assembly Election Results (STATE_ASSEMBLY)
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {assemblyAnalytics.stateName} — {assemblyAnalytics.electionName}
          </h1>
          <p className="text-xs text-blue-100">
            Independent state-specific Assembly results · Never combined across states or mixed with Lok Sabha
          </p>
        </div>

        <div className="w-full lg:w-80">
          <label
            htmlFor="assembly-state-select"
            className="block text-xs text-blue-200 mb-1 font-medium"
          >
            1. Select State / Union Territory
          </label>
          <select
            id="assembly-state-select"
            value={selectedStateId}
            onChange={(e) => handleStateChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg text-xs font-bold bg-white text-slate-900 focus:outline-none"
          >
            {states.map((st) => {
              const sid = st.id || st.stateId;
              const hasAsmElection = assemblyElections.some(
                (e) => e.stateId === sid
              );
              return (
                <option key={sid} value={sid}>
                  {st.name || st.stateName} ({sid})
                  {hasAsmElection ? ' — Active Demo Election' : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Quick State Switcher Pills for Configured Demo States */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">
          Quick Select Configured Assembly Elections:
        </span>
        {assemblyElections.map((el) => (
          <button
            key={el.id || el.electionId}
            type="button"
            onClick={() => handleStateChange(el.stateId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
              selectedStateId === el.stateId
                ? 'bg-[#002868] text-white border-[#002868]'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {el.name || el.title} ({el.stateId})
          </button>
        ))}
      </div>

      {/* State Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">
            Configured Assembly Seats
          </span>
          <p className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
            {assemblyAnalytics.configuredResultRecordsCount} /{' '}
            {assemblyAnalytics.totalConfiguredACs} ACs
          </p>
          <span className="text-[11px] text-slate-500 block">
            {assemblyAnalytics.unconfiguredACsCount} unconfigured ACs in {selectedStateId}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">Results Declared</span>
          <p className="text-xl font-extrabold text-emerald-700 font-mono tabular-nums">
            {assemblyAnalytics.resultsDeclaredCount}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Published Assembly results
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">Counting in Progress</span>
          <p className="text-xl font-extrabold text-amber-700 font-mono tabular-nums">
            {assemblyAnalytics.countingInProgressCount}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Ongoing round-by-round counting
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">Results Pending</span>
          <p className="text-xl font-extrabold text-slate-700 font-mono tabular-nums">
            {assemblyAnalytics.resultsPendingCount}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Draft or awaiting review
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">
            State Votes Counted (Simulated)
          </span>
          <p className="text-xl font-extrabold text-[#002868] font-mono tabular-nums">
            {assemblyAnalytics.totalSimulatedVotesCounted.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-slate-500 block">
            NOTA: {assemblyAnalytics.totalNotaVotes.toLocaleString('en-IN')} votes
          </span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PartySeatsBarChart
          partyRows={assemblyAnalytics.partyRows}
          title={`${assemblyAnalytics.stateName} Assembly Party-Wise Seats (Simulated)`}
          subtitle={`Strictly scoped to ${assemblyAnalytics.stateName} (${selectedStateId})`}
        />
        <VoteShareDonutChart
          partyRows={assemblyAnalytics.partyRows}
          notaVotes={assemblyAnalytics.totalNotaVotes}
          notaSharePct={countingService.roundPercentage(
            assemblyAnalytics.totalNotaVotes,
            assemblyAnalytics.totalSimulatedVotesCounted
          )}
          totalCountedVotes={assemblyAnalytics.totalSimulatedVotesCounted}
          title={`${assemblyAnalytics.stateName} Assembly Vote Share`}
        />
      </div>

      {/* Assembly Constituency Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {assemblyAnalytics.stateName} Assembly Constituency Results
            </h2>
            <p className="text-xs text-slate-500">
              Unpublished or draft constituencies hide candidate vote totals until official publication
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {assemblyAnalytics.constituencySummaries.length} configured AC result record(s)
          </span>
        </div>

        {assemblyAnalytics.constituencySummaries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No demo Assembly result records are configured for {assemblyAnalytics.stateName} ({selectedStateId}). Select West Bengal (WB), NCT of Delhi (DL), or Maharashtra (MH) to inspect configured Assembly datasets.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-3 px-4 font-semibold">
                    Assembly Constituency
                  </th>
                  <th className="py-3 px-4 font-semibold">Counting Status</th>
                  <th className="py-3 px-4 font-semibold">
                    Winning / Leading Candidate
                  </th>
                  <th className="py-3 px-4 font-semibold">Party</th>
                  <th className="py-3 px-4 font-semibold text-right">
                    Votes Received
                  </th>
                  <th className="py-3 px-4 font-semibold text-right">
                    Victory / Lead Margin
                  </th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assemblyAnalytics.constituencySummaries.map((c) => {
                  const isPub = c.isPublished;
                  const isCnt =
                    c.status === RESULT_STATUSES.COUNTING_IN_PROGRESS ||
                    c.status === RESULT_STATUSES.COUNTING_PAUSED;
                  const topCand = isPub
                    ? c.winnerCandidate
                    : isCnt
                    ? c.leadingCandidate
                    : null;

                  return (
                    <tr key={c.resultId} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">
                          {c.constituencyName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {c.constituencyId}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            isPub
                              ? 'text-emerald-700'
                              : isCnt
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {RESULT_STATUS_LABELS[c.status] || c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {topCand ? (
                          <div>
                            <span className="font-bold text-slate-900">
                              {topCand.name}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-1.5">
                              ({isPub ? 'WINNER' : 'LEADING'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">
                            Pending Publication
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {topCand
                          ? `${topCand.partyName} (${topCand.partyAbbreviation})`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {topCand
                          ? `${topCand.totalVotes.toLocaleString('en-IN')} (${
                              topCand.votePercentage
                            }%)`
                          : 'Hidden (Draft)'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-800 font-bold">
                        {topCand
                          ? `+${(
                              (isPub ? c.victoryMargin : c.leadingMargin) || 0
                            ).toLocaleString('en-IN')}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/results/${c.electionId}/${c.constituencyId}`}
                          className="inline-flex items-center gap-1 font-bold text-[#002868] hover:underline"
                        >
                          View Details
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
