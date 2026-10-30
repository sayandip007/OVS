import React from 'react';
import { Link } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import ConstituencyCard from '../../components/voter/ConstituencyCard';
import CandidateCard from '../../components/voter/CandidateCard';

export default function ConstituencyDetails() {
  const {
    currentVoter,
    voterState,
    voterDistrict,
    voterParliamentaryConstituency,
    voterAssemblyConstituency,
  } = useVoter();
  const { candidates, parties } = useElection();

  if (!currentVoter) return null;

  const pcCandidates = candidates.filter(
    (c) =>
      c.constituencyId === voterParliamentaryConstituency?.constituencyId &&
      c.approvalStatus === 'APPROVED'
  );

  const acCandidates = candidates.filter(
    (c) =>
      c.constituencyId === voterAssemblyConstituency?.constituencyId &&
      c.approvalStatus === 'APPROVED'
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Geographical Electoral Hierarchy
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Your Parliamentary (PC) &amp; Assembly (AC) Constituencies
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            State: <strong>{voterState?.stateName}</strong> • District:{' '}
            <strong>{voterDistrict?.districtName}</strong>
          </p>
        </div>
        <Link
          to="/voter/elections"
          className="px-4 py-2.5 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-xl"
        >
          Proceed to Ballot Unit &rarr;
        </Link>
      </div>

      {/* Dual Constituency Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ConstituencyCard
          constituency={voterParliamentaryConstituency}
          stateName={voterState?.stateName}
          districtName={voterDistrict?.districtName}
          parentParliamentaryName={null}
        />
        <ConstituencyCard
          constituency={voterAssemblyConstituency}
          stateName={voterState?.stateName}
          districtName={voterDistrict?.districtName}
          parentParliamentaryName={voterParliamentaryConstituency?.name}
        />
      </div>

      {/* Candidates in Voter's Parliamentary Constituency */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-indigo-800">
              Lok Sabha General Election (PARLIAMENTARY)
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Candidates in {voterParliamentaryConstituency?.name} PC (
              {pcCandidates.length})
            </h2>
          </div>
          <Link
            to="/voter/elections?electionId=LS-2029"
            className="text-xs font-bold text-indigo-900 hover:underline"
          >
            Open Lok Sabha Ballot &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pcCandidates.map((cand) => (
            <CandidateCard
              key={cand.candidateId}
              candidate={cand}
              party={parties.find((p) => p.partyId === cand.partyId)}
              constituency={voterParliamentaryConstituency}
              showSelectButton={false}
            />
          ))}
        </div>
      </div>

      {/* Candidates in Voter's Assembly Constituency */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-teal-800">
              State Legislative Assembly Election (ASSEMBLY)
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Candidates in {voterAssemblyConstituency?.name} AC ({acCandidates.length})
            </h2>
          </div>
          <Link
            to="/voter/elections"
            className="text-xs font-bold text-teal-900 hover:underline"
          >
            Open State Assembly Ballot &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {acCandidates.map((cand) => (
            <CandidateCard
              key={cand.candidateId}
              candidate={cand}
              party={parties.find((p) => p.partyId === cand.partyId)}
              constituency={voterAssemblyConstituency}
              showSelectButton={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
