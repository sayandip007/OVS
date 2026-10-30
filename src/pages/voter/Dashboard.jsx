import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import VotingStatus from '../../components/voter/VotingStatus';
import ElectionCard from '../../components/voter/ElectionCard';
import { ELECTION_TYPES } from '../../utils/constants';
import { defaultAvatar } from '../../assets';

export default function VoterDashboard() {
  const navigate = useNavigate();
  const {
    currentVoter,
    voterState,
    voterDistrict,
    voterParliamentaryConstituency,
    voterAssemblyConstituency,
    eligibleElections,
    participationSummary,
  } = useVoter();
  const { candidates } = useElection();

  if (!currentVoter) {
    return null;
  }

  const handleParticipate = (election) => {
    navigate(`/voter/elections?electionId=${election.electionId}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Voter Identity & Dual Constituency Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src={currentVoter.avatar || defaultAvatar}
              alt={currentVoter.fullName}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#002868]"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-blue-100 text-[#002868] text-xs font-bold font-mono">
                  EPIC: {currentVoter.voterRef}
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">
                  Verified Elector
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
                {currentVoter.fullName}
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
              to="/voter/profile"
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800"
            >
              Manage Profile &amp; Jurisdiction
            </Link>
            <Link
              to="/voter/elections"
              className="px-4 py-2 rounded-lg bg-[#002868] hover:bg-blue-900 text-xs font-bold text-white shadow-xs"
            >
              Open Simultaneous Ballot Hub &rarr;
            </Link>
          </div>
        </div>

        {/* Independent Constituency Mapping Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-100">
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 block">
                Lok Sabha Jurisdiction (PARLIAMENTARY)
              </span>
              <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                {voterParliamentaryConstituency?.name ||
                  currentVoter.parliamentaryConstituencyId}{' '}
                PC
              </h2>
              <p className="text-xs text-slate-600">
                Code: {voterParliamentaryConstituency?.code || 'N/A'} • Reservation:{' '}
                {voterParliamentaryConstituency?.reservationType || 'GENERAL'}
              </p>
            </div>
            <Link
              to="/voter/constituencies"
              className="text-xs font-bold text-indigo-900 hover:underline shrink-0"
            >
              Details &rarr;
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">
                State Assembly Jurisdiction (ASSEMBLY)
              </span>
              <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                {voterAssemblyConstituency?.name || currentVoter.assemblyConstituencyId}{' '}
                AC
              </h2>
              <p className="text-xs text-slate-600">
                Code: {voterAssemblyConstituency?.code || 'N/A'} • Reservation:{' '}
                {voterAssemblyConstituency?.reservationType || 'GENERAL'}
              </p>
            </div>
            <Link
              to="/voter/constituencies"
              className="text-xs font-bold text-teal-900 hover:underline shrink-0"
            >
              Details &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Simultaneous Election Progress Bar (0/2, 1/2, 2/2 completed) */}
      <VotingStatus summary={participationSummary} />

      {/* Simultaneous Independent Election Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Your Eligible Elections ({eligibleElections.length})
            </h2>
            <p className="text-xs text-slate-600">
              Each election below uses its own independent ballot and constituency candidate
              list. Participating in one election does not complete the other.
            </p>
          </div>
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
                onParticipate={handleParticipate}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
