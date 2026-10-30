import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import {
  ELECTION_TYPES,
  PARTICIPATION_STATUS_STYLES,
} from '../../utils/constants';

export default function VotingHistory() {
  const {
    currentVoter,
    eligibleElections,
    getConstituencyForVoterElection,
    getElectionParticipationStatus,
  } = useVoter();

  const historyRecords = useMemo(() => {
    if (!currentVoter) return { lokSabha: [], stateAssembly: [] };

    const records = eligibleElections.map((election) => {
      const constituency = getConstituencyForVoterElection(election);
      const status = getElectionParticipationStatus(election);
      const voterEntry = currentVoter.elections?.[election.electionId];

      return {
        electionId: election.electionId,
        electionName: election.title,
        electionType: election.electionType,
        year: election.year,
        constituencyName: constituency?.name || 'Mapped Seat',
        constituencyCode: constituency?.code || 'N/A',
        participationStatus: status,
        participatedAt: voterEntry?.participatedAt || null,
        referenceId:
          voterEntry?.referenceId ||
          (voterEntry?.participated
            ? `DEMO-REF-${election.electionId}-${currentVoter.voterId}`
            : 'N/A (Not Participated)'),
      };
    });

    return {
      lokSabha: records.filter((r) => r.electionType === ELECTION_TYPES.LOK_SABHA),
      stateAssembly: records.filter(
        (r) => r.electionType === ELECTION_TYPES.STATE_ASSEMBLY
      ),
    };
  }, [
    currentVoter,
    eligibleElections,
    getConstituencyForVoterElection,
    getElectionParticipationStatus,
  ]);

  if (!currentVoter) return null;

  const renderRecordTable = (items, sectionLabel, badgeClass) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span
            className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${badgeClass}`}
          >
            {sectionLabel}
          </span>
          <h2 className="text-lg font-extrabold text-slate-900 mt-1">
            {sectionLabel} Participation Records ({items.length})
          </h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
              <th className="py-3.5 px-4">Election Name</th>
              <th className="py-3.5 px-4">Election Type</th>
              <th className="py-3.5 px-4">Year</th>
              <th className="py-3.5 px-4">Constituency</th>
              <th className="py-3.5 px-4">Participation Status</th>
              <th className="py-3.5 px-4">Participation Date</th>
              <th className="py-3.5 px-4">Demo Reference ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((row) => {
              const style =
                PARTICIPATION_STATUS_STYLES[row.participationStatus] ||
                PARTICIPATION_STATUS_STYLES.PENDING;
              return (
                <tr key={row.electionId} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {row.electionName}
                    <span className="block text-[11px] font-mono text-slate-400">
                      {row.electionId}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    {row.electionType === ELECTION_TYPES.LOK_SABHA
                      ? 'Lok Sabha (PC)'
                      : 'State Assembly (AC)'}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {row.year}
                  </td>
                  <td className="py-3.5 px-4 text-slate-800">
                    <strong>{row.constituencyName}</strong> ({row.constituencyCode})
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${style.bg} ${style.text} ${style.border}`}
                    >
                      {style.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {row.participatedAt
                      ? new Date(row.participatedAt).toLocaleString('en-IN')
                      : '—'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700">
                    {row.referenceId}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & Strict Ballot Secrecy Notice */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Cryptographic Secrecy &amp; Turnout Ledger
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              My Voting &amp; Participation History
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Separate Lok Sabha and State Legislative Assembly participation records for{' '}
              <strong>{currentVoter.fullName}</strong> (EPIC:{' '}
              <code className="font-mono font-bold">{currentVoter.voterRef}</code>).
            </p>
          </div>
          <Link
            to="/voter/elections"
            className="px-4 py-2.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold"
          >
            Back to My Elections &rarr;
          </Link>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-3">
          <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold uppercase text-[10px] shrink-0 mt-0.5">
            Secrecy Guarantee
          </span>
          <p className="leading-relaxed">
            In strict compliance with Rule 49M of the Conduct of Elections Rules, this
            participation history records <strong>only whether you participated</strong>,
            the timestamp, and a non-revealing participation reference ID. Your selected
            candidate, political party, or ballot choice is{' '}
            <strong>never stored or displayed</strong> in your voter profile.
          </p>
        </div>
      </div>

      {/* Separate Lok Sabha Participation Records */}
      {renderRecordTable(
        historyRecords.lokSabha,
        'Lok Sabha General Elections (Parliamentary)',
        'bg-indigo-100 text-indigo-900'
      )}

      {/* Separate State Assembly Participation Records */}
      {renderRecordTable(
        historyRecords.stateAssembly,
        'State Legislative Assembly Elections (Vidhan Sabha)',
        'bg-teal-100 text-teal-900'
      )}
    </div>
  );
}
