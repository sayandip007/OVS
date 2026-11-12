import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../services/apiClient';
import {
  ADMIN_PERMISSION_KEYS,
  hasAdminPermission,
} from '../../services/adminPermissionService';
import {
  BarChart3,
  Search,
  PlusCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  Eye,
  AlertTriangle,
  History,
  FileCheck2,
  Award,
} from 'lucide-react';
import Modal from '../common/Modal';

export default function BackendResultsManager() {
  const { currentAdmin, csrfToken } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const canManage = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.RESULTS_MANAGE
  );
  const canTally = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.RESULTS_TALLY_MANAGE
  );
  const canReview = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.RESULTS_REVIEW
  );
  const canPublish = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.RESULTS_PUBLISH
  );
  const canTieBreak = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.RESULTS_TIE_RESOLVE
  );

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [electionFilter, setElectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [tallyModalOpen, setTallyModalOpen] = useState(false);
  const [tieBreakModalOpen, setTieBreakModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [correctModalOpen, setCorrectModalOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    electionId: 'LS-2029',
    constituencyType: 'PARLIAMENTARY',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: '',
    totalConfiguredRounds: 5,
    totalVoters: 1500000,
  });

  const [roundForm, setRoundForm] = useState({
    roundNumber: 1,
    roundVotes: 3000,
    cumulativeVotes: 3000,
    leadMargin: 200,
    leadingCandidateId: '',
  });

  const [tallyVotes, setTallyVotes] = useState({});
  const [notaVotes, setNotaVotes] = useState(300);
  const [rejectedVotes, setRejectedVotes] = useState(200);

  const [tieBreakForm, setTieBreakForm] = useState({
    selectedWinnerId: '',
    decision: 'SIMULATED_DRAW_WINNER_DECLARED',
    resolutionMethod: 'SIMULATED_DRAW_OF_LOTS',
    justificationNote: 'Simulated draw of lots conducted pursuant to statutory demo guidelines with candidate agents present.',
  });

  const [correctionForm, setCorrectionForm] = useState({
    reason: 'Data entry reconciliation audit correction for demo scenario.',
    notaVotes: 0,
    rejectedVotes: 0,
    candidateVotes: {},
  });

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.admin.counting.listSessions({
        page: 1,
        limit: 50,
        ...(electionFilter ? { electionId: electionFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setSessions(res?.data || []);
      if (!selectedSession && res?.data?.length > 0) {
        setSelectedSession(res.data[0]);
      }
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to load counting sessions.');
    } finally {
      setLoading(false);
    }
  }, [electionFilter, statusFilter, selectedSession, notifyError]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleInspectSession = async (sessionId) => {
    try {
      const res = await apiClient.admin.counting.getSession(sessionId);
      setSelectedSession(res?.data || null);
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to inspect session.');
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        electionId: createForm.electionId,
        constituencyType: createForm.constituencyType,
        totalConfiguredRounds: Number(createForm.totalConfiguredRounds),
        totalVoters: Number(createForm.totalVoters),
        ...(createForm.constituencyType === 'PARLIAMENTARY'
          ? { parliamentaryConstituencyId: createForm.parliamentaryConstituencyId }
          : { assemblyConstituencyId: createForm.assemblyConstituencyId }),
      };
      await apiClient.admin.counting.createSession(payload, csrfToken);
      notifySuccess('Counting session created successfully.');
      setCreateModalOpen(false);
      await loadSessions();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to create session.');
    }
  };

  const handleRecordRound = async (e) => {
    e.preventDefault();
    if (!selectedSession) return;
    try {
      const payload = {
        roundNumber: Number(roundForm.roundNumber),
        roundVotes: Number(roundForm.roundVotes),
        cumulativeVotes: Number(roundForm.cumulativeVotes),
        leadMargin: Number(roundForm.leadMargin),
        leadingCandidateId: roundForm.leadingCandidateId || null,
      };
      await apiClient.admin.counting.recordRound(selectedSession.id, payload, csrfToken);
      notifySuccess(`Round ${payload.roundNumber} recorded successfully.`);
      setRoundModalOpen(false);
      await handleInspectSession(selectedSession.id);
      await loadSessions();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to record round.');
    }
  };

  const openTallyModal = () => {
    if (!selectedSession) return;
    const initialVotes = {};
    for (const t of selectedSession.tallies || []) {
      initialVotes[t.candidateId] = t.votes || 0;
    }
    setTallyVotes(initialVotes);
    setNotaVotes(selectedSession.notaVotes || 0);
    setRejectedVotes(selectedSession.rejectedVotes || 0);
    setTallyModalOpen(true);
  };

  const handleRecordTallies = async (e) => {
    e.preventDefault();
    if (!selectedSession) return;
    try {
      const talliesArray = Object.entries(tallyVotes).map(([candidateId, votes]) => ({
        candidateId,
        votes: Number(votes),
      }));
      await apiClient.admin.counting.recordTallies(
        selectedSession.id,
        {
          tallies: talliesArray,
          notaVotes: Number(notaVotes),
          rejectedVotes: Number(rejectedVotes),
        },
        csrfToken
      );
      notifySuccess('Candidate tallies recorded successfully.');
      setTallyModalOpen(false);
      await handleInspectSession(selectedSession.id);
      await loadSessions();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to record tallies.');
    }
  };

  const handleTieBreak = async (e) => {
    e.preventDefault();
    if (!selectedSession) return;
    try {
      await apiClient.admin.counting.resolveTie(
        selectedSession.id,
        tieBreakForm,
        csrfToken
      );
      notifySuccess('Tie resolved successfully via simulated draw of lots.');
      setTieBreakModalOpen(false);
      await handleInspectSession(selectedSession.id);
      await loadSessions();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to resolve tie break.');
    }
  };

  const handleSubmitForReview = async () => {
    if (!selectedSession) return;
    try {
      await apiClient.admin.counting.submitForReview(selectedSession.id, csrfToken);
      notifySuccess('Session advanced to RESULT_READY_FOR_REVIEW.');
      await handleInspectSession(selectedSession.id);
      await loadSessions();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to submit for review.');
    }
  };

  const handlePublish = async () => {
    if (!selectedSession) return;
    try {
      await apiClient.admin.counting.publish(selectedSession.id, csrfToken);
      notifySuccess(`Result '${selectedSession.id}' published successfully.`);
      setPublishModalOpen(false);
      await handleInspectSession(selectedSession.id);
      await loadSessions();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to publish result.');
    }
  };

  const handleResetSession = async () => {
    if (!selectedSession) return;
    if (!window.confirm(`Reset counting session '${selectedSession.id}' back to DRAFT?`)) return;
    try {
      await apiClient.admin.counting.reset(selectedSession.id, csrfToken);
      notifySuccess('Session reset to DRAFT.');
      await handleInspectSession(selectedSession.id);
      await loadSessions();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to reset session.');
    }
  };

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    const term = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.id.toLowerCase().includes(term) ||
        s.electionId.toLowerCase().includes(term) ||
        (s.parliamentaryConstituency?.name || '').toLowerCase().includes(term) ||
        (s.assemblyConstituency?.name || '').toLowerCase().includes(term)
    );
  }, [sessions, search]);

  return (
    <div className="space-y-6">
      {/* Simulation Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">Independent Demo Counting & Result Publication Simulation (Backend Mode)</p>
          <p className="mt-1">
            Demo counting data is strictly isolated from voter participation records. Candidate choices are never stored or Derivable from DemoParticipation.
          </p>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            ECI Counting & Results Management
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Phase 8.9: Multi-round synthetic tallies, leader detection, tie resolution & publication simulation.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            Initialize Counting Session
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by session ID or constituency..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-sm"
          />
        </div>
        <select
          value={electionFilter}
          onChange={(e) => setElectionFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-sm"
        >
          <option value="">All Elections</option>
          <option value="LS-2029">Lok Sabha 2029</option>
          <option value="WB-ASSEMBLY-2029">WB Assembly 2029</option>
          <option value="DL-ASSEMBLY-2029">Delhi Assembly 2029</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="COUNTING_IN_PROGRESS">COUNTING_IN_PROGRESS</option>
          <option value="COUNTING_COMPLETED">COUNTING_COMPLETED</option>
          <option value="TIED">TIED</option>
          <option value="RESULT_READY_FOR_REVIEW">RESULT_READY_FOR_REVIEW</option>
          <option value="PUBLISHED">PUBLISHED</option>
        </select>
      </div>

      {/* Main Grid: Sessions List & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Sessions List */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              Constituency Sessions ({filteredSessions.length})
            </span>
            {loading && <span className="text-xs text-indigo-500 animate-pulse">Loading...</span>}
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800">
            {filteredSessions.map((s) => {
              const constName =
                s.parliamentaryConstituency?.name ||
                s.assemblyConstituency?.name ||
                s.id;
              const isSelected = selectedSession?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => handleInspectSession(s.id)}
                  className={`p-4 cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white text-sm">
                        {constName}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">{s.electionId} &bull; {s.constituencyType}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        s.status === 'PUBLISHED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : s.status === 'TIED'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : s.status === 'RESULT_READY_FOR_REVIEW'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-3 text-xs text-slate-500">
                    <span>Round {s.currentRound} / {s.totalConfiguredRounds}</span>
                    <span>{s.totalCountedVotes.toLocaleString()} votes</span>
                  </div>
                </div>
              );
            })}
            {filteredSessions.length === 0 && !loading && (
              <div className="p-8 text-center text-sm text-slate-500">
                No counting sessions found matching filter.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Session Inspector */}
        <div className="lg:col-span-2 space-y-6">
          {selectedSession ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
              {/* Session Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedSession.parliamentaryConstituency?.name ||
                        selectedSession.assemblyConstituency?.name ||
                        selectedSession.id}
                    </h2>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        selectedSession.isPublished
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {selectedSession.isPublished ? 'PUBLISHED' : selectedSession.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    ID: {selectedSession.id} &bull; Election: {selectedSession.electionId} ({selectedSession.constituencyType})
                  </p>
                </div>

                {/* State Machine Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {canTally && !['COUNTING_COMPLETED', 'RESULT_READY_FOR_REVIEW', 'PUBLISHED', 'TIED'].includes(selectedSession.status) && (
                    <>
                      <button
                        onClick={() => {
                          const nextRound = selectedSession.currentRound + 1;
                          setRoundForm({
                            roundNumber: nextRound,
                            roundVotes: 3000,
                            cumulativeVotes: (selectedSession.totalCountedVotes || 0) + 3000,
                            leadMargin: 250,
                            leadingCandidateId: selectedSession.winnerCandidateId || '',
                          });
                          setRoundModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                      >
                        <Play className="w-3.5 h-3.5" /> Record Round {selectedSession.currentRound + 1}
                      </button>
                      <button
                        onClick={openTallyModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
                      >
                        <BarChart3 className="w-3.5 h-3.5" /> Record Tallies
                      </button>
                    </>
                  )}

                  {selectedSession.status === 'TIED' && canTieBreak && (
                    <button
                      onClick={() => {
                        const maxV = Math.max(...(selectedSession.tallies || []).map((t) => t.votes));
                        const tied = (selectedSession.tallies || []).filter((t) => t.votes === maxV);
                        setTieBreakForm((f) => ({
                          ...f,
                          selectedWinnerId: tied[0]?.candidateId || '',
                        }));
                        setTieBreakModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium animate-pulse"
                    >
                      <Award className="w-3.5 h-3.5" /> Resolve Genuine Tie Break
                    </button>
                  )}

                  {canReview && selectedSession.status === 'COUNTING_COMPLETED' && (
                    <button
                      onClick={handleSubmitForReview}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" /> Submit for Review
                    </button>
                  )}

                  {canPublish && selectedSession.status === 'RESULT_READY_FOR_REVIEW' && (
                    <button
                      onClick={() => setPublishModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Publish Official Result
                    </button>
                  )}

                  {canManage && ['SUPER_ADMIN', 'NATIONAL_ADMIN'].includes(currentAdmin?.role) && (
                    <button
                      onClick={handleResetSession}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-medium"
                      title="Reset Session for Demonstration Re-runs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Numerical Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Total Counted Votes</span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {selectedSession.totalCountedVotes.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Progress</span>
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    Round {selectedSession.currentRound} / {selectedSession.totalConfiguredRounds}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">NOTA Votes</span>
                  <div className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-1">
                    {selectedSession.notaVotes.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Victory Margin</span>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {selectedSession.victoryMargin.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Declared Winner / Runner-up banner */}
              {selectedSession.winnerCandidate && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        Declared Winner
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {selectedSession.winnerCandidate.fullName} ({selectedSession.winnerCandidate.partyId})
                      </h3>
                    </div>
                  </div>
                  {selectedSession.runnerUpCandidate && (
                    <div className="text-right text-xs text-slate-600 dark:text-slate-400">
                      <span>Runner-up: {selectedSession.runnerUpCandidate.fullName}</span>
                      <p className="font-medium text-emerald-700 dark:text-emerald-300 mt-0.5">
                        Lead: +{selectedSession.victoryMargin.toLocaleString()} votes
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Candidate Tallies Table */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Candidate Tallies & Vote Shares
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Candidate</th>
                        <th className="py-2.5 px-4">Party</th>
                        <th className="py-2.5 px-4 text-right">Votes</th>
                        <th className="py-2.5 px-4 text-right">Vote Share (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(selectedSession.tallies || []).map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                            {t.candidate?.fullName || t.candidateId}
                            {t.candidateId === selectedSession.winnerCandidateId && (
                              <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">WINNER</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                            {t.party?.abbreviation || t.partyId || 'Independent'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                            {t.votes.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-400">
                            {t.voteSharePercentage}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Counting Rounds Timeline */}
              {selectedSession.rounds && selectedSession.rounds.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-400" />
                    Counting Rounds History ({selectedSession.rounds.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedSession.rounds.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                      >
                        <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                          <span>Round #{r.roundNumber}</span>
                          <span className="font-mono text-indigo-600">+{r.roundVotes.toLocaleString()}</span>
                        </div>
                        <div className="mt-2 text-slate-500 space-y-0.5">
                          <p>Cumulative: {r.cumulativeVotes.toLocaleString()}</p>
                          {r.leadingCandidate && (
                            <p className="truncate">Leader: {r.leadingCandidate.fullName} (+{r.leadMargin})</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500">
              Select a constituency counting session from the left list to view or record data.
            </div>
          )}
        </div>
      </div>

      {/* Record Round Modal */}
      {roundModalOpen && (
        <Modal
          isOpen={roundModalOpen}
          onClose={() => setRoundModalOpen(false)}
          title={`Record Round ${roundForm.roundNumber} for ${selectedSession?.id}`}
        >
          <form onSubmit={handleRecordRound} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1">Round Number</label>
              <input
                type="number"
                disabled
                value={roundForm.roundNumber}
                className="w-full border rounded p-2 bg-slate-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Votes Counted in this Round</label>
              <input
                type="number"
                min="0"
                value={roundForm.roundVotes}
                onChange={(e) => {
                  const votes = Number(e.target.value);
                  const prevCum = selectedSession?.rounds?.reduce((max, r) => Math.max(max, r.cumulativeVotes), 0) || 0;
                  setRoundForm((f) => ({
                    ...f,
                    roundVotes: votes,
                    cumulativeVotes: prevCum + votes,
                  }));
                }}
                className="w-full border rounded p-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cumulative Votes after Round</label>
              <input
                type="number"
                min="0"
                value={roundForm.cumulativeVotes}
                onChange={(e) => setRoundForm((f) => ({ ...f, cumulativeVotes: Number(e.target.value) }))}
                className="w-full border rounded p-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Leading Candidate in Round</label>
              <select
                value={roundForm.leadingCandidateId}
                onChange={(e) => setRoundForm((f) => ({ ...f, leadingCandidateId: e.target.value }))}
                className="w-full border rounded p-2 text-sm"
              >
                <option value="">None / Undeclared</option>
                {(selectedSession?.tallies || []).map((t) => (
                  <option key={t.candidateId} value={t.candidateId}>
                    {t.candidate?.fullName || t.candidateId}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setRoundModalOpen(false)}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
              >
                Save Round
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Tallies Modal */}
      {tallyModalOpen && (
        <Modal
          isOpen={tallyModalOpen}
          onClose={() => setTallyModalOpen(false)}
          title={`Record Synthetic Tallies for ${selectedSession?.id}`}
        >
          <form onSubmit={handleRecordTallies} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <p className="text-xs text-slate-500">
              Enter non-negative vote totals for candidates. If top 2 candidates have equal votes, session status will automatically transition to TIED.
            </p>
            {(selectedSession?.tallies || []).map((t) => (
              <div key={t.candidateId} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex-1">
                  {t.candidate?.fullName || t.candidateId} ({t.partyId || 'IND'})
                </span>
                <input
                  type="number"
                  min="0"
                  value={tallyVotes[t.candidateId] ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTallyVotes((prev) => ({ ...prev, [t.candidateId]: val }));
                  }}
                  className="w-32 border rounded p-1.5 text-right font-mono text-sm"
                  required
                />
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 pt-2 border-t">
              <span className="text-sm font-medium">NOTA Votes</span>
              <input
                type="number"
                min="0"
                value={notaVotes}
                onChange={(e) => setNotaVotes(Number(e.target.value))}
                className="w-32 border rounded p-1.5 text-right font-mono text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Rejected Ballots</span>
              <input
                type="number"
                min="0"
                value={rejectedVotes}
                onChange={(e) => setRejectedVotes(Number(e.target.value))}
                className="w-32 border rounded p-1.5 text-right font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setTallyModalOpen(false)}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium"
              >
                Save Tallies
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Tie Break Modal */}
      {tieBreakModalOpen && (
        <Modal
          isOpen={tieBreakModalOpen}
          onClose={() => setTieBreakModalOpen(false)}
          title={`Simulated Tie Resolution for ${selectedSession?.id}`}
        >
          <form onSubmit={handleTieBreak} className="space-y-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded text-xs text-rose-800 dark:text-rose-200">
              Session is in TIED status. Winner must be selected from the candidates tied with the highest vote count.
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Selected Winner</label>
              <select
                value={tieBreakForm.selectedWinnerId}
                onChange={(e) => setTieBreakForm((f) => ({ ...f, selectedWinnerId: e.target.value }))}
                className="w-full border rounded p-2 text-sm"
                required
              >
                <option value="">Select tied winner...</option>
                {(selectedSession?.tallies || []).map((t) => (
                  <option key={t.candidateId} value={t.candidateId}>
                    {t.candidate?.fullName || t.candidateId} ({t.votes} votes)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Resolution Method</label>
              <select
                value={tieBreakForm.resolutionMethod}
                onChange={(e) => setTieBreakForm((f) => ({ ...f, resolutionMethod: e.target.value }))}
                className="w-full border rounded p-2 text-sm"
              >
                <option value="SIMULATED_DRAW_OF_LOTS">Simulated Draw of Lots</option>
                <option value="DRAW_OF_LOTS_RO_SECTION_102_RPA_1951">Draw of Lots (Section 102 RPA 1951)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Justification Note (minimum 10 characters)</label>
              <textarea
                value={tieBreakForm.justificationNote}
                onChange={(e) => setTieBreakForm((f) => ({ ...f, justificationNote: e.target.value }))}
                className="w-full border rounded p-2 text-sm h-24"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setTieBreakModalOpen(false)}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-sm font-medium"
              >
                Confirm Tie Break Decision
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Publish Modal */}
      {publishModalOpen && (
        <Modal
          isOpen={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          title={`Publish Result for ${selectedSession?.id}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Are you sure you want to officially publish the results for this constituency?
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border text-xs space-y-1">
              <p>Winner: <strong>{selectedSession?.winnerCandidate?.fullName}</strong></p>
              <p>Total Counted: <strong>{selectedSession?.totalCountedVotes?.toLocaleString()}</strong> votes</p>
              <p>Completed Rounds: <strong>{selectedSession?.currentRound} / {selectedSession?.totalConfiguredRounds}</strong></p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium"
              >
                Confirm Publication
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
