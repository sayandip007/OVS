import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { frontendEnv } from '../../config/env';
import { apiClient } from '../../services/apiClient';
import StatsCard from '../../components/admin/StatsCard';
import BackendAnalyticsDashboard from '../../components/admin/BackendAnalyticsDashboard';
import {
  CONSTITUENCY_TYPES,
  ELECTION_TYPES,
  ELECTION_STATUS_LABELS,
  CANDIDATE_STATUS_LABELS,
} from '../../utils/constants';
import {
  PlusCircle,
  Landmark,
  Flag,
  Users,
  Megaphone,
  FileText,
  RotateCcw,
  Eye,
} from 'lucide-react';

export default function AdminDashboard() {
  const {
    states = [],
    constituencies = [],
    elections = [],
    candidates = [],
    voters = [],
    participationRecords = [],
    resetDemoData,
  } = useElection();
  const { currentAdmin, canPerformAdminAction } = useAuth();
  const { notifyInfo, notifyError } = useNotification();
  const [backendSummary, setBackendSummary] = useState(null);

  useEffect(() => {
    if (!frontendEnv.isBackendApi) return;
    apiClient.admin.elections
      .summary()
      .then((res) => setBackendSummary(res?.data || null))
      .catch(() => {});
  }, []);

  // 10 Live Calculated Summary Metrics
  const totalStates = states.filter((s) => s.type === 'STATE').length;
  const totalUTs = states.filter((s) => s.type === 'UT').length;
  const totalPCs = constituencies.filter(
    (c) => c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
  ).length;
  const totalACs = constituencies.filter(
    (c) => c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY
  ).length;

  const activeElections = elections.filter((e) => e.status === 'POLLING_ACTIVE');
  const upcomingElections = elections.filter((e) =>
    ['DRAFT', 'UPCOMING', 'NOMINATION_OPEN', 'NOMINATION_CLOSED', 'READY'].includes(e.status)
  );
  const completedElections = elections.filter((e) =>
    ['POLLING_COMPLETED', 'COUNTING', 'RESULTS_DECLARED', 'ARCHIVED'].includes(e.status)
  );
  const votedParticipationRecords = participationRecords.filter(
    (r) => r.status === 'VOTED'
  );

  // Breakdowns for Visualisations
  const lsElectionsCount = elections.filter(
    (e) => e.electionType === ELECTION_TYPES.LOK_SABHA
  ).length;
  const saElectionsCount = elections.filter(
    (e) => e.electionType === ELECTION_TYPES.STATE_ASSEMBLY
  ).length;

  const lsParticipations = votedParticipationRecords.filter(
    (r) => r.electionType === ELECTION_TYPES.LOK_SABHA
  ).length;
  const saParticipations = votedParticipationRecords.filter(
    (r) => r.electionType === ELECTION_TYPES.STATE_ASSEMBLY
  ).length;

  const statusDistribution = Object.keys(ELECTION_STATUS_LABELS)
    .map((statusKey) => ({
      status: statusKey,
      label: ELECTION_STATUS_LABELS[statusKey],
      count: elections.filter((e) => e.status === statusKey).length,
    }))
    .filter((item) => item.count > 0);

  const candidateStatusBreakdown = Object.entries(CANDIDATE_STATUS_LABELS).map(
    ([statusKey, label]) => ({
      status: statusKey,
      label,
      count: candidates.filter((c) => (c.status || 'APPROVED') === statusKey).length,
    })
  );

  const handleResetDemo = () => {
    const check = canPerformAdminAction('RESET_DEMO_DATA');
    if (!check.allowed) {
      notifyError(check.reason);
      return;
    }
    resetDemoData(currentAdmin);
    notifyInfo(
      'All elections, constituencies, candidates, parties, and voter participation records have been reset to clean initial demo state.'
    );
  };

  if (frontendEnv.isBackendApi) {
    return <BackendAnalyticsDashboard />;
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Election Commission of India • Master Control
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              National &amp; State Election Operations Overview
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Live command centre for Lok Sabha General Elections, State Legislative Assembly Elections, 36 States/UTs, Constituencies, Candidates, and Aggregate Participation.
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <p className="font-bold text-slate-900">
              Officer: {currentAdmin?.fullName || 'ECI Officer'}
            </p>
            <p className="text-slate-500">
              Role: <span className="font-mono font-semibold">{currentAdmin?.role}</span>
              {currentAdmin?.assignedStateId ? ` (${currentAdmin.assignedStateId})` : ''}
            </p>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Quick Actions:
          </span>
          <Link
            to="/eci/elections/create"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Create Election
          </Link>
          <Link
            to="/eci/constituencies"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            <Landmark className="w-3.5 h-3.5" />
            Add Constituency
          </Link>
          <Link
            to="/eci/parties"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            <Flag className="w-3.5 h-3.5" />
            Add Party
          </Link>
          <Link
            to="/eci/candidates"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FF9933] hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Add Candidate
          </Link>
          <Link
            to="/eci/announcements"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            <Megaphone className="w-3.5 h-3.5" />
            Create Announcement
          </Link>
          <Link
            to="/eci/audit-logs"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            View Audit Logs
          </Link>
          {canPerformAdminAction('RESET_DEMO_DATA').allowed && (
            <button
              type="button"
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-xs font-bold rounded-xl cursor-pointer ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Data
            </button>
          )}
        </div>
      </div>

      {/* Backend Jurisdiction-Scoped Election Summary (Phase 8.5 BACKEND_API) */}
      {frontendEnv.isBackendApi && backendSummary && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">
              Authorized Election Overview (Live Backend API)
            </h2>
            <Link
              to="/eci/elections"
              className="text-xs font-bold text-[#002868] hover:underline"
            >
              Open Election Directory →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
            {[
              { label: 'Total', value: backendSummary.total },
              { label: 'Lok Sabha', value: backendSummary.lokSabha },
              { label: 'Assembly', value: backendSummary.stateAssembly },
              { label: 'Draft', value: backendSummary.draft },
              { label: 'Active', value: backendSummary.active },
              { label: 'Completed', value: backendSummary.completed },
              { label: 'Cancelled', value: backendSummary.cancelled },
              { label: 'Archived', value: backendSummary.archived },
            ].map((item) => (
              <div
                key={item.label}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <p className="text-[11px] font-bold uppercase text-slate-500">
                  {item.label}
                </p>
                <p className="text-lg font-extrabold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 10 Live Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Total Elections"
          value={elections.length}
          subtitle={`${lsElectionsCount} Lok Sabha • ${saElectionsCount} Assembly`}
          badge="Configured"
          accent="blue"
        />
        <StatsCard
          title="Active Elections"
          value={activeElections.length}
          subtitle="Polling Currently Open"
          badge="POLLING_ACTIVE"
          accent="emerald"
        />
        <StatsCard
          title="Upcoming Elections"
          value={upcomingElections.length}
          subtitle="Draft / Scheduled / Ready"
          badge="Pre-Poll"
          accent="amber"
        />
        <StatsCard
          title="Completed Elections"
          value={completedElections.length}
          subtitle="Polling Closed / Declared"
          badge="Post-Poll"
          accent="slate"
        />
        <StatsCard
          title="Total States & UTs"
          value={states.length}
          subtitle={`${totalStates} States + ${totalUTs} UTs`}
          badge="All India"
          accent="blue"
        />
        <StatsCard
          title="Parliamentary (PCs)"
          value={totalPCs}
          subtitle="Lok Sabha Constituencies"
          badge="PARLIAMENTARY"
          accent="indigo"
        />
        <StatsCard
          title="Assembly (ACs)"
          value={totalACs}
          subtitle="State Vidhan Sabha Seats"
          badge="ASSEMBLY"
          accent="teal"
        />
        <StatsCard
          title="Registered Candidates"
          value={candidates.length}
          subtitle={`${candidates.filter((c) => c.status === 'APPROVED').length} Approved on Ballot`}
          badge="Nominations"
          accent="amber"
        />
        <StatsCard
          title="Registered Demo Voters"
          value={voters.length}
          subtitle="Mapped to PC & AC"
          badge="Electoral Roll"
          accent="emerald"
        />
        <StatsCard
          title="Participation Records"
          value={votedParticipationRecords.length}
          subtitle={`${lsParticipations} LS • ${saParticipations} Assembly`}
          badge="Aggregate Turnout"
          accent="indigo"
        />
      </div>

      {/* Dashboard Visualisations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual 1: Elections by Type & Participation */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Simultaneous Election Type &amp; Turnout Split
            </h2>
            <p className="text-xs text-slate-500">
              Independent Lok Sabha vs State Assembly tracking
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-950">
                  Lok Sabha General (LOK_SABHA)
                </span>
                <span className="font-mono font-bold text-indigo-900">
                  {lsElectionsCount} Election(s)
                </span>
              </div>
              <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-700 rounded-full"
                  style={{
                    width: `${
                      voters.length > 0
                        ? Math.min(100, Math.round((lsParticipations / voters.length) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-indigo-800">
                <span>Demo Votes Recorded: {lsParticipations}</span>
                <span>
                  {voters.length > 0
                    ? Math.round((lsParticipations / voters.length) * 100)
                    : 0}
                  % of Roll
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-teal-950">
                  State Legislative Assembly (STATE_ASSEMBLY)
                </span>
                <span className="font-mono font-bold text-teal-900">
                  {saElectionsCount} Election(s)
                </span>
              </div>
              <div className="w-full h-2 bg-teal-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-700 rounded-full"
                  style={{
                    width: `${
                      voters.length > 0
                        ? Math.min(100, Math.round((saParticipations / voters.length) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-teal-800">
                <span>Demo Votes Recorded: {saParticipations}</span>
                <span>
                  {voters.length > 0
                    ? Math.round((saParticipations / voters.length) * 100)
                    : 0}
                  % of Roll
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual 2: Elections by Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Elections by Lifecycle Status
            </h2>
            <p className="text-xs text-slate-500">
              Distribution across 11 ECI lifecycle stages
            </p>
          </div>
          <div className="space-y-2.5">
            {statusDistribution.map((item) => {
              const pct =
                elections.length > 0
                  ? Math.round((item.count / elections.length) * 100)
                  : 0;
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{item.label}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#002868] rounded-full"
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Visual 3: Candidate Nomination Status & State Coverage */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Candidate Scrutiny &amp; State Coverage
            </h2>
            <p className="text-xs text-slate-500">
              Only APPROVED candidates appear on voter ballots
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {candidateStatusBreakdown
              .filter((c) => c.count > 0 || ['APPROVED', 'UNDER_REVIEW', 'REJECTED', 'DRAFT'].includes(c.status))
              .slice(0, 6)
              .map((item) => (
                <div
                  key={item.status}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <span className="text-[11px] font-semibold text-slate-700 truncate">
                    {item.label}
                  </span>
                  <span className="text-xs font-mono font-extrabold text-slate-900 ml-2">
                    {item.count}
                  </span>
                </div>
              ))}
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Active States/UTs Covered:</span>
            <span className="font-bold text-emerald-800">
              {states.filter((s) => s.isActive !== false).length} / {states.length} Active
            </span>
          </div>
        </div>
      </div>

      {/* Election Overview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Election Overview Table
            </h2>
            <p className="text-xs text-slate-500">
              Real-time overview of all configured Lok Sabha and State Assembly elections, candidate counts, and aggregate participation.
            </p>
          </div>
          <Link
            to="/eci/elections"
            className="text-xs font-bold text-[#002868] hover:underline"
          >
            Manage All Elections &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-4">Election ID</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">State / National Scope</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Polling Window</th>
                <th className="py-3 px-4">Candidates</th>
                <th className="py-3 px-4">Participation</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {elections.map((el) => {
                const elCandidates = candidates.filter(
                  (c) => c.electionId === el.electionId
                );
                const elParticipation = votedParticipationRecords.filter(
                  (r) => r.electionId === el.electionId
                ).length;

                return (
                  <tr key={el.electionId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {el.electionId}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{el.title}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          el.electionType === ELECTION_TYPES.LOK_SABHA
                            ? 'bg-indigo-100 text-indigo-900'
                            : 'bg-teal-100 text-teal-900'
                        }`}
                      >
                        {el.electionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {el.electionType === ELECTION_TYPES.LOK_SABHA
                        ? 'Nationwide (All 36 States/UTs)'
                        : `State: ${el.stateId}`}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold ${
                          el.status === 'POLLING_ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : el.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {ELECTION_STATUS_LABELS[el.status] || el.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">
                      {el.pollingDate}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {elCandidates.length}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                      {elParticipation} Votes
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/eci/elections/${el.electionId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
