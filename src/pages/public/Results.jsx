import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import {
  ELECTION_TYPES,
  ELECTION_STATUS_LABELS,
  CONSTITUENCY_TYPES,
} from '../../utils/constants';
import { notaImg, notaLogo } from '../../assets';

export default function Results() {
  const [searchParams] = useSearchParams();
  const initialElectionId = searchParams.get('electionId') || 'LS-2029';

  const { elections, states, constituencies, candidates, parties, tallies } =
    useElection();

  const [selectedElectionId, setSelectedElectionId] = useState(initialElectionId);
  const [selectedConstituencyId, setSelectedConstituencyId] = useState('ALL');

  const selectedElection = useMemo(
    () =>
      elections.find((e) => e.electionId === selectedElectionId) || elections[0],
    [elections, selectedElectionId]
  );

  const applicableConstituencies = useMemo(() => {
    if (!selectedElection) return [];
    const isLS = selectedElection.electionType === ELECTION_TYPES.LOK_SABHA;
    return constituencies.filter((c) => {
      if (isLS) {
        return c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY;
      }
      return (
        c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY &&
        c.stateId === selectedElection.stateId
      );
    });
  }, [constituencies, selectedElection]);

  // Filter constituencies that have either registered candidates or tallies
  const activeResultConstituencies = useMemo(() => {
    if (selectedConstituencyId !== 'ALL') {
      return applicableConstituencies.filter(
        (c) => c.constituencyId === selectedConstituencyId
      );
    }
    const withData = applicableConstituencies.filter((c) => {
      const hasCands = candidates.some(
        (cand) =>
          cand.electionId === selectedElection?.electionId &&
          cand.constituencyId === c.constituencyId
      );
      const hasTallies =
        tallies?.[selectedElection?.electionId]?.[c.constituencyId] !== undefined;
      return hasCands || hasTallies;
    });
    return withData.length > 0 ? withData : applicableConstituencies.slice(0, 6);
  }, [
    applicableConstituencies,
    selectedConstituencyId,
    candidates,
    tallies,
    selectedElection,
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        badge="ECI Result & Tally Center"
        title="Election Results & Constituency Tallies"
        subtitle="Inspect constituency-wise candidate tallies, vote share percentages, leading/winning candidates, and NOTA counts across Lok Sabha and State Assembly elections."
      />

      {/* Election & Constituency Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            1. Select Election (Lok Sabha or State Assembly)
          </label>
          <select
            value={selectedElection?.electionId || ''}
            onChange={(e) => {
              setSelectedElectionId(e.target.value);
              setSelectedConstituencyId('ALL');
            }}
            className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#002868]"
          >
            {elections.map((el) => (
              <option key={el.electionId} value={el.electionId}>
                {el.title} ({ELECTION_STATUS_LABELS[el.status] || el.status})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            2. Filter by Constituency ({applicableConstituencies.length} Available)
          </label>
          <select
            value={selectedConstituencyId}
            onChange={(e) => setSelectedConstituencyId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#002868]"
          >
            <option value="ALL">All Constituencies with Contesting Candidates</option>
            {applicableConstituencies.map((c) => (
              <option key={c.constituencyId} value={c.constituencyId}>
                {c.name} ({c.code}) — {c.stateId}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Election Summary Banner */}
      {selectedElection && (
        <div className="bg-[#002868] text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-white/15 text-amber-300 text-xs font-bold uppercase">
                {selectedElection.electionType === ELECTION_TYPES.LOK_SABHA
                  ? 'Lok Sabha General Election (PARLIAMENTARY)'
                  : `State Assembly Election (${selectedElection.stateId})`}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-xs font-semibold">
                {ELECTION_STATUS_LABELS[selectedElection.status]}
              </span>
            </div>
            <h2 className="text-xl font-bold mt-1.5">{selectedElection.title}</h2>
          </div>
          <div className="text-xs text-blue-100 text-right">
            <p>Polling Date: {selectedElection.pollingDate}</p>
            <p>Result Date: {selectedElection.resultDate || 'Live Demo Tally'}</p>
          </div>
        </div>
      )}

      {/* Constituency Result Breakdown Cards */}
      {activeResultConstituencies.length === 0 ? (
        <EmptyState
          title="No Constituency Tallies Available"
          description="Select another election or constituency to inspect candidate vote shares."
        />
      ) : (
        <div className="space-y-6">
          {activeResultConstituencies.map((constituency) => {
            const seatCandidates = candidates.filter(
              (c) =>
                c.electionId === selectedElection.electionId &&
                c.constituencyId === constituency.constituencyId
            );
            const seatTallies =
              tallies?.[selectedElection.electionId]?.[
                constituency.constituencyId
              ] || {};

            const rows = [
              ...seatCandidates.map((cand) => {
                const party = parties.find((p) => p.partyId === cand.partyId);
                const votes = Number(seatTallies[cand.candidateId] || 0);
                return {
                  id: cand.candidateId,
                  name: cand.name,
                  partyName: party?.partyName || 'Independent',
                  partyAbbr: party?.abbreviation || 'IND',
                  photoUrl: cand.photoUrl,
                  symbolUrl: party?.symbolUrl,
                  votes,
                  isNota: false,
                };
              }),
              {
                id: 'NOTA',
                name: 'NOTA (None of the Above)',
                partyName: 'Election Commission Option',
                partyAbbr: 'NOTA',
                photoUrl: notaImg,
                symbolUrl: notaLogo,
                votes: Number(seatTallies.NOTA || 0),
                isNota: true,
              },
            ].sort((a, b) => b.votes - a.votes);

            const totalVotes = rows.reduce((acc, r) => acc + r.votes, 0);
            const leader = rows[0];
            const runnerUp = rows[1];
            const margin =
              leader && runnerUp ? Math.max(0, leader.votes - runnerUp.votes) : 0;
            const stateObj = states.find((s) => s.stateId === constituency.stateId);

            return (
              <div
                key={constituency.constituencyId}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
              >
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-xs font-bold">
                        {constituency.constituencyType}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        {stateObj?.stateName} ({constituency.stateId}) • Code:{' '}
                        {constituency.code}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {constituency.name} Constituency
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="bg-white px-3.5 py-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block">Total Votes Polled</span>
                      <strong className="text-base text-slate-900">
                        {totalVotes.toLocaleString('en-IN')}
                      </strong>
                    </div>
                    {leader && leader.votes > 0 && (
                      <div className="bg-emerald-50 px-3.5 py-2 rounded-lg border border-emerald-200">
                        <span className="text-emerald-700 block font-semibold">
                          {selectedElection.status === 'RESULTS_DECLARED'
                            ? 'Winner'
                            : 'Leading Candidate'}
                        </span>
                        <strong className="text-sm text-emerald-950">
                          {leader.name} (+{margin.toLocaleString('en-IN')})
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Candidate Rows */}
                <div className="divide-y divide-slate-100">
                  {rows.map((row, idx) => {
                    const pct =
                      totalVotes > 0
                        ? ((row.votes / totalVotes) * 100).toFixed(2)
                        : '0.00';
                    const isTop = idx === 0 && row.votes > 0;

                    return (
                      <div
                        key={row.id}
                        className={`px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isTop ? 'bg-emerald-50/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="w-6 text-xs font-bold text-slate-400">
                            #{idx + 1}
                          </span>
                          <img
                            src={row.photoUrl}
                            alt={row.name}
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-white"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {row.name}
                              </span>
                              {isTop && (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                                  {selectedElection.status === 'RESULTS_DECLARED'
                                    ? 'Elected'
                                    : 'Leading'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                              {row.symbolUrl && (
                                <img
                                  src={row.symbolUrl}
                                  alt={row.partyAbbr}
                                  className="w-4 h-4 object-contain"
                                />
                              )}
                              <span>
                                {row.partyName} ({row.partyAbbr})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="sm:w-64 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900">
                              {row.votes.toLocaleString('en-IN')} votes
                            </span>
                            <span className="font-semibold text-slate-600">
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.isNota
                                  ? 'bg-slate-500'
                                  : isTop
                                  ? 'bg-emerald-600'
                                  : 'bg-[#002868]'
                              }`}
                              style={{ width: `${Math.min(100, Number(pct))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
