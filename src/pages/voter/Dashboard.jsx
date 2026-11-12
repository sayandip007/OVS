import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { frontendEnv } from '../../config/env';
import { apiClient } from '../../services/apiClient';
import VotingStatus from '../../components/voter/VotingStatus';
import ElectionCard from '../../components/voter/ElectionCard';
import { ELECTION_TYPES, NOTIFICATION_TYPE_LABELS } from '../../utils/constants';
import { defaultAvatar } from '../../assets';

function BackendVoterDashboard() {
  const { notifyError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const loadDiscovery = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.voter.listElections();
      setData(res?.data || null);
    } catch (err) {
      notifyError(err?.message || 'Failed to load demo elections.');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadDiscovery();
  }, [loadDiscovery]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Loading your eligible demo elections...
      </div>
    );
  }

  const voter = data?.voter;
  const elections = data?.elections || [];
  const lokSabhaElections = elections.filter((e) => e.type === 'LOK_SABHA');
  const assemblyElections = elections.filter((e) => e.type === 'STATE_ASSEMBLY');

  const renderElectionSection = (title, items, badgeClass) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${badgeClass}`}>
            {title}
          </span>
          <h2 className="text-lg font-extrabold text-slate-900 mt-1">
            {title} ({items.length})
          </h2>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No demo elections available in this category.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((el) => (
            <div
              key={el.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-sm text-slate-900">{el.name}</p>
                  <p className="text-slate-600">
                    Constituency:{' '}
                    <strong>{el.constituency?.name || el.constituency?.id || 'Not Mapped'}</strong>
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-[11px]">
                  {el.status}
                </span>
              </div>

              {el.pollingWindow?.startAt && el.pollingWindow?.endAt && (
                <p className="text-slate-600">
                  Polling Window ({el.scheduleTimezone || 'Asia/Kolkata'}):{' '}
                  {new Date(el.pollingWindow.startAt).toLocaleString()} –{' '}
                  {new Date(el.pollingWindow.endAt).toLocaleString()}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                {el.hasParticipated ? (
                  <>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      PARTICIPATED • {el.participation?.demoReference}
                    </span>
                    <Link
                      to={`/voter/elections/${el.id}/receipt`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold"
                    >
                      View Confirmation
                    </Link>
                  </>
                ) : el.eligible ? (
                  <>
                    <span className="text-emerald-700 font-bold">
                      Eligible ({el.approvedCandidatesCount} approved candidates)
                    </span>
                    <Link
                      to={`/voter/elections/${el.id}/ballot`}
                      className="px-3.5 py-1.5 rounded-lg bg-[#002868] text-white font-bold"
                    >
                      Open Demo Ballot
                    </Link>
                  </>
                ) : (
                  <span className="text-amber-800 font-semibold">
                    {el.ineligibilityReason || el.ineligibilityCode || 'Not currently open'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-blue-100 text-[#002868] text-xs font-bold font-mono">
              EPIC: {voter?.epicNumber}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
              Namaste, {voter?.fullName}
            </h1>
            <p className="text-xs text-slate-600">
              State: <strong>{voter?.stateName}</strong> • District:{' '}
              <strong>{voter?.districtName}</strong> • PC:{' '}
              <strong>{voter?.parliamentaryConstituency?.name}</strong> • AC:{' '}
              <strong>{voter?.assemblyConstituency?.name}</strong>
            </p>
          </div>
          <Link
            to="/voter/history"
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold"
          >
            Participation History
          </Link>
        </div>
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Educational Demo Simulation: Lok Sabha (PC) and State Assembly (AC) elections operate
          independently. Candidate choices stay strictly in temporary browser memory and are never
          sent to the server.
        </p>
      </div>

      {renderElectionSection(
        'Lok Sabha (Parliamentary Constituency)',
        lokSabhaElections,
        'bg-blue-100 text-[#002868]'
      )}
      {renderElectionSection(
        'State Legislative Assembly (Assembly Constituency)',
        assemblyElections,
        'bg-indigo-100 text-indigo-900'
      )}
    </div>
  );
}

export default function VoterDashboard() {
  if (frontendEnv.isBackendApiMode) {
    return <BackendVoterDashboard />;
  }
  return <LocalDemoVoterDashboard />;
}

function LocalDemoVoterDashboard() {
  const navigate = useNavigate();
  const {
    currentVoter,
    voterState,
    voterDistrict,
    voterParliamentaryConstituency,
    voterAssemblyConstituency,
    eligibleElections,
    participationSummary,
    profileCompletion,
    notifications,
    unreadNotificationCount,
    recentCandidates,
    simulateParticipationForCurrentVoter,
  } = useVoter();
  const { candidates, parties, constituencies } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  if (!currentVoter) {
    return null;
  }

  const formattedCurrentDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const handleOpenElectionDetails = (election) => {
    const elId = election.id || election.electionId;
    navigate(`/voter/elections/${elId}/info`);
  };

  const handleSimulateParticipation = (election) => {
    const res = simulateParticipationForCurrentVoter(election.electionId);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Demo participation status marked as VOTED for ${election.title} (Ref: ${res.referenceId}). Other elections remain independent.`
    );
  };

  const recentNotifications = notifications.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header: Greeting, Current Date, Profile Completion, Demo Status, Notification Access */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <img
              src={currentVoter.avatar || defaultAvatar}
              alt={currentVoter.fullName}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#002868] shrink-0"
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-blue-100 text-[#002868] text-xs font-bold font-mono">
                  EPIC: {currentVoter.voterRef}
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">
                  {currentVoter.accountStatus || 'VERIFIED_DEMO'} Account
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  • {formattedCurrentDate}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Namaste, {currentVoter.fullName}
              </h1>
              <p className="text-xs text-slate-600">
                State: <strong>{voterState?.stateName || currentVoter.stateId}</strong> •
                District:{' '}
                <strong>{voterDistrict?.districtName || currentVoter.districtId}</strong>{' '}
                • Mobile: +91-{currentVoter.mobile}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/voter/notifications"
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center gap-2"
            >
              <span>Notifications</span>
              {unreadNotificationCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-[#FF9933] text-slate-950 text-[11px] font-extrabold">
                  {unreadNotificationCount} New
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">
                  All Read
                </span>
              )}
            </Link>
            <Link
              to="/voter/profile"
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800"
            >
              Manage Profile ({profileCompletion.percentage}%)
            </Link>
            <Link
              to="/voter/elections"
              className="px-4 py-2 rounded-xl bg-[#002868] hover:bg-blue-900 text-xs font-bold text-white shadow-xs"
            >
              My Eligible Elections &rarr;
            </Link>
          </div>
        </div>

        {/* Profile Completion Reminder Banner if < 100% */}
        {profileCompletion.percentage < 100 && (
          <div className="mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-amber-950">
              <strong>Profile Completion Reminder ({profileCompletion.percentage}%):</strong>{' '}
              Complete missing fields ({profileCompletion.missingFields.join(', ')}) to reach
              100% electoral profile readiness.
            </div>
            <Link
              to="/voter/profile"
              className="px-3 py-1.5 rounded-lg bg-amber-900 text-white text-xs font-bold hover:bg-amber-950"
            >
              Complete Profile &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* 2. Five Dynamic Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Eligible Elections
          </span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {participationSummary.totalEligible}
          </p>
          <span className="text-[11px] text-slate-500">
            Lok Sabha &amp; State Assembly
          </span>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
            Upcoming Elections
          </span>
          <p className="text-2xl font-extrabold text-blue-900 mt-1">
            {participationSummary.upcomingCount}
          </p>
          <span className="text-[11px] text-blue-700">Scheduled Poll Dates</span>
        </div>

        <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 block">
            Active Elections
          </span>
          <p className="text-2xl font-extrabold text-indigo-950 mt-1">
            {participationSummary.activeCount}
          </p>
          <span className="text-[11px] text-indigo-700">Currently Open Polls</span>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
            Completed Participation
          </span>
          <p className="text-2xl font-extrabold text-emerald-800 mt-1">
            {participationSummary.completedCount}
          </p>
          <span className="text-[11px] text-emerald-700">Marked VOTED</span>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
            Pending Participation
          </span>
          <p className="text-2xl font-extrabold text-amber-900 mt-1">
            {participationSummary.pendingCount}
          </p>
          <span className="text-[11px] text-amber-800">Action Required</span>
        </div>
      </div>

      {/* 3. Simultaneous Election Progress Tracker (0/2, 1/2, 2/2 completed) */}
      <VotingStatus summary={participationSummary} />

      {/* 4. Independent Election Overview Cards (Lok Sabha & State Assembly) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Independent Election Overview ({eligibleElections.length})
            </h2>
            <p className="text-xs text-slate-600">
              Separate cards for Lok Sabha General Elections and State Legislative Assembly
              Elections. Participating in one election never marks the other as completed.
            </p>
          </div>
          <Link
            to="/voter/elections"
            className="text-xs font-bold text-[#002868] hover:underline"
          >
            View All Elections &amp; Filters &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {eligibleElections.map((election) => {
            const isLS = election.electionType === ELECTION_TYPES.LOK_SABHA;
            const targetConstituency = isLS
              ? voterParliamentaryConstituency
              : voterAssemblyConstituency;
            const participationItem = participationSummary.items.find(
              (item) => item.electionId === election.electionId
            );
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
                participationStatus={participationItem?.status || 'PENDING'}
                participatedAt={participationItem?.participatedAt}
                candidateCount={candidateCount}
                onParticipate={handleOpenElectionDetails}
                onSimulateStatus={handleSimulateParticipation}
              />
            );
          })}
        </div>
      </div>

      {/* 5. Constituency Summary Cards (Parliamentary & Assembly) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Your Dual Constituency Summary
            </h2>
            <p className="text-xs text-slate-600">
              Every Indian elector is mapped to both a Parliamentary Constituency (MP) and an
              Assembly Constituency (MLA).
            </p>
          </div>
          <Link
            to="/voter/constituencies"
            className="text-xs font-bold text-[#002868] hover:underline"
          >
            Inspect Full Constituency Details &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 block">
                Parliamentary Constituency (Lok Sabha)
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {voterParliamentaryConstituency?.name ||
                  currentVoter.parliamentaryConstituencyId}{' '}
                PC
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Code: <strong>{voterParliamentaryConstituency?.code || 'N/A'}</strong> •
                Reservation:{' '}
                <strong>
                  {voterParliamentaryConstituency?.reservationType || 'GENERAL'}
                </strong>{' '}
                • Electors:{' '}
                {(voterParliamentaryConstituency?.electorCount || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <Link
              to="/voter/constituencies"
              className="px-3 py-1.5 rounded-lg bg-indigo-900 text-white text-xs font-bold shrink-0 hover:bg-indigo-950"
            >
              PC Info &rarr;
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">
                Assembly Constituency (Vidhan Sabha)
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {voterAssemblyConstituency?.name || currentVoter.assemblyConstituencyId} AC
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Code: <strong>{voterAssemblyConstituency?.code || 'N/A'}</strong> •
                Reservation:{' '}
                <strong>{voterAssemblyConstituency?.reservationType || 'GENERAL'}</strong> •
                Parent PC: <strong>{voterParliamentaryConstituency?.name || 'N/A'}</strong>
              </p>
            </div>
            <Link
              to="/voter/constituencies"
              className="px-3 py-1.5 rounded-lg bg-teal-900 text-white text-xs font-bold shrink-0 hover:bg-teal-950"
            >
              AC Info &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* 6. Timeline & Important Election Dates + Recent Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Election Timeline & Important Dates */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#002868]">
                ECI Statutory Gazette Calendar
              </span>
              <h2 className="text-base font-extrabold text-slate-900">
                Upcoming Election Timeline &amp; Important Dates
              </h2>
            </div>
            <Link
              to="/voter/election-info"
              className="text-xs font-bold text-[#002868] hover:underline"
            >
              Full Calendar &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {eligibleElections.map((el) => (
              <div
                key={el.electionId}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-900">
                    {el.title}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-[#002868] text-[10px] font-mono font-bold">
                    {el.electionId}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded border border-slate-200/80">
                    <span className="text-slate-400 block">Gazette Notice</span>
                    <strong className="text-slate-800">
                      {el.schedule?.gazetteNotification || 'TBA'}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200/80">
                    <span className="text-slate-400 block">Nomination Close</span>
                    <strong className="text-slate-800">
                      {el.schedule?.nominationClose || 'TBA'}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200/80">
                    <span className="text-slate-400 block">Polling Window</span>
                    <strong className="text-emerald-800">
                      {el.schedule?.pollingDate || 'TBA'}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200/80">
                    <span className="text-slate-400 block">Counting Day</span>
                    <strong className="text-indigo-900">
                      {el.schedule?.countingDate || 'TBA'}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Announcements & Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#002868]">
                Official ECI Advisories
              </span>
              <h2 className="text-base font-extrabold text-slate-900">
                Recent Announcements &amp; Alerts
              </h2>
            </div>
            <Link
              to="/voter/notifications"
              className="text-xs font-bold text-[#002868] hover:underline"
            >
              Open Notification Centre &rarr;
            </Link>
          </div>

          {recentNotifications.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No recent election notifications.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recentNotifications.map((item) => (
                <Link
                  key={item.notificationId}
                  to="/voter/notifications"
                  className={`block p-3 rounded-xl border transition-colors ${
                    item.isRead
                      ? 'bg-white border-slate-200 hover:bg-slate-50'
                      : 'bg-blue-50/60 border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#002868]">
                      {NOTIFICATION_TYPE_LABELS[item.type] || item.type}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 mt-0.5">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                    {item.message}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7. Recently Viewed Candidate Information & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#002868]">
                Affidavit &amp; Manifesto Explorer
              </span>
              <h2 className="text-base font-extrabold text-slate-900">
                Recently Viewed Candidate Information
              </h2>
            </div>
            <Link
              to="/voter/candidates"
              className="text-xs font-bold text-[#002868] hover:underline"
            >
              Browse Candidate Directory &rarr;
            </Link>
          </div>

          {recentCandidates.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                You have not inspected any individual candidate affidavits in this session yet.
                Explore nominated candidates in your Parliamentary and Assembly constituencies.
              </p>
              <Link
                to="/voter/candidates"
                className="px-3.5 py-2 rounded-lg bg-[#002868] text-white text-xs font-bold shrink-0"
              >
                Explore Candidates &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentCandidates.slice(0, 4).map((cand) => {
                const party = parties.find((p) => p.partyId === cand.partyId);
                const constObj = constituencies.find(
                  (c) => c.constituencyId === cand.constituencyId
                );
                return (
                  <Link
                    key={cand.candidateId}
                    to={`/voter/candidates?electionId=${cand.electionId}`}
                    className="p-3 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50/60 flex items-center gap-3"
                  >
                    <img
                      src={cand.photoUrl}
                      alt={cand.name}
                      className="w-11 h-11 rounded-lg object-cover border border-slate-300 shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 truncate">
                        {cand.name}
                      </h3>
                      <p className="text-[11px] text-slate-600 truncate">
                        {party?.abbreviation || 'IND'} • {constObj?.name || cand.constituencyId}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Links Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#002868]">
            Shortcuts
          </span>
          <h2 className="text-base font-extrabold text-slate-900">
            Voter Portal Quick Links
          </h2>
          <div className="grid grid-cols-1 gap-2 pt-1 text-xs font-bold">
            <Link
              to="/voter/profile"
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-[#002868] border border-slate-200 flex items-center justify-between"
            >
              <span>Update Personal &amp; Address Info</span>
              <span>&rarr;</span>
            </Link>
            <Link
              to="/voter/constituencies"
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-[#002868] border border-slate-200 flex items-center justify-between"
            >
              <span>Inspect PC &amp; AC Jurisdictions</span>
              <span>&rarr;</span>
            </Link>
            <Link
              to="/voter/history"
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-[#002868] border border-slate-200 flex items-center justify-between"
            >
              <span>View Non-Revealing Participation History</span>
              <span>&rarr;</span>
            </Link>
            <Link
              to="/voter/settings"
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-[#002868] border border-slate-200 flex items-center justify-between"
            >
              <span>Demo Account Switcher &amp; Settings</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
