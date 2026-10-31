import React, { useState } from 'react';
import { useElection } from '../../context/ElectionContext';
import {
  ELECTION_TYPES,
  ELECTION_STATUS_LABELS,
  CONSTITUENCY_TYPES,
} from '../../utils/constants';
import { Activity, ShieldAlert, Lock } from 'lucide-react';

export default function ElectionMonitoring() {
  const {
    elections = [],
    states = [],
    constituencies = [],
    voters = [],
    participationRecords = [],
  } = useElection();

  const [selectedStateFilter, setSelectedStateFilter] = useState('ALL');

  const votedRecords = participationRecords.filter((r) => r.status === 'VOTED');

  const lokSabhaElections = elections.filter(
    (e) => e.electionType === ELECTION_TYPES.LOK_SABHA
  );
  const assemblyElections = elections.filter(
    (e) => e.electionType === ELECTION_TYPES.STATE_ASSEMBLY
  );

  const lsVotedRecords = votedRecords.filter(
    (r) => r.electionType === ELECTION_TYPES.LOK_SABHA
  );
  const saVotedRecords = votedRecords.filter(
    (r) => r.electionType === ELECTION_TYPES.STATE_ASSEMBLY
  );

  const lsTurnoutPct =
    voters.length > 0
      ? Math.round((lsVotedRecords.length / voters.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Aggregate Turnout &amp; Constituency Monitoring
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              Simultaneous Election Participation Monitoring
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Monitor aggregate participation counts and percentages separately for Lok Sabha General Elections and State Legislative Assembly Elections.
            </p>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Simulated Demo Telemetry:</strong> Aggregate participation only. Individual ballot choices are never exposed.
            </span>
          </div>
        </div>
      </div>

      {/* Dual Lok Sabha vs State Assembly Aggregate Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Lok Sabha Monitoring */}
        <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[11px] font-extrabold">
                LOK_SABHA (PARLIAMENTARY PC)
              </span>
              <h2 className="text-lg font-extrabold text-slate-900 mt-1">
                Lok Sabha General Election Monitoring
              </h2>
            </div>
            <Activity className="w-6 h-6 text-indigo-700" />
          </div>

          {lokSabhaElections.map((el) => {
            const count = lsVotedRecords.filter(
              (r) => r.electionId === el.electionId
            ).length;
            const pct =
              voters.length > 0 ? Math.round((count / voters.length) * 100) : 0;

            return (
              <div
                key={el.electionId}
                className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-indigo-950">
                    {el.title} ({el.electionId})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white text-indigo-900 font-bold text-[10px] border border-indigo-200">
                    {ELECTION_STATUS_LABELS[el.status] || el.status}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-indigo-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-700 rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-indigo-900 font-semibold">
                  <span>
                    Simulated Votes Recorded: <strong>{count}</strong> /{' '}
                    {voters.length} Demo Voters
                  </span>
                  <span className="font-mono font-bold">{pct}% Turnout</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel 2: State Assembly Monitoring */}
        <div className="bg-white rounded-2xl border border-teal-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="px-2.5 py-0.5 rounded bg-teal-100 text-teal-900 text-[11px] font-extrabold">
                STATE_ASSEMBLY (VIDHAN SABHA AC)
              </span>
              <h2 className="text-lg font-extrabold text-slate-900 mt-1">
                State Legislative Assembly Monitoring
              </h2>
            </div>
            <Activity className="w-6 h-6 text-teal-700" />
          </div>

          {assemblyElections.map((el) => {
            const stateVoters = voters.filter((v) => v.stateId === el.stateId);
            const count = saVotedRecords.filter(
              (r) => r.electionId === el.electionId
            ).length;
            const pct =
              stateVoters.length > 0
                ? Math.round((count / stateVoters.length) * 100)
                : 0;

            return (
              <div
                key={el.electionId}
                className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-teal-950">
                    {el.title} ({el.stateId})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white text-teal-900 font-bold text-[10px] border border-teal-200">
                    {ELECTION_STATUS_LABELS[el.status] || el.status}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-teal-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-700 rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-teal-900 font-semibold">
                  <span>
                    Simulated Votes Recorded: <strong>{count}</strong> /{' '}
                    {stateVoters.length} State Voters
                  </span>
                  <span className="font-mono font-bold">{pct}% Turnout</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Constituency-Level Aggregate Participation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              State &amp; Constituency Aggregate Participation Breakdown
            </h2>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Lock className="w-3.5 h-3.5 text-emerald-700" />
              Displays aggregate participation counts only; individual voter preferences are never stored here.
            </p>
          </div>

          <select
            value={selectedStateFilter}
            onChange={(e) => setSelectedStateFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All States with Demo Voters</option>
            {states.map((st) => (
              <option key={st.stateId} value={st.stateId}>
                {st.stateName} ({st.stateId})
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-4">Constituency</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Registered Demo Voters</th>
                <th className="py-3 px-4">Simulated Votes Cast</th>
                <th className="py-3 px-4">Turnout %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {constituencies
                .filter((c) => {
                  if (
                    selectedStateFilter !== 'ALL' &&
                    c.stateId !== selectedStateFilter
                  ) {
                    return false;
                  }
                  const hasVoters = voters.some(
                    (v) =>
                      v.parliamentaryConstituencyId === c.constituencyId ||
                      v.assemblyConstituencyId === c.constituencyId
                  );
                  const hasVotes = votedRecords.some(
                    (r) => r.constituencyId === c.constituencyId
                  );
                  return hasVoters || hasVotes || c.stateId === 'WB';
                })
                .map((c) => {
                  const seatVoters = voters.filter((v) =>
                    c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
                      ? v.parliamentaryConstituencyId === c.constituencyId
                      : v.assemblyConstituencyId === c.constituencyId
                  );
                  const seatVotes = votedRecords.filter(
                    (r) => r.constituencyId === c.constituencyId
                  );
                  const pct =
                    seatVoters.length > 0
                      ? Math.round((seatVotes.length / seatVoters.length) * 100)
                      : 0;

                  return (
                    <tr key={c.constituencyId} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{c.name}</p>
                        <span className="font-mono text-[11px] text-slate-500">
                          {c.constituencyId}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
                              ? 'bg-indigo-100 text-indigo-900'
                              : 'bg-teal-100 text-teal-900'
                          }`}
                        >
                          {c.constituencyType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold">{c.stateId}</td>
                      <td className="py-3 px-4 font-mono">{seatVoters.length}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                        {seatVotes.length}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {pct}%
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
