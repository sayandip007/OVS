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
import {
  ArrowLeft,
  Download,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export default function LokSabhaResults() {
  const [searchParams] = useSearchParams();
  const initialElectionId = searchParams.get('electionId') || 'LS-2029';

  const {
    results = [],
    elections = [],
    constituencies = [],
    candidates = [],
    parties = [],
    states = [],
  } = useElection();

  const lsElections = useMemo(
    () =>
      elections.filter(
        (e) => (e.type || e.electionType) === ELECTION_TYPES.LOK_SABHA
      ),
    [elections]
  );

  const [selectedElectionId, setSelectedElectionId] = useState(
    lsElections.some((e) => (e.id || e.electionId) === initialElectionId)
      ? initialElectionId
      : lsElections[0]?.id || lsElections[0]?.electionId || 'LS-2029'
  );
  const [stateFilter, setStateFilter] = useState('ALL');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const nationalAnalytics = useMemo(
    () =>
      countingService.computeLokSabhaNationalAnalytics({
        electionId: selectedElectionId,
        results,
        elections,
        constituencies,
        candidates,
        parties,
        states,
        publicOnly: true,
      }),
    [
      selectedElectionId,
      results,
      elections,
      constituencies,
      candidates,
      parties,
      states,
    ]
  );

  const scopedResults = useMemo(() => {
    const lsList = results.filter(
      (r) =>
        r.electionId === selectedElectionId &&
        r.electionType === ELECTION_TYPES.LOK_SABHA
    );

    return lsList.filter((r) => {
      if (stateFilter !== 'ALL' && r.stateId !== stateFilter) return false;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PUBLISHED' && !countingService.isResultPubliclyVisible(r))
          return false;
        if (
          statusFilter === 'COUNTING' &&
          r.status !== RESULT_STATUSES.COUNTING_IN_PROGRESS &&
          r.status !== RESULT_STATUSES.COUNTING_PAUSED
        )
          return false;
        if (
          statusFilter === 'PENDING' &&
          (countingService.isResultPubliclyVisible(r) ||
            r.status === RESULT_STATUSES.COUNTING_IN_PROGRESS ||
            r.status === RESULT_STATUSES.COUNTING_PAUSED)
        )
          return false;
      }

      if (partyFilter !== 'ALL') {
        const isPub = countingService.isResultPubliclyVisible(r);
        const isCnt =
          r.status === RESULT_STATUSES.COUNTING_IN_PROGRESS ||
          r.status === RESULT_STATUSES.COUNTING_PAUSED;
        if (!isPub && !isCnt) return false;
        const targetCandId = isPub ? r.winnerCandidateId : r.leadingCandidateId;
        const matchedCand = (r.candidates || []).find(
          (c) => c.candidateId === targetCandId
        );
        if (matchedCand?.partyId !== partyFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const seat = constituencies.find(
          (c) => (c.id || c.constituencyId) === r.constituencyId
        );
        const seatName = (seat?.name || r.constituencyId).toLowerCase();
        const candNames = (r.candidates || [])
          .map((c) => (c.snapshotName || '').toLowerCase())
          .join(' ');
        if (!seatName.includes(q) && !candNames.includes(q) && !r.constituencyId.toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [
    results,
    selectedElectionId,
    stateFilter,
    partyFilter,
    statusFilter,
    searchQuery,
    constituencies,
  ]);

  const handleExportNationalSummary = () => {
    const csv = countingService.exportLokSabhaNationalSummaryCSV(
      nationalAnalytics,
      results.filter(countingService.isResultPubliclyVisible)
    );
    countingService.triggerCsvDownload(
      `lok-sabha-national-summary-${selectedElectionId}.csv`,
      csv
    );
  };

  const handleExportPartySummary = () => {
    const csv = countingService.exportPartyWiseResultCSV(
      {
        electionId: selectedElectionId,
        stateId: 'NATIONAL',
        partyRows: nationalAnalytics.partyRows,
      },
      'ALL_PARLIAMENTARY'
    );
    countingService.triggerCsvDownload(
      `lok-sabha-party-wise-${selectedElectionId}.csv`,
      csv
    );
  };

  const handleExportStateSummary = () => {
    const csv = countingService.exportStateWiseResultCSV(
      selectedElectionId,
      nationalAnalytics.resultsWithData
    );
    countingService.triggerCsvDownload(
      `lok-sabha-state-wise-${selectedElectionId}.csv`,
      csv
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation & Export Controls */}
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
            Lok Sabha National Results Dashboard
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportNationalSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            National Summary CSV
          </button>
          <button
            type="button"
            onClick={handleExportPartySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Party-Wise CSV
          </button>
          <button
            type="button"
            onClick={handleExportStateSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            State-Wise CSV
          </button>
        </div>
      </div>

      <SimulatedResultDisclaimer compact />

      {/* Header & Election Selector */}
      <div className="bg-[#002868] text-white rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-amber-300 font-semibold">
            Lok Sabha General Election
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {nationalAnalytics.electionName}
          </h1>
          <p className="text-xs text-blue-100">
            Nationwide Parliamentary Constituencies (543 Seats)
          </p>
        </div>

        <div className="w-full lg:w-80">
          <label
            htmlFor="ls-election-select"
            className="block text-xs text-blue-200 mb-1 font-medium"
          >
            Select Lok Sabha General Election
          </label>
          <select
            id="ls-election-select"
            value={selectedElectionId}
            onChange={(e) => setSelectedElectionId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg text-xs font-bold bg-white text-slate-900 focus:outline-none"
          >
            {lsElections.map((el) => (
              <option
                key={el.id || el.electionId}
                value={el.id || el.electionId}
              >
                {el.name || el.title} ({el.year})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* National Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">
            Configured Result Coverage
          </span>
          <p className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
            {nationalAnalytics.configuredResultRecordsCount} /{' '}
            {nationalAnalytics.totalParliamentaryConstituencies} PCs
          </p>
          <span className="text-[11px] text-slate-500 block">
            {nationalAnalytics.unconfiguredConstituenciesCount} unconfigured PCs (excluded from 0-vote counts)
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">
            Results Declared (Published)
          </span>
          <p className="text-xl font-extrabold text-emerald-700 font-mono tabular-nums">
            {nationalAnalytics.resultsDeclaredCount}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Publicly verified constituency results
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">Counting in Progress</span>
          <p className="text-xl font-extrabold text-amber-700 font-mono tabular-nums">
            {nationalAnalytics.countingInProgressCount}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Leading candidate shown (no winner declared)
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">Results Pending / Review</span>
          <p className="text-xl font-extrabold text-slate-700 font-mono tabular-nums">
            {nationalAnalytics.resultsPendingCount}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Draft or awaiting officer publication
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs text-slate-500">
            Simulated Votes Counted
          </span>
          <p className="text-xl font-extrabold text-[#002868] font-mono tabular-nums">
            {nationalAnalytics.totalSimulatedVotesCounted.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Includes {nationalAnalytics.totalNotaVotes.toLocaleString('en-IN')} NOTA votes
          </span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PartySeatsBarChart
          partyRows={nationalAnalytics.partyRows}
          title="National Party-Wise Seats Won & Leading (Simulated)"
          subtitle="Across published Lok Sabha parliamentary constituency results"
        />
        <VoteShareDonutChart
          partyRows={nationalAnalytics.partyRows}
          notaVotes={nationalAnalytics.totalNotaVotes}
          notaSharePct={countingService.roundPercentage(
            nationalAnalytics.totalNotaVotes,
            nationalAnalytics.totalSimulatedVotesCounted
          )}
          totalCountedVotes={nationalAnalytics.totalSimulatedVotesCounted}
          title="National Vote Share Breakdown (Simulated)"
        />
      </div>

      {/* Party-Wise Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            Party-Wise National Performance Summary
          </h2>
          <p className="text-xs text-slate-500">
            Independent candidates are tracked separately and never merged into political parties
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold">Party</th>
                <th className="py-3 px-4 font-semibold text-right">Seats Won</th>
                <th className="py-3 px-4 font-semibold text-right">
                  Seats Leading
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  Simulated Votes
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  Total Ballot Share (%)
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  Valid Candidate Share (%)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {nationalAnalytics.partyRows.map((p) => (
                <tr key={p.partyId} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-sans">
                    <div className="flex items-center gap-2.5">
                      {p.symbolUrl && (
                        <img
                          src={p.symbolUrl}
                          alt={p.abbreviation}
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 object-contain"
                        />
                      )}
                      <div>
                        <span className="font-bold text-slate-900">
                          {p.partyName}
                        </span>
                        <span className="text-slate-500 ml-1.5">
                          ({p.abbreviation})
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-800">
                    {p.seatsWon}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-amber-700">
                    {p.seatsLeading}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {p.totalVotes.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {p.voteShareTotalBallotPct}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    {p.voteShareValidPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* State-Wise Results Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            State-Wise Lok Sabha Results Coverage
          </h2>
          <p className="text-xs text-slate-500">
            Showing states and union territories with configured demo parliamentary result datasets
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold">State / UT</th>
                <th className="py-3 px-4 font-semibold text-right">
                  Configured PCs
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  Demo Result Records
                </th>
                <th className="py-3 px-4 font-semibold text-right">Declared</th>
                <th className="py-3 px-4 font-semibold text-right">Counting</th>
                <th className="py-3 px-4 font-semibold text-right">Pending</th>
                <th className="py-3 px-4 font-semibold">
                  Party-Wise Seats Won
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nationalAnalytics.resultsWithData.map((st) => (
                <tr key={st.stateId} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {st.stateName} ({st.stateId})
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {st.totalConfiguredPCs}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                    {st.configuredDemoResultRecords}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-bold">
                    {st.declaredCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700 font-semibold">
                    {st.countingCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                    {st.pendingCount}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {Object.entries(st.partySeats).length === 0
                      ? 'Counting / Pending Declaration'
                      : Object.entries(st.partySeats)
                          .map(([abbr, count]) => `${abbr}: ${count}`)
                          .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parliamentary Constituency Directory & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Parliamentary Constituency Result Directory
            </h2>
            <p className="text-xs text-slate-500">
              Filter by State, Party, Counting Status, or search by constituency/candidate
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Showing {scopedResults.length} configured result record(s)
          </span>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search constituency or candidate..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#002868]"
            />
          </div>

          <select
            aria-label="Filter by State"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="ALL">All States &amp; UTs</option>
            {states.map((st) => (
              <option key={st.id || st.stateId} value={st.id || st.stateId}>
                {st.name || st.stateName} ({st.id || st.stateId})
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Party"
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="ALL">All Political Parties</option>
            {parties.map((p) => (
              <option key={p.id || p.partyId} value={p.id || p.partyId}>
                {p.name || p.partyName} ({p.abbreviation})
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Result Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Results Declared (Published)</option>
            <option value="COUNTING">Counting in Progress</option>
            <option value="PENDING">Pending / Unpublished</option>
          </select>
        </div>

        {/* Constituency Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {scopedResults.map((res) => {
            const seat = constituencies.find(
              (c) => (c.id || c.constituencyId) === res.constituencyId
            );
            const summary = countingService.prepareResultSummary(
              res,
              parties,
              candidates
            );
            const isPub = countingService.isResultPubliclyVisible(res);
            const isCnt =
              res.status === RESULT_STATUSES.COUNTING_IN_PROGRESS ||
              res.status === RESULT_STATUSES.COUNTING_PAUSED;

            return (
              <div
                key={res.id}
                className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      State: {res.stateId} · {res.constituencyId}
                    </span>
                    <span
                      className={`font-semibold ${
                        isPub
                          ? 'text-emerald-700'
                          : isCnt
                          ? 'text-amber-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {RESULT_STATUS_LABELS[res.status] || res.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {seat?.name || res.constituencyId} Parliamentary Constituency
                  </h3>

                  {isPub && summary?.winnerCandidate ? (
                    <div className="pt-1 text-xs space-y-0.5">
                      <p className="text-emerald-800 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Winner: {summary.winnerCandidate.name} (
                        {summary.winnerCandidate.partyAbbreviation})
                      </p>
                      <p className="text-slate-600 font-mono tabular-nums">
                        Votes:{' '}
                        {summary.winnerCandidate.totalVotes.toLocaleString(
                          'en-IN'
                        )}{' '}
                        ({summary.winnerCandidate.votePercentage}%) · Victory
                        Margin: +
                        {(summary.victoryMargin || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  ) : isCnt && summary?.leadingCandidate ? (
                    <div className="pt-1 text-xs space-y-0.5">
                      <p className="text-amber-800 font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        Leading: {summary.leadingCandidate.name} (
                        {summary.leadingCandidate.partyAbbreviation}) — Round{' '}
                        {summary.currentRound}/{summary.totalConfiguredRounds}
                      </p>
                      <p className="text-slate-600 font-mono tabular-nums">
                        Interim Lead: +
                        {(summary.leadingMargin || 0).toLocaleString('en-IN')}{' '}
                        votes · Counted:{' '}
                        {(summary.totalCountedVotes || 0).toLocaleString(
                          'en-IN'
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="pt-1 text-xs text-slate-500">
                      Result unpublished — candidate vote totals hidden until official declaration.
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono tabular-nums">
                    {isPub || isCnt
                      ? `Total Counted: ${(
                          res.totalCountedVotes || 0
                        ).toLocaleString('en-IN')}`
                      : 'Awaiting Publication'}
                  </span>
                  <Link
                    to={`/results/${res.electionId}/${res.constituencyId}`}
                    className="inline-flex items-center gap-1 font-bold text-[#002868] hover:underline"
                  >
                    Constituency Details
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
