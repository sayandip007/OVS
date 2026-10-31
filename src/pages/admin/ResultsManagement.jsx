import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  RESULT_STATUSES,
  RESULT_STATUS_LABELS,
} from '../../utils/constants';
import { countingService } from '../../services/countingService';
import { canAdminPerformAction } from '../../services/adminPermissionService';
import {
  SimulatedResultDisclaimer,
  CumulativeRoundLineChart,
  PartySeatsBarChart,
} from '../../components/results/ResultCharts';
import Modal from '../../components/common/Modal';
import {
  BarChart3,
  Play,
  FastForward,
  Pause,
  RotateCcw,
  CheckCircle2,
  Eye,
  EyeOff,
  FileEdit,
  Download,
  PlusCircle,
  AlertTriangle,
  History,
} from 'lucide-react';

const ADMIN_RESULT_TABS = [
  { id: 'ALL', label: 'All Results' },
  { id: 'LOK_SABHA', label: 'Lok Sabha' },
  { id: 'STATE_ASSEMBLY', label: 'State Assembly' },
  { id: 'COUNTING_SESSIONS', label: 'Counting Sessions' },
  { id: 'DRAFT_RESULTS', label: 'Draft Results' },
  { id: 'PUBLISHED_RESULTS', label: 'Published Results' },
];

export default function ResultsManagement() {
  const {
    results = [],
    elections = [],
    states = [],
    constituencies = [],
    candidates = [],
    parties = [],
    auditLogs = [],
    createCountingSessionForConstituency,
    startConstituencyCounting,
    processConstituencyCountingRound,
    pauseConstituencyCounting,
    resumeConstituencyCounting,
    completeConstituencyCounting,
    resetConstituencyCounting,
    transitionConstituencyResultStatus,
    correctConstituencyResult,
  } = useElection();

  const { currentAdmin } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  // Tabs & Selection state
  const [activeTab, setActiveTab] = useState('ALL');
  const [electionTypeFilter, setElectionTypeFilter] = useState('ALL');
  const [selectedElectionId, setSelectedElectionId] = useState('LS-2029');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [selectedConstituencyId, setSelectedConstituencyId] = useState(
    'WB-PC-KRISHNANAGAR'
  );
  const [selectedResultId, setSelectedResultId] = useState(
    'RESULT-LS-2029-KRISHNANAGAR'
  );

  // Modals state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionEdits, setCorrectionEdits] = useState({});
  const [correctionNota, setCorrectionNota] = useState(0);
  const [correctionReason, setCorrectionReason] = useState('');
  const [newSessionVotes, setNewSessionVotes] = useState(15000);
  const [newSessionRounds, setNewSessionRounds] = useState(3);

  // Filter elections by selected election type
  const filteredElections = useMemo(() => {
    return elections.filter((e) => {
      const eType = e.type || e.electionType;
      if (activeTab === 'LOK_SABHA') return eType === ELECTION_TYPES.LOK_SABHA;
      if (activeTab === 'STATE_ASSEMBLY')
        return eType === ELECTION_TYPES.STATE_ASSEMBLY;
      if (electionTypeFilter !== 'ALL') return eType === electionTypeFilter;
      return true;
    });
  }, [elections, activeTab, electionTypeFilter]);

  const activeElection = useMemo(
    () =>
      filteredElections.find(
        (e) => (e.id || e.electionId) === selectedElectionId
      ) ||
      filteredElections[0] ||
      elections[0],
    [filteredElections, selectedElectionId, elections]
  );

  // Eligible constituencies for the active election & state
  const eligibleConstituencies = useMemo(() => {
    if (!activeElection) return [];
    const eType = activeElection.type || activeElection.electionType;
    const isLS = eType === ELECTION_TYPES.LOK_SABHA;

    return constituencies.filter((c) => {
      const cType = c.type || c.constituencyType;
      if (isLS && cType !== CONSTITUENCY_TYPES.PARLIAMENTARY) return false;
      if (!isLS && cType !== CONSTITUENCY_TYPES.ASSEMBLY) return false;
      if (!isLS && activeElection.stateId && c.stateId !== activeElection.stateId)
        return false;
      if (stateFilter !== 'ALL' && c.stateId !== stateFilter) return false;
      return true;
    });
  }, [activeElection, constituencies, stateFilter]);

  // Filtered result records based on active tab and filters
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (activeTab === 'LOK_SABHA' && r.electionType !== ELECTION_TYPES.LOK_SABHA)
        return false;
      if (
        activeTab === 'STATE_ASSEMBLY' &&
        r.electionType !== ELECTION_TYPES.STATE_ASSEMBLY
      )
        return false;
      if (
        activeTab === 'COUNTING_SESSIONS' &&
        ![
          RESULT_STATUSES.COUNTING_IN_PROGRESS,
          RESULT_STATUSES.COUNTING_PAUSED,
          RESULT_STATUSES.COUNTING_COMPLETED,
          RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
          RESULT_STATUSES.TIED,
        ].includes(r.status)
      )
        return false;
      if (
        activeTab === 'DRAFT_RESULTS' &&
        ![
          RESULT_STATUSES.DRAFT,
          RESULT_STATUSES.UNPUBLISHED,
          RESULT_STATUSES.UNDER_REVIEW,
        ].includes(r.status)
      )
        return false;
      if (
        activeTab === 'PUBLISHED_RESULTS' &&
        !countingService.isResultPubliclyVisible(r)
      )
        return false;

      if (
        electionTypeFilter !== 'ALL' &&
        r.electionType !== electionTypeFilter
      )
        return false;
      if (stateFilter !== 'ALL' && r.stateId !== stateFilter) return false;
      return true;
    });
  }, [results, activeTab, electionTypeFilter, stateFilter]);

  // Currently focused result record for the Counting Management Console
  const activeResult = useMemo(() => {
    const byId = results.find((r) => r.id === selectedResultId);
    if (byId) return byId;
    const byPair = results.find(
      (r) =>
        r.electionId === (activeElection?.id || activeElection?.electionId) &&
        r.constituencyId === selectedConstituencyId
    );
    return byPair || filteredResults[0] || results[0] || null;
  }, [
    results,
    selectedResultId,
    activeElection,
    selectedConstituencyId,
    filteredResults,
  ]);

  const activeSummary = useMemo(
    () =>
      activeResult
        ? countingService.prepareResultSummary(activeResult, parties, candidates)
        : null,
    [activeResult, parties, candidates]
  );

  const activeStandings = useMemo(() => {
    if (!activeResult) return null;
    const isCompleted = [
      RESULT_STATUSES.COUNTING_COMPLETED,
      RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
      RESULT_STATUSES.PUBLISHED,
      RESULT_STATUSES.CORRECTED,
      RESULT_STATUSES.TIED,
    ].includes(activeResult.status);
    return countingService.calculateConstituencyStandings({
      candidates: activeResult.candidates || [],
      notaVotes: activeResult.notaVotes || 0,
      isCompleted,
    });
  }, [activeResult]);

  const partyAnalyticsForActiveElection = useMemo(
    () =>
      countingService.computePartyWiseAnalytics({
        electionId: activeResult?.electionId || activeElection?.id || 'LS-2029',
        results,
        parties,
        candidates,
        publicOnly: false,
      }),
    [activeResult, activeElection, results, parties, candidates]
  );

  const resultAuditLogs = useMemo(() => {
    return auditLogs
      .filter(
        (l) =>
          l.entityType === 'RESULT' ||
          String(l.action || '').includes('COUNTING') ||
          String(l.action || '').includes('RESULT')
      )
      .slice(0, 12);
  }, [auditLogs]);

  // Permission helper
  const checkWritePermission = (targetRes = activeResult) => {
    const check = canAdminPerformAction(currentAdmin, 'MANAGE_RESULT', {
      electionId: targetRes?.electionId || activeElection?.id,
      electionType: targetRes?.electionType || activeElection?.type,
      stateId: targetRes?.stateId || activeElection?.stateId,
    });
    if (!check.allowed) {
      notifyError(check.error || 'Permission denied for this role.');
      return false;
    }
    return true;
  };

  // Action Handlers
  const handleCreateSession = () => {
    const elId = activeElection?.id || activeElection?.electionId;
    if (!elId || !selectedConstituencyId) {
      notifyError('Please select both an election and an eligible constituency.');
      return;
    }
    if (
      !checkWritePermission({
        electionId: elId,
        electionType: activeElection?.type || activeElection?.electionType,
        stateId: activeElection?.stateId,
      })
    ) {
      return;
    }

    const res = createCountingSessionForConstituency(
      {
        electionId: elId,
        constituencyId: selectedConstituencyId,
        totalConfiguredVotes: Number(newSessionVotes) || 15000,
        totalConfiguredRounds: Number(newSessionRounds) || 3,
      },
      currentAdmin
    );
    if (!res.ok) {
      notifyError(res.error);
      if (res.result) {
        setSelectedResultId(res.result.id);
      }
      return;
    }
    setSelectedResultId(res.result.id);
    notifySuccess(
      `Initialized simulated counting session for ${selectedConstituencyId} (${elId}).`
    );
  };

  const handleStartCounting = () => {
    if (!activeResult || !checkWritePermission()) return;
    const res = startConstituencyCounting(activeResult.id, currentAdmin);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Counting simulation started for ${activeResult.constituencyId} (${activeResult.electionId}).`
    );
  };

  const handleNextRound = () => {
    if (!activeResult || !checkWritePermission()) return;
    const res = processConstituencyCountingRound(
      activeResult.id,
      null,
      currentAdmin
    );
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Processed Round ${res.round.roundNumber} for ${activeResult.constituencyId}: +${res.round.newlyCountedVotes.toLocaleString(
        'en-IN'
      )} simulated votes counted.`
    );
  };

  const handlePauseCounting = () => {
    if (!activeResult || !checkWritePermission()) return;
    const res = pauseConstituencyCounting(activeResult.id, currentAdmin);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(`Counting paused at Round ${activeResult.currentRound}.`);
  };

  const handleResumeCounting = () => {
    if (!activeResult || !checkWritePermission()) return;
    const res = resumeConstituencyCounting(activeResult.id, currentAdmin);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(`Counting resumed for ${activeResult.constituencyId}.`);
  };

  const handleCompleteCounting = () => {
    if (!activeResult || !checkWritePermission()) return;
    const res = completeConstituencyCounting(
      activeResult.id,
      { autoProcessRemainingRounds: true, readyForReview: true },
      currentAdmin
    );
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      res.result.isTied
        ? `Counting completed for ${activeResult.constituencyId} — Result is TIED and flagged for administrative resolution.`
        : `Counting completed for ${activeResult.constituencyId}. Status: Ready for Review.`
    );
  };

  const handleConfirmResetSession = () => {
    if (!activeResult || !checkWritePermission()) return;
    const res = resetConstituencyCounting(
      activeResult.id,
      { confirmed: true },
      currentAdmin
    );
    setResetModalOpen(false);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Reset demo counting session for ${activeResult.constituencyId} back to DRAFT (0 votes).`
    );
  };

  const handleConfirmPublish = () => {
    if (!activeResult || !checkWritePermission()) return;
    const res = transitionConstituencyResultStatus(
      activeResult.id,
      RESULT_STATUSES.PUBLISHED,
      { notes: 'Verified and published via ECI Admin Counting Console.' },
      currentAdmin
    );
    setPublishModalOpen(false);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Published simulated result for ${activeResult.constituencyId} (${activeResult.electionId}) to the public portal.`
    );
  };

  const handleUnpublish = () => {
    if (!activeResult || !checkWritePermission()) return;
    const res = transitionConstituencyResultStatus(
      activeResult.id,
      RESULT_STATUSES.UNPUBLISHED,
      { notes: 'Unpublished from public portal by administrator.' },
      currentAdmin
    );
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Unpublished result for ${activeResult.constituencyId}. Public display is now hidden.`
    );
  };

  const openCorrectionModal = () => {
    if (!activeResult) return;
    const initialMap = {};
    for (const c of activeResult.candidates || []) {
      initialMap[c.candidateId] = c.totalVotes;
    }
    setCorrectionEdits(initialMap);
    setCorrectionNota(activeResult.notaVotes || 0);
    setCorrectionReason('');
    setCorrectionModalOpen(true);
  };

  const handleApplyCorrection = () => {
    if (!activeResult || !checkWritePermission()) return;
    const res = correctConstituencyResult(
      activeResult.id,
      {
        candidateVotesMap: correctionEdits,
        notaVotes: Number(correctionNota),
        reason: correctionReason,
        confirmed: true,
      },
      currentAdmin
    );
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    setCorrectionModalOpen(false);
    notifySuccess(
      `Applied documented administrative correction to ${activeResult.constituencyId}. Audit log recorded.`
    );
  };

  const activeSeat = constituencies.find(
    (c) => (c.id || c.constituencyId) === activeResult?.constituencyId
  );

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-[#002868]" />
            <div>
              <p className="text-xs font-bold text-[#002868]">
                ECI Admin Console · Phase 6 Counting &amp; Result Declaration
              </p>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                Election Counting &amp; Results Management
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Run deterministic round-by-round counting simulations, validate constituency standings, review result summaries, and publish/correct demonstration results.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeResult && (
              <button
                type="button"
                onClick={() => {
                  const csv = countingService.exportConstituencyResultCSV(
                    activeResult,
                    { parties, candidates }
                  );
                  countingService.triggerCsvDownload(
                    `admin-result-${activeResult.electionId}-${activeResult.constituencyId}.csv`,
                    csv
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export Active Result CSV
              </button>
            )}
            <Link
              to="/results"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              View Public Results Portal
            </Link>
          </div>
        </div>

        <SimulatedResultDisclaimer compact />

        {/* 6 Required Admin Tabs (Phase 6 Section 5) */}
        <div
          role="tablist"
          aria-label="Results Management Tabs"
          className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl"
        >
          {ADMIN_RESULT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#002868] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 4-Step Election & Constituency Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              1. Election Type
            </label>
            <select
              value={electionTypeFilter}
              onChange={(e) => setElectionTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Types (Lok Sabha &amp; Assembly)</option>
              <option value={ELECTION_TYPES.LOK_SABHA}>
                Lok Sabha (LOK_SABHA)
              </option>
              <option value={ELECTION_TYPES.STATE_ASSEMBLY}>
                State Assembly (STATE_ASSEMBLY)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              2. Election
            </label>
            <select
              value={activeElection?.id || activeElection?.electionId || ''}
              onChange={(e) => setSelectedElectionId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-white"
            >
              {filteredElections.map((el) => (
                <option
                  key={el.id || el.electionId}
                  value={el.id || el.electionId}
                >
                  {el.name || el.title} ({el.id || el.electionId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              3. State / UT Filter
            </label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Applicable States &amp; UTs</option>
              {states.map((st) => (
                <option key={st.id || st.stateId} value={st.id || st.stateId}>
                  {st.name || st.stateName} ({st.id || st.stateId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              4. Eligible Constituency ({eligibleConstituencies.length})
            </label>
            <select
              value={selectedConstituencyId}
              onChange={(e) => {
                const nextCid = e.target.value;
                setSelectedConstituencyId(nextCid);
                const match = results.find(
                  (r) =>
                    r.electionId ===
                      (activeElection?.id || activeElection?.electionId) &&
                    r.constituencyId === nextCid
                );
                if (match) {
                  setSelectedResultId(match.id);
                }
              }}
              className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
            >
              {eligibleConstituencies.map((c) => (
                <option
                  key={c.id || c.constituencyId}
                  value={c.id || c.constituencyId}
                >
                  {c.name} ({c.id || c.constituencyId}) — {c.stateId}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Initialize New Counting Session Bar */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-800">
              Initialize / Switch Counting Session:
            </span>
            <select
              aria-label="Select Configured Counting Session"
              value={activeResult?.id || ''}
              onChange={(e) => setSelectedResultId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
            >
              {filteredResults.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.electionId} · {r.constituencyId} [{r.status}]
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-slate-600 font-medium">
              Configured Votes:
              <input
                type="number"
                min={500}
                step={500}
                value={newSessionVotes}
                onChange={(e) => setNewSessionVotes(e.target.value)}
                className="ml-1.5 w-24 px-2 py-1 rounded border border-slate-300 bg-white font-mono font-bold"
              />
            </label>
            <label className="text-slate-600 font-medium">
              Rounds:
              <input
                type="number"
                min={1}
                max={10}
                value={newSessionRounds}
                onChange={(e) => setNewSessionRounds(e.target.value)}
                className="ml-1.5 w-14 px-2 py-1 rounded border border-slate-300 bg-white font-mono font-bold"
              />
            </label>
            <button
              type="button"
              onClick={handleCreateSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#002868] hover:bg-blue-900 text-white font-bold cursor-pointer whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Create Session for Selected Seat
            </button>
          </div>
        </div>
      </div>

      {/* Active Counting Management Console */}
      {activeResult && activeSummary && activeStandings && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          {/* Session Header & Lifecycle Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-[#002868]">
                  {activeResult.electionType}
                </span>
                <span>·</span>
                <span className="font-mono">{activeResult.electionId}</span>
                <span>·</span>
                <span>State: {activeResult.stateId}</span>
                <span>·</span>
                <span className="font-mono">Session ID: {activeResult.id}</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">
                {activeSeat?.name || activeResult.constituencyId} Constituency (
                {activeResult.constituencyId})
              </h2>
              <p className="text-xs text-slate-600">
                Lifecycle Status:{' '}
                <strong className="text-slate-900">
                  {RESULT_STATUS_LABELS[activeResult.status] ||
                    activeResult.status}
                </strong>
                {activeResult.publishedAt && (
                  <span className="ml-2 font-mono text-emerald-700">
                    · Published:{' '}
                    {new Date(activeResult.publishedAt).toLocaleString('en-IN')}
                  </span>
                )}
              </p>
            </div>

            {/* Interactive Simulation & Publication Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {activeResult.status === RESULT_STATUSES.DRAFT && (
                <button
                  type="button"
                  onClick={handleStartCounting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  Start Counting Simulation
                </button>
              )}

              {(activeResult.status === RESULT_STATUSES.DRAFT ||
                activeResult.status === RESULT_STATUSES.COUNTING_IN_PROGRESS) &&
                (activeResult.currentRound || 0) <
                  (activeResult.totalConfiguredRounds || 3) && (
                  <button
                    type="button"
                    onClick={handleNextRound}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    Process Next Round (Round {(activeResult.currentRound || 0) + 1})
                  </button>
                )}

              {activeResult.status === RESULT_STATUSES.COUNTING_IN_PROGRESS && (
                <button
                  type="button"
                  onClick={handlePauseCounting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pause Counting
                </button>
              )}

              {activeResult.status === RESULT_STATUSES.COUNTING_PAUSED && (
                <button
                  type="button"
                  onClick={handleResumeCounting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  Resume Counting
                </button>
              )}

              {[
                RESULT_STATUSES.DRAFT,
                RESULT_STATUSES.COUNTING_IN_PROGRESS,
                RESULT_STATUSES.COUNTING_PAUSED,
              ].includes(activeResult.status) && (
                <button
                  type="button"
                  onClick={handleCompleteCounting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Complete Counting
                </button>
              )}

              <button
                type="button"
                onClick={() => setPreviewModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview Results
              </button>

              {[
                RESULT_STATUSES.COUNTING_COMPLETED,
                RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
                RESULT_STATUSES.UNPUBLISHED,
                RESULT_STATUSES.UNDER_REVIEW,
              ].includes(activeResult.status) &&
                !activeResult.isTied && (
                  <button
                    type="button"
                    onClick={() => setPublishModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Publish Simulated Result
                  </button>
                )}

              {countingService.isResultPubliclyVisible(activeResult) && (
                <button
                  type="button"
                  onClick={handleUnpublish}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Unpublish
                </button>
              )}

              <button
                type="button"
                onClick={openCorrectionModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <FileEdit className="w-3.5 h-3.5" />
                Admin Correction
              </button>

              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Session
              </button>
            </div>
          </div>

          {/* 5 Counting KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 space-y-1">
              <span className="text-xs text-slate-500">
                Total Configured Demo Votes
              </span>
              <p className="text-lg font-extrabold text-slate-900 font-mono tabular-nums">
                {(activeResult.totalConfiguredVotes || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[11px] text-slate-500">
                Constituency cap limit
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-1">
              <span className="text-xs text-slate-500">Total Counted Votes</span>
              <p className="text-lg font-extrabold text-[#002868] font-mono tabular-nums">
                {(activeSummary.totalCountedVotes || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Valid: {activeSummary.validCandidateVotes.toLocaleString('en-IN')} · NOTA: {activeSummary.notaVotes}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-1">
              <span className="text-xs text-slate-500">
                Remaining Uncounted Buffer
              </span>
              <p className="text-lg font-extrabold text-slate-700 font-mono tabular-nums">
                {activeSummary.remainingVotes.toLocaleString('en-IN')}
              </p>
              <span className="text-[11px] text-slate-500">
                Round {activeSummary.currentRound} of{' '}
                {activeSummary.totalConfiguredRounds}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Counting Progress</span>
                <span className="font-bold font-mono tabular-nums text-slate-900">
                  {activeSummary.countingProgressPct}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-md overflow-hidden">
                <div
                  className="h-full bg-[#002868]"
                  style={{
                    width: `${Math.min(100, activeSummary.countingProgressPct)}%`,
                  }}
                />
              </div>
              <span className="text-[11px] text-slate-500 block">
                {activeSummary.isCompleted ? 'All Rounds Completed' : 'Simulation Active'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-1">
              <span className="text-xs text-slate-500">
                {activeSummary.isTied
                  ? 'Standing Status'
                  : activeSummary.isCompleted
                  ? 'Declared Winner (Final)'
                  : 'Current Leading Candidate'}
              </span>
              {activeSummary.isTied ? (
                <p className="text-sm font-extrabold text-red-700 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  TIED — Requires Resolution
                </p>
              ) : activeSummary.isCompleted && activeSummary.winnerCandidate ? (
                <p className="text-sm font-extrabold text-emerald-800 truncate">
                  {activeSummary.winnerCandidate.name} (
                  {activeSummary.winnerCandidate.partyAbbreviation})
                </p>
              ) : activeSummary.leadingCandidate ? (
                <p className="text-sm font-extrabold text-amber-800 truncate">
                  {activeSummary.leadingCandidate.name} (LEADING)
                </p>
              ) : (
                <p className="text-sm font-bold text-slate-400">
                  No Votes Counted Yet
                </p>
              )}
              <span className="text-[11px] text-slate-500 font-mono tabular-nums block">
                {activeSummary.isCompleted && activeSummary.victoryMargin !== null
                  ? `Final Victory Margin: +${activeSummary.victoryMargin.toLocaleString(
                      'en-IN'
                    )}`
                  : `Interim Lead: +${(
                      activeSummary.leadingMargin || 0
                    ).toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>

          {/* Candidate-Wise Vote Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Candidate-Wise Simulated Tally &amp; Standings
              </h3>
              <span className="text-xs text-slate-500">
                Winner is only calculated after counting completion
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/50">
                    <th className="py-2.5 px-4">Rank</th>
                    <th className="py-2.5 px-4">Candidate</th>
                    <th className="py-2.5 px-4">Party</th>
                    <th className="py-2.5 px-4 text-right">
                      Cumulative Votes
                    </th>
                    <th className="py-2.5 px-4 text-right">
                      Total Ballot Share (%)
                    </th>
                    <th className="py-2.5 px-4 text-right">
                      Valid Vote Share (%)
                    </th>
                    <th className="py-2.5 px-4 text-right">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {activeStandings.candidates.map((cand) => {
                    const isWinner =
                      activeSummary.isCompleted &&
                      !activeStandings.isTied &&
                      activeStandings.winnerCandidateId === cand.candidateId;
                    const isRunnerUp =
                      activeSummary.isCompleted &&
                      !activeStandings.isTied &&
                      activeStandings.runnerUpCandidateId === cand.candidateId;
                    const isLeading =
                      !activeSummary.isCompleted &&
                      !activeStandings.isTied &&
                      activeStandings.leadingCandidateId === cand.candidateId;
                    const isTied =
                      activeStandings.isTied &&
                      activeStandings.tiedCandidateIds.includes(cand.candidateId);

                    return (
                      <tr key={cand.candidateId} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-500">
                          #{cand.rank}
                        </td>
                        <td className="py-3 px-4 font-sans font-bold text-slate-900">
                          {cand.snapshotName || cand.candidateId}
                          <span className="block text-[10px] font-mono text-slate-400">
                            {cand.candidateId}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans font-semibold text-slate-700">
                          {cand.snapshotPartyAbbr || 'IND'}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                          {cand.totalVotes.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          {cand.votePercentage}%
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500">
                          {cand.validVotePercentage}%
                        </td>
                        <td className="py-3 px-4 text-right font-sans font-bold">
                          {isTied ? (
                            <span className="text-red-700">TIED</span>
                          ) : isWinner ? (
                            <span className="text-emerald-700">WINNER</span>
                          ) : isRunnerUp ? (
                            <span className="text-slate-600">RUNNER-UP</span>
                          ) : isLeading ? (
                            <span className="text-amber-700">LEADING</span>
                          ) : (
                            <span className="text-slate-400">CONTESTING</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* NOTA Accounting Row */}
                  <tr className="bg-slate-50/70">
                    <td className="py-2.5 px-4 text-slate-400">—</td>
                    <td className="py-2.5 px-4 font-sans font-bold text-slate-700">
                      None of the Above (NOTA)
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-500">
                      NOTA Option
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                      {activeStandings.notaVotes.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-600">
                      {activeStandings.notaPercentage}%
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                    <td className="py-2.5 px-4 text-right font-sans text-slate-500">
                      EXCLUDED FROM SEAT AWARD
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts & Round History Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CumulativeRoundLineChart
              rounds={activeResult.rounds || []}
              candidates={activeStandings.candidates}
              totalConfiguredVotes={activeResult.totalConfiguredVotes}
            />

            {/* Round-by-Round History Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Sequential Round History ({activeResult.rounds?.length || 0} /{' '}
                    {activeResult.totalConfiguredRounds || 3})
                  </h3>
                  <span className="text-xs text-slate-500">
                    Cumulative totals never decrease
                  </span>
                </div>

                {(activeResult.rounds || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No counting rounds processed yet. Click &quot;Start Counting Simulation&quot; or &quot;Process Next Round&quot; above.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="py-2.5 px-4">Round</th>
                          <th className="py-2.5 px-4 text-right">
                            Newly Counted
                          </th>
                          <th className="py-2.5 px-4 text-right">
                            Cumulative Total
                          </th>
                          <th className="py-2.5 px-4 text-right">Cum. NOTA</th>
                          <th className="py-2.5 px-4">Leading After Round</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                        {(activeResult.rounds || []).map((r) => {
                          const leadCand = (activeResult.candidates || []).find(
                            (c) => c.candidateId === r.leadingCandidateId
                          );
                          return (
                            <tr key={r.id || r.roundNumber}>
                              <td className="py-2.5 px-4 font-bold text-slate-900">
                                Round {r.roundNumber}
                              </td>
                              <td className="py-2.5 px-4 text-right text-emerald-700 font-semibold">
                                +{(r.newlyCountedVotes || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                                {(r.totalVotesCounted || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-600">
                                {(r.notaVotes || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-4 font-sans font-semibold text-slate-800">
                                {leadCand
                                  ? `${leadCand.snapshotName} (${leadCand.snapshotPartyAbbr})`
                                  : r.leadingCandidateId || 'Tied'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Correction History Log if any */}
              {(activeResult.correctionHistory || []).length > 0 && (
                <div className="p-4 border-t border-slate-200 bg-amber-50/50 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <History className="w-3.5 h-3.5" />
                    <span>
                      Administrative Correction History (
                      {activeResult.correctionHistory.length})
                    </span>
                  </div>
                  {activeResult.correctionHistory.map((corr) => (
                    <div
                      key={corr.id}
                      className="text-[11px] text-amber-950 border-t border-amber-200/60 pt-1.5"
                    >
                      <span className="font-mono font-bold">{corr.id}</span> ·{' '}
                      {new Date(corr.correctedAt).toLocaleString('en-IN')} by{' '}
                      <strong>{corr.adminName}</strong> — Reason: &ldquo;
                      {corr.reason}&rdquo; (Prev Counted:{' '}
                      {corr.previousTotalCountedVotes})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Filtered Result Sessions Directory Table + Party Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Configured Constituency Result Sessions ({filteredResults.length})
              </h2>
              <p className="text-xs text-slate-500">
                Select any row to open it in the Counting Management Console above
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-3 px-4">Election &amp; Type</th>
                  <th className="py-3 px-4">Constituency</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Rounds</th>
                  <th className="py-3 px-4 text-right">Counted / Limit</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((r) => {
                  const seat = constituencies.find(
                    (c) => (c.id || c.constituencyId) === r.constituencyId
                  );
                  const isSelected = activeResult?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      className={
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }
                    >
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">
                          {r.electionId}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {r.electionType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">
                          {seat?.name || r.constituencyId}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {r.stateId} · {r.constituencyId}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {RESULT_STATUS_LABELS[r.status] || r.status}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {r.currentRound || 0}/{r.totalConfiguredRounds || 3}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                        {(r.totalCountedVotes || 0).toLocaleString('en-IN')} /{' '}
                        {(r.totalConfiguredVotes || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedResultId(r.id);
                            setSelectedElectionId(r.electionId);
                            setSelectedConstituencyId(r.constituencyId);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                            isSelected
                              ? 'bg-[#002868] text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {isSelected ? 'Active' : 'Manage'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <PartySeatsBarChart
            partyRows={partyAnalyticsForActiveElection.partyRows}
            title={`Party Standings (${partyAnalyticsForActiveElection.electionId})`}
            subtitle="Includes both declared and ongoing counting sessions"
          />

          {/* Recent Result Audit Logs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Recent Counting &amp; Result Audit Logs
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
              {resultAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="font-bold text-[#002868]">
                      {log.actionType}
                    </span>
                    <span>
                      {new Date(log.timestamp).toLocaleTimeString('en-IN')}
                    </span>
                  </div>
                  <p className="text-slate-700">{log.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Confirm Reset Counting Session */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Confirm Counting Session Reset"
        subtitle="Reset all rounds and candidate vote totals for this constituency back to zero"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-600">
          <p>
            Are you sure you want to reset the demo counting session for{' '}
            <strong>
              {activeSeat?.name || activeResult?.constituencyId} (
              {activeResult?.electionId})
            </strong>
            ? All processed rounds will be cleared and the status will return to{' '}
            <strong>DRAFT</strong>.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmResetSession}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              Confirm Session Reset
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Confirm Publish Result */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Confirm Public Result Declaration"
        subtitle="Publish verified simulated constituency result to the Public Results Portal"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-600">
          <p>
            You are about to publish the simulated result for{' '}
            <strong>
              {activeSeat?.name || activeResult?.constituencyId} (
              {activeResult?.electionId})
            </strong>
            .
          </p>
          {activeSummary?.winnerCandidate && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1 text-emerald-950">
              <p className="font-bold">
                Declared Simulated Winner: {activeSummary.winnerCandidate.name}{' '}
                ({activeSummary.winnerCandidate.partyAbbreviation})
              </p>
              <p className="font-mono tabular-nums">
                Final Votes:{' '}
                {activeSummary.winnerCandidate.totalVotes.toLocaleString('en-IN')}{' '}
                ({activeSummary.winnerCandidate.votePercentage}%) · Victory
                Margin: +{(activeSummary.victoryMargin || 0).toLocaleString('en-IN')}
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPublishModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmPublish}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
            >
              Confirm &amp; Publish Result
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: Public Result Presentation Preview */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Public Result Presentation Preview"
        subtitle={`${activeResult?.electionId} · ${
          activeSeat?.name || activeResult?.constituencyId
        }`}
      >
        {activeSummary && activeStandings && (
          <div className="space-y-4 text-xs">
            <SimulatedResultDisclaimer compact />
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Current Status:</span>
                <span className="font-bold text-slate-900">
                  {RESULT_STATUS_LABELS[activeResult.status] ||
                    activeResult.status}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="font-sans text-slate-500">
                  Total Simulated Votes Counted:
                </span>
                <span className="font-bold text-slate-900">
                  {activeSummary.totalCountedVotes.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">
                  {activeSummary.isCompleted
                    ? 'Declared Winner:'
                    : 'Leading Candidate:'}
                </span>
                <span className="font-bold text-emerald-800">
                  {activeSummary.winnerCandidate?.name ||
                    activeSummary.leadingCandidate?.name ||
                    'None'}
                </span>
              </div>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden font-mono tabular-nums">
              {activeStandings.candidates.map((c) => (
                <div
                  key={c.candidateId}
                  className="px-4 py-2.5 flex items-center justify-between bg-white"
                >
                  <span className="font-sans font-bold text-slate-900">
                    #{c.rank} {c.snapshotName} ({c.snapshotPartyAbbr})
                  </span>
                  <span>
                    {c.totalVotes.toLocaleString('en-IN')} ({c.votePercentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal 4: Explicit Administrative Result Correction Workflow */}
      <Modal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        title="Administrative Result Correction Workflow"
        subtitle="Modify candidate/NOTA totals with mandatory audit reason and history preservation"
      >
        {activeResult && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Configured Constituency Limit:{' '}
              <strong className="font-mono">
                {(activeResult.totalConfiguredVotes || 15000).toLocaleString(
                  'en-IN'
                )}{' '}
                votes
              </strong>
              . Previous totals are preserved in the correction history.
            </p>

            <div className="space-y-2.5">
              {(activeResult.candidates || []).map((c) => (
                <div
                  key={c.candidateId}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {c.snapshotName} ({c.snapshotPartyAbbr})
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {c.candidateId}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={correctionEdits[c.candidateId] ?? c.totalVotes}
                    onChange={(e) =>
                      setCorrectionEdits({
                        ...correctionEdits,
                        [c.candidateId]: e.target.value,
                      })
                    }
                    className="w-32 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-right"
                  />
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <span className="font-bold text-slate-800">
                  None of the Above (NOTA) Votes
                </span>
                <input
                  type="number"
                  min={0}
                  value={correctionNota}
                  onChange={(e) => setCorrectionNota(e.target.value)}
                  className="w-32 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-right"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mandatory Administrative Correction Reason
              </label>
              <textarea
                rows={2}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Document the official reason for this demo tally correction..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCorrectionModalOpen(false)}
                className="px-4 py-2 rounded-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCorrection}
                className="px-4 py-2 rounded-lg font-bold bg-[#002868] hover:bg-blue-900 text-white cursor-pointer"
              >
                Confirm &amp; Record Correction
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
