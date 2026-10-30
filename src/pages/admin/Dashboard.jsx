import React from 'react';
import { Link } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import StatsCard from '../../components/admin/StatsCard';
import { CONSTITUENCY_TYPES, ELECTION_TYPES, ELECTION_STATUS_LABELS } from '../../utils/constants';

export default function AdminDashboard() {
  const {
    states,
    districts,
    constituencies,
    elections,
    parties,
    candidates,
    voters,
    resetDemoData,
  } = useElection();
  const { notifyInfo } = useNotification();

  const totalStates = states.filter((s) => s.type === 'STATE').length;
  const totalUTs = states.filter((s) => s.type === 'UT').length;
  const totalPCs = constituencies.filter(
    (c) => c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
  ).length;
  const totalACs = constituencies.filter(
    (c) => c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY
  ).length;
  const activeElections = elections.filter((e) => e.status === 'POLLING_ACTIVE');

  const handleResetDemo = () => {
    resetDemoData();
    notifyInfo(
      'All elections, constituencies, candidates, parties, and voter participation records have been reset to clean initial demo state.'
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Election Commission of India • Master Control
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            National &amp; State Election Operations Overview
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Manage Lok Sabha General Elections, State Legislative Assembly Elections,
            all 36 States/UTs, Constituencies, Political Parties, and Contesting Candidates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/eci/elections"
            className="px-4 py-2.5 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-xl"
          >
            + Configure Election
          </Link>
          <Link
            to="/eci/candidates"
            className="px-4 py-2.5 bg-[#FF9933] hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl"
          >
            + Nominate Candidate
          </Link>
          <button
            type="button"
            onClick={handleResetDemo}
            className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-xs font-bold rounded-xl cursor-pointer"
          >
            Reset All Demo Data
          </button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="States & Union Territories"
          value={states.length}
          subtitle={`${totalStates} States + ${totalUTs} Union Territories`}
          badge="100% India Coverage"
          accent="blue"
        />
        <StatsCard
          title="Sample Districts"
          value={districts.length}
          subtitle="Minimum 2 districts per State/UT"
          badge="Geographical Hierarchy"
          accent="slate"
        />
        <StatsCard
          title="Parliamentary Seats (PC)"
          value={totalPCs}
          subtitle="Lok Sabha Constituencies"
          badge="PARLIAMENTARY"
          accent="indigo"
        />
        <StatsCard
          title="Assembly Seats (AC)"
          value={totalACs}
          subtitle="State Vidhan Sabha Constituencies"
          badge="ASSEMBLY"
          accent="teal"
        />
        <StatsCard
          title="Configured Elections"
          value={elections.length}
          subtitle={`${activeElections.length} Currently Polling Active`}
          badge="Lok Sabha & Assembly"
          accent="emerald"
        />
        <StatsCard
          title="Political Parties"
          value={parties.length}
          subtitle={`${parties.filter((p) => p.status === 'ACTIVE').length} Active Parties`}
          badge="National & State"
          accent="amber"
        />
        <StatsCard
          title="Contesting Candidates"
          value={candidates.length}
          subtitle="Scoped by Election & Constituency"
          badge="Nominations"
          accent="blue"
        />
        <StatsCard
          title="Registered Demo Voters"
          value={voters.length}
          subtitle="Mapped to independent PC & AC"
          badge="Electoral Roll"
          accent="emerald"
        />
      </div>

      {/* Active & Configured Elections Quick Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Configured Elections &amp; Simultaneous Polling Status
            </h2>
            <p className="text-xs text-slate-500">
              Manage lifecycle status from Draft to Polling Active and Results Declared.
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
                <th className="py-3 px-4">Jurisdiction</th>
                <th className="py-3 px-4">Polling Date</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {elections.map((el) => (
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
                  <td className="py-3 px-4 text-slate-700">{el.pollingDate}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {ELECTION_STATUS_LABELS[el.status] || el.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
