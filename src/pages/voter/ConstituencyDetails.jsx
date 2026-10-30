import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import ConstituencyCard from '../../components/voter/ConstituencyCard';
import CandidateCard from '../../components/voter/CandidateCard';
import SearchBar from '../../components/common/SearchBar';
import { ELECTION_TYPES } from '../../utils/constants';

export default function ConstituencyDetails() {
  const {
    currentVoter,
    voterState,
    voterDistrict,
    voterParliamentaryConstituency,
    voterAssemblyConstituency,
  } = useVoter();
  const { elections, districts, candidates, parties } = useElection();

  const [candidateSearch, setCandidateSearch] = useState('');

  const stateDistricts = useMemo(
    () => districts.filter((d) => d.stateId === currentVoter?.stateId),
    [districts, currentVoter?.stateId]
  );

  const pcAssociatedElections = useMemo(
    () =>
      elections.filter(
        (e) =>
          e.electionType === ELECTION_TYPES.LOK_SABHA &&
          (e.constituencyIds || []).includes(
            voterParliamentaryConstituency?.constituencyId
          )
      ),
    [elections, voterParliamentaryConstituency]
  );

  const acAssociatedElections = useMemo(
    () =>
      elections.filter(
        (e) =>
          e.electionType === ELECTION_TYPES.STATE_ASSEMBLY &&
          e.stateId === currentVoter?.stateId &&
          (e.constituencyIds || []).includes(voterAssemblyConstituency?.constituencyId)
      ),
    [elections, currentVoter?.stateId, voterAssemblyConstituency]
  );

  const pcCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (
        c.constituencyId !== voterParliamentaryConstituency?.constituencyId ||
        c.approvalStatus !== 'APPROVED'
      ) {
        return false;
      }
      if (!candidateSearch.trim()) return true;
      const q = candidateSearch.toLowerCase();
      const party = parties.find((p) => p.partyId === c.partyId);
      return (
        c.name.toLowerCase().includes(q) ||
        party?.partyName.toLowerCase().includes(q) ||
        party?.abbreviation.toLowerCase().includes(q)
      );
    });
  }, [candidates, voterParliamentaryConstituency, candidateSearch, parties]);

  const acCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (
        c.constituencyId !== voterAssemblyConstituency?.constituencyId ||
        c.approvalStatus !== 'APPROVED'
      ) {
        return false;
      }
      if (!candidateSearch.trim()) return true;
      const q = candidateSearch.toLowerCase();
      const party = parties.find((p) => p.partyId === c.partyId);
      return (
        c.name.toLowerCase().includes(q) ||
        party?.partyName.toLowerCase().includes(q) ||
        party?.abbreviation.toLowerCase().includes(q)
      );
    });
  }, [candidates, voterAssemblyConstituency, candidateSearch, parties]);

  if (!currentVoter) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Geographical Electoral Hierarchy
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            My Parliamentary (PC) &amp; Assembly (AC) Constituencies
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            State: <strong>{voterState?.stateName}</strong> • Registered District:{' '}
            <strong>{voterDistrict?.districtName}</strong> • State Districts Covered:{' '}
            {stateDistricts.map((d) => d.districtName).join(', ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/voter/candidates"
            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl"
          >
            Full Candidate Directory
          </Link>
          <Link
            to="/voter/elections"
            className="px-4 py-2.5 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-xl"
          >
            My Eligible Elections &rarr;
          </Link>
        </div>
      </div>

      {/* Dual Constituency Cards (Strictly Separate Parliamentary & Assembly) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <ConstituencyCard
            constituency={voterParliamentaryConstituency}
            stateName={voterState?.stateName}
            districtName={voterDistrict?.districtName}
            parentParliamentaryName={null}
          />
          <div className="bg-white rounded-xl border border-indigo-200 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-indigo-900">
                Associated Lok Sabha Elections ({pcAssociatedElections.length})
              </span>
              <Link
                to={`/voter/candidates?type=LOK_SABHA&stateId=${currentVoter.stateId}`}
                className="font-bold text-indigo-800 hover:underline"
              >
                PC Candidate Directory &rarr;
              </Link>
            </div>
            {pcAssociatedElections.map((el) => (
              <div
                key={el.electionId}
                className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 flex items-center justify-between"
              >
                <div>
                  <strong className="text-slate-900 block">{el.title}</strong>
                  <span className="text-[11px] text-slate-600">
                    Year: {el.year} • Poll Date: {el.schedule?.pollingDate}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-white border border-indigo-200 font-bold text-[10px] text-indigo-900">
                  {el.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <ConstituencyCard
            constituency={voterAssemblyConstituency}
            stateName={voterState?.stateName}
            districtName={voterDistrict?.districtName}
            parentParliamentaryName={voterParliamentaryConstituency?.name}
          />
          <div className="bg-white rounded-xl border border-teal-200 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-teal-900">
                Associated State Assembly Elections ({acAssociatedElections.length})
              </span>
              <Link
                to={`/voter/candidates?type=STATE_ASSEMBLY&stateId=${currentVoter.stateId}`}
                className="font-bold text-teal-800 hover:underline"
              >
                AC Candidate Directory &rarr;
              </Link>
            </div>
            {acAssociatedElections.map((el) => (
              <div
                key={el.electionId}
                className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-100 flex items-center justify-between"
              >
                <div>
                  <strong className="text-slate-900 block">{el.title}</strong>
                  <span className="text-[11px] text-slate-600">
                    Year: {el.year} • Poll Date: {el.schedule?.pollingDate}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-white border border-teal-200 font-bold text-[10px] text-teal-900">
                  {el.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search Bar for Constituency Candidates */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Search Candidates in Your Constituencies
          </h2>
          <p className="text-xs text-slate-500">
            Filter nominated candidates across {voterParliamentaryConstituency?.name} PC and{' '}
            {voterAssemblyConstituency?.name} AC.
          </p>
        </div>
        <div className="w-full sm:w-80">
          <SearchBar
            value={candidateSearch}
            onChange={setCandidateSearch}
            placeholder="Search candidate or party..."
          />
        </div>
      </div>

      {/* Candidates in Voter's Parliamentary Constituency */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase text-indigo-800">
              Lok Sabha General Election (PARLIAMENTARY)
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Nominated Candidates in {voterParliamentaryConstituency?.name} PC (
              {pcCandidates.length})
            </h2>
          </div>
          <Link
            to="/voter/elections?electionId=LS-2029"
            className="text-xs font-bold text-indigo-900 hover:underline"
          >
            View Lok Sabha Election Status &rarr;
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
        <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase text-teal-800">
              State Legislative Assembly Election (ASSEMBLY)
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Nominated Candidates in {voterAssemblyConstituency?.name} AC (
              {acCandidates.length})
            </h2>
          </div>
          <Link
            to="/voter/elections"
            className="text-xs font-bold text-teal-900 hover:underline"
          >
            View State Assembly Election Status &rarr;
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
