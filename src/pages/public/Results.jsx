import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import { apiClient } from '../../services/apiClient';
import { frontendEnv } from '../../config/env';
import {
  ELECTION_TYPES,
  RESULT_STATUSES,
  RESULT_STATUS_LABELS,
} from '../../utils/constants';
import { countingService } from '../../services/countingService';
import {
  SimulatedResultDisclaimer,
  PartySeatsBarChart,
} from '../../components/results/ResultCharts';
import VisualAnalyticsInsights from '../../components/results/VisualAnalyticsInsights';
import { notaImg, notaLogo } from '../../assets';
import {
  Search,
  ExternalLink,
  Layers,
  Globe,
  Building2,
  CheckCircle2,
  Clock,
  Lock,
  Download,
} from 'lucide-react';

const SIMULTANEOUS_PRESETS = [
  {
    id: 'WB-KRISHNANAGAR',
    label: 'West Bengal — Krishnanagar PC & Krishnanagar Uttar AC',
    stateId: 'WB',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    lokSabhaElectionId: 'LS-2029',
    assemblyElectionId: 'WB-ASSEMBLY-2029',
  },
  {
    id: 'DL-NEW-DELHI',
    label: 'NCT of Delhi — New Delhi PC & New Delhi AC',
    stateId: 'DL',
    parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
    assemblyConstituencyId: 'DL-AC-NEW-DELHI',
    lokSabhaElectionId: 'LS-2029',
    assemblyElectionId: 'DL-ASSEMBLY-2029',
  },
  {
    id: 'MH-MUMBAI',
    label: 'Maharashtra — Mumbai North PC (Counting) & Bandra West AC (Draft)',
    stateId: 'MH',
    parliamentaryConstituencyId: 'MH-PC-MUMBAI-NORTH',
    assemblyConstituencyId: 'MH-AC-BANDRA-WEST',
    lokSabhaElectionId: 'LS-2029',
    assemblyElectionId: 'MH-ASSEMBLY-2029',
  },
];

export default function Results() {
  const {
    results = [],
    elections = [],
    states = [],
    constituencies = [],
    candidates = [],
    parties = [],
    participationRecords = [],
    voters = [],
  } = useElection();

  // Search & Filter states (Phase 6 Section 11)
  const [electionTypeFilter, setElectionTypeFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('WB-KRISHNANAGAR');
  const [backendResults, setBackendResults] = useState(null);

  useEffect(() => {
    if (!frontendEnv.isBackendApi) return;
    apiClient.results
      .list({ page: 1, limit: 100 })
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setBackendResults(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const effectiveResults = useMemo(() => {
    if (frontendEnv.isBackendApi && backendResults && backendResults.length > 0) {
      return backendResults;
    }
    return results;
  }, [backendResults, results]);

  const selectedPreset = useMemo(
    () =>
      SIMULTANEOUS_PRESETS.find((p) => p.id === selectedPresetId) ||
      SIMULTANEOUS_PRESETS[0],
    [selectedPresetId]
  );

  // Simultaneous Election Side-by-Side Overview
  const simultaneousOverview = useMemo(
    () =>
      countingService.computeSimultaneousElectionOverview({
        ...selectedPreset,
        results: effectiveResults,
        elections,
        constituencies,
        candidates,
        parties,
      }),
    [selectedPreset, effectiveResults, elections, constituencies, candidates, parties]
  );

  // National Lok Sabha 2029 Summary
  const ls2029Analytics = useMemo(
    () =>
      countingService.computeLokSabhaNationalAnalytics({
        electionId: 'LS-2029',
        results: effectiveResults,
        elections,
        constituencies,
        candidates,
        parties,
        states,
        publicOnly: true,
      }),
    [effectiveResults, elections, constituencies, candidates, parties, states]
  );

  // Turnout & Vote Accounting separation metrics (Section 13)
  const turnoutMetrics = useMemo(() => {
    const votedCount = participationRecords.filter(
      (r) => r.status === 'VOTED' && r.electionId === 'LS-2029'
    ).length;
    return countingService.calculateTurnoutMetrics({
      simulatedParticipationCount: votedCount,
      totalEligibleDemoVoters: voters.length,
      totalCountedVotes: ls2029Analytics.totalSimulatedVotesCounted,
      validCandidateVotes:
        ls2029Analytics.totalSimulatedVotesCounted -
        ls2029Analytics.totalNotaVotes,
      notaVotes: ls2029Analytics.totalNotaVotes,
    });
  }, [participationRecords, voters, ls2029Analytics]);

  // Filtered Constituency Result Cards
  const filteredResults = useMemo(() => {
    return results.filter((res) => {
      if (
        electionTypeFilter !== 'ALL' &&
        res.electionType !== electionTypeFilter
      ) {
        return false;
      }
      if (
        yearFilter !== 'ALL' &&
        String(res.electionYear) !== String(yearFilter)
      ) {
        return false;
      }
      if (stateFilter !== 'ALL' && res.stateId !== stateFilter) {
        return false;
      }
      if (partyFilter !== 'ALL') {
        const isPub = countingService.isResultPubliclyVisible(res);
        const isCnt =
          res.status === RESULT_STATUSES.COUNTING_IN_PROGRESS ||
          res.status === RESULT_STATUSES.COUNTING_PAUSED;
        if (!isPub && !isCnt) return false;
        const hasPartyCand = (res.candidates || []).some(
          (c) => c.partyId === partyFilter
        );
        if (!hasPartyCand) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const seat = constituencies.find(
          (c) => (c.id || c.constituencyId) === res.constituencyId
        );
        const seatName = (seat?.name || res.constituencyId).toLowerCase();
        const candNames = (res.candidates || [])
          .map((c) => (c.snapshotName || '').toLowerCase())
          .join(' ');
        const partyNames = (res.candidates || [])
          .map((c) => (c.snapshotPartyAbbr || '').toLowerCase())
          .join(' ');
        if (
          !seatName.includes(q) &&
          !candNames.includes(q) &&
          !partyNames.includes(q) &&
          !res.constituencyId.toLowerCase().includes(q) &&
          !res.electionId.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    results,
    electionTypeFilter,
    yearFilter,
    stateFilter,
    partyFilter,
    searchQuery,
    constituencies,
  ]);

  const renderSimultaneousSideCard = (side, badgeLabel) => {
    const res = side.resultRecord;
    const isPub = countingService.isResultPubliclyVisible(res);
    const isCnt =
      res?.status === RESULT_STATUSES.COUNTING_IN_PROGRESS ||
      res?.status === RESULT_STATUSES.COUNTING_PAUSED;
    const summary = side.summary;

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#002868]">{badgeLabel}</span>
            <span
              className={`font-semibold ${
                isPub
                  ? 'text-emerald-700'
                  : isCnt
                  ? 'text-amber-700'
                  : 'text-slate-500'
              }`}
            >
              {RESULT_STATUS_LABELS[side.status] || side.status}
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              {side.constituencyName} ({side.constituencyId})
            </h3>
            <p className="text-xs text-slate-500">
              {side.electionName} · ID: {side.electionId}
            </p>
          </div>

          {isPub && summary?.winnerCandidate ? (
            <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Declared Winner (Demo):</span>
                <span className="font-bold text-emerald-800">
                  {summary.winnerCandidate.name} (
                  {summary.winnerCandidate.partyAbbreviation})
                </span>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-slate-500">Final Votes &amp; Share:</span>
                <span className="font-bold text-slate-900">
                  {summary.winnerCandidate.totalVotes.toLocaleString('en-IN')} (
                  {summary.winnerCandidate.votePercentage}%)
                </span>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-slate-500">Victory Margin:</span>
                <span className="font-bold text-emerald-700">
                  +{(summary.victoryMargin || 0).toLocaleString('en-IN')} votes
                </span>
              </div>
            </div>
          ) : isCnt && summary?.leadingCandidate ? (
            <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">
                  Leading Candidate (Round {summary.currentRound}/
                  {summary.totalConfiguredRounds}):
                </span>
                <span className="font-bold text-amber-800">
                  {summary.leadingCandidate.name} (
                  {summary.leadingCandidate.partyAbbreviation})
                </span>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-slate-500">Counted Votes So Far:</span>
                <span className="font-bold text-slate-900">
                  {summary.totalCountedVotes.toLocaleString('en-IN')} /{' '}
                  {summary.totalConfiguredVotes.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-slate-500">Current Lead Margin:</span>
                <span className="font-bold text-amber-700">
                  +{(summary.leadingMargin || 0).toLocaleString('en-IN')} votes
                  (LEADING)
                </span>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                Draft / Unpublished — Vote totals are hidden until official result declaration.
              </span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">
            Independent Dataset: {side.electionId}
          </span>
          <Link
            to={`/results/${side.electionId}/${side.constituencyId}`}
            className="inline-flex items-center gap-1 font-bold text-[#002868] hover:underline"
          >
            Inspect Constituency Result
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner & Specialized Dashboard Links */}
      <div className="bg-[#002868] text-white rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-amber-300">
              Election Commission of India · Counting &amp; Results Portal
            </p>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Election Results &amp; Analytics
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              Official declared results, constituency-wise candidate tallies, and party seat distributions for Parliamentary and State Assembly elections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/results/lok-sabha"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#f4c542] text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
            >
              <Globe className="w-4 h-4" />
              Lok Sabha National Dashboard
            </Link>
            <Link
              to="/results/assembly"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-[#002868] hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <Building2 className="w-4 h-4" />
              State Assembly Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Mandatory Simulated Data Disclaimer */}
      <SimulatedResultDisclaimer />

      {/* Simultaneous Election Side-by-Side Overview (Phase 6 Section 10) */}
      <section className="bg-slate-100/80 rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[#002868]">
              <Layers className="w-4 h-4" />
              <span>Simultaneous Lok Sabha &amp; State Assembly Results Overview</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Side-by-Side Independent Constituency Result Comparison
            </h2>
            <p className="text-xs text-slate-600">
              Parliamentary (PC) and Assembly (AC) results are counted and published independently — candidate totals and winning candidates are never combined.
            </p>
          </div>

          <div className="w-full md:w-96">
            <label
              htmlFor="simultaneous-preset-select"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Select Simultaneous Jurisdiction Pair
            </label>
            <select
              id="simultaneous-preset-select"
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900"
            >
              {SIMULTANEOUS_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderSimultaneousSideCard(
            simultaneousOverview.lokSabha,
            '1. LOK SABHA (PARLIAMENTARY CONSTITUENCY)'
          )}
          {renderSimultaneousSideCard(
            simultaneousOverview.stateAssembly,
            '2. STATE LEGISLATIVE ASSEMBLY (ASSEMBLY CONSTITUENCY)'
          )}
        </div>
      </section>

      {/* Interactive Visual Insights: Majority Tracker, Demographics, 36 States Matrix, Vote Conversion */}
      <VisualAnalyticsInsights
        partyRows={ls2029Analytics.partyRows}
        results={results}
        candidates={candidates}
        states={states}
        totalCountedVotes={turnoutMetrics.totalCountedVotes}
      />

      {/* National Lok Sabha & Turnout Basis Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PartySeatsBarChart
            partyRows={ls2029Analytics.partyRows}
            title="Lok Sabha 2029 — Party-Wise Seats & Vote Share (Published Demo Results)"
            subtitle="Click 'Lok Sabha National Dashboard' above for full state-wise and constituency-wise breakdown"
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900">
              Vote Share &amp; Turnout Calculation Basis
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Simulated result tallies and voter participation records are maintained in strictly separate datasets:
            </p>

            <div className="space-y-2 pt-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 font-mono tabular-nums">
                <span className="font-sans text-slate-600">
                  Published LS-2029 Votes Counted:
                </span>
                <span className="font-bold text-slate-900">
                  {turnoutMetrics.totalCountedVotes.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 font-mono tabular-nums">
                <span className="font-sans text-slate-600">
                  Valid Candidate Votes:
                </span>
                <span className="font-bold text-slate-900">
                  {turnoutMetrics.validCandidateVotes.toLocaleString('en-IN')} (
                  {turnoutMetrics.validBallotSharePercentage}%)
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 font-mono tabular-nums">
                <span className="font-sans text-slate-600">NOTA Votes:</span>
                <span className="font-bold text-slate-700">
                  {turnoutMetrics.notaVotes.toLocaleString('en-IN')} (
                  {turnoutMetrics.notaBallotSharePercentage}%)
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 font-mono tabular-nums">
                <span className="font-sans text-slate-600">
                  Demo Voter Registry Turnout:
                </span>
                <span className="font-bold text-[#002868]">
                  {turnoutMetrics.simulatedParticipationCount} /{' '}
                  {turnoutMetrics.totalEligibleDemoVoters} (
                  {turnoutMetrics.demoTurnoutPercentage}%)
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">
              Privacy &amp; Data Separation Guarantee
            </p>
            <p>
              Individual voter participation records never store candidate selection and are never converted into candidate vote totals.
            </p>
          </div>
        </div>
      </div>

      {/* Multi-Criteria Search & Constituency Result Directory (Phase 6 Section 11) */}
      <section className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Search &amp; Inspect Constituency Results
              </h2>
              <p className="text-xs text-slate-500">
                Filter across Election Type, Election Year, State/UT, Political Party, Constituency, or Candidate Name
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {filteredResults.length} matching result record(s)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Constituency, candidate, party..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#002868]"
              />
            </div>

            <select
              aria-label="Filter by Election Type"
              value={electionTypeFilter}
              onChange={(e) => setElectionTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value="ALL">All Election Types</option>
              <option value={ELECTION_TYPES.LOK_SABHA}>
                Lok Sabha (LOK_SABHA)
              </option>
              <option value={ELECTION_TYPES.STATE_ASSEMBLY}>
                State Assembly (STATE_ASSEMBLY)
              </option>
            </select>

            <select
              aria-label="Filter by Election Year"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="ALL">All Election Years</option>
              <option value="2029">2029 Elections</option>
              <option value="2024">2024 Historical Archive</option>
            </select>

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
              aria-label="Filter by Political Party"
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
          </div>
        </div>

        {/* Result Cards */}
        {filteredResults.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
            <h3 className="text-base font-bold text-slate-900">
              No Matching Result Records Found
            </h3>
            <p className="text-xs text-slate-500">
              Adjust your search query or filters above to inspect available Lok Sabha and State Assembly result datasets.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResults.map((res) => {
              const seat = constituencies.find(
                (c) => (c.id || c.constituencyId) === res.constituencyId
              );
              const election = elections.find(
                (e) => (e.id || e.electionId) === res.electionId
              );
              const stateObj = states.find(
                (s) => (s.id || s.stateId) === res.stateId
              );
              const isPub = countingService.isResultPubliclyVisible(res);
              const isCnt =
                res.status === RESULT_STATUSES.COUNTING_IN_PROGRESS ||
                res.status === RESULT_STATUSES.COUNTING_PAUSED;

              const standings = countingService.calculateConstituencyStandings({
                candidates: res.candidates || [],
                notaVotes: res.notaVotes || 0,
                isCompleted: isPub,
              });

              return (
                <div
                  key={res.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="font-bold text-[#002868]">
                          {res.electionType === ELECTION_TYPES.LOK_SABHA
                            ? 'LOK SABHA (PARLIAMENTARY)'
                            : `STATE ASSEMBLY (${res.stateId})`}
                        </span>
                        <span>·</span>
                        <span>
                          {stateObj?.name || stateObj?.stateName || res.stateId}
                        </span>
                        <span>·</span>
                        <span className="font-mono">{res.electionId}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {seat?.name || res.constituencyId} Constituency (
                        {res.constituencyId})
                      </h3>
                      <p className="text-xs text-slate-500">
                        {election?.name || election?.title || res.electionId}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right text-xs">
                        <span className="text-slate-500 block">
                          Result Status
                        </span>
                        <span
                          className={`font-bold ${
                            isPub
                              ? 'text-emerald-700'
                              : isCnt
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {RESULT_STATUS_LABELS[res.status] || res.status}
                        </span>
                      </div>

                      {isPub && (
                        <button
                          type="button"
                          onClick={() => {
                            const csv =
                              countingService.exportConstituencyResultCSV(res, {
                                parties,
                                candidates,
                              });
                            countingService.triggerCsvDownload(
                              `result-${res.electionId}-${res.constituencyId}.csv`,
                              csv
                            );
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          CSV
                        </button>
                      )}

                      <Link
                        to={`/results/${res.electionId}/${res.constituencyId}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#002868] text-white hover:bg-blue-900 text-xs font-bold whitespace-nowrap"
                      >
                        Full Constituency Breakdown
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Card Body: Strict hiding of draft/unpublished vote totals */}
                  {!isPub && !isCnt ? (
                    <div className="px-6 py-5 bg-amber-50/40 text-xs text-slate-600 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>Unpublished / Draft Result:</strong> Candidate vote totals for {seat?.name || res.constituencyId} are hidden from public view until counting is completed and formally published by the Returning Officer.
                        </span>
                      </div>
                      <span className="font-mono text-slate-500 shrink-0">
                        Status: {res.status}
                      </span>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {standings.candidates.map((cand) => {
                        const master = candidates.find(
                          (mc) => (mc.id || mc.candidateId) === cand.candidateId
                        );
                        const party = parties.find(
                          (p) => (p.id || p.partyId) === cand.partyId
                        );
                        const isWinner =
                          isPub &&
                          !standings.isTied &&
                          standings.winnerCandidateId === cand.candidateId;
                        const isLeading =
                          !isPub &&
                          !standings.isTied &&
                          standings.leadingCandidateId === cand.candidateId;

                        return (
                          <div
                            key={cand.candidateId}
                            className={`px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isWinner ? 'bg-emerald-50/30' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <span className="w-6 text-xs font-bold text-slate-400 font-mono tabular-nums">
                                #{cand.rank}
                              </span>
                              <img
                                src={
                                  master?.photograph ||
                                  master?.photoUrl ||
                                  notaImg
                                }
                                alt={cand.snapshotName}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-white"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">
                                    {cand.snapshotName ||
                                      master?.name ||
                                      cand.candidateId}
                                  </span>
                                  {isWinner && (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      WINNER (Margin: +
                                      {(
                                        standings.victoryMargin || 0
                                      ).toLocaleString('en-IN')}
                                      )
                                    </span>
                                  )}
                                  {isLeading && (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                                      <Clock className="w-3.5 h-3.5" />
                                      LEADING (+
                                      {(
                                        standings.leadingMargin || 0
                                      ).toLocaleString('en-IN')}{' '}
                                      in Round {res.currentRound}/
                                      {res.totalConfiguredRounds})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                                  {(party?.symbol || party?.symbolUrl) && (
                                    <img
                                      src={party.symbol || party.symbolUrl}
                                      alt={cand.snapshotPartyAbbr}
                                      referrerPolicy="no-referrer"
                                      className="w-4 h-4 object-contain"
                                    />
                                  )}
                                  <span>
                                    {party?.name ||
                                      party?.partyName ||
                                      'Independent'}{' '}
                                    ({cand.snapshotPartyAbbr || 'IND'})
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="sm:w-64 space-y-1 font-mono tabular-nums">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-900">
                                  {cand.totalVotes.toLocaleString('en-IN')}{' '}
                                  votes
                                </span>
                                <span className="text-slate-600">
                                  {cand.votePercentage}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-md overflow-hidden">
                                <div
                                  className={`h-full ${
                                    isWinner
                                      ? 'bg-emerald-600'
                                      : isLeading
                                      ? 'bg-amber-500'
                                      : 'bg-[#002868]'
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Number(cand.votePercentage || 0)
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* NOTA Row */}
                      <div className="px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
                        <div className="flex items-center gap-3.5">
                          <span className="w-6 text-xs font-bold text-slate-400 font-mono">
                            —
                          </span>
                          <img
                            src={notaLogo}
                            alt="NOTA"
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 object-contain rounded border border-slate-200 bg-white p-1"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-700">
                              None of the Above (NOTA)
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              Included in total vote accounting · Not eligible for seat award
                            </span>
                          </div>
                        </div>

                        <div className="sm:w-64 flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="font-bold text-slate-700">
                            {standings.notaVotes.toLocaleString('en-IN')} votes
                          </span>
                          <span className="text-slate-500">
                            {standings.notaPercentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
