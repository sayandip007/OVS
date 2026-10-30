import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import PageHeader from '../../components/common/PageHeader';
import SearchBar from '../../components/common/SearchBar';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import CandidateCard from '../../components/voter/CandidateCard';
import { ELECTION_TYPES } from '../../utils/constants';

export default function CandidateDirectory() {
  const [searchParams] = useSearchParams();
  const initialElectionId = searchParams.get('electionId') || 'ALL';
  const initialType = searchParams.get('type') || 'ALL';
  const initialStateId = searchParams.get('stateId') || 'ALL';

  const {
    elections,
    states,
    constituencies,
    parties,
    candidates,
    recordCandidateView,
  } = useElection();

  const [search, setSearch] = useState('');
  const [electionFilter, setElectionFilter] = useState(initialElectionId);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [stateFilter, setStateFilter] = useState(initialStateId);
  const [constituencyFilter, setConstituencyFilter] = useState('ALL');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const availableConstituencies = useMemo(() => {
    return constituencies.filter((c) => {
      if (stateFilter !== 'ALL' && c.stateId !== stateFilter) return false;
      if (
        typeFilter === ELECTION_TYPES.LOK_SABHA &&
        c.constituencyType !== 'PARLIAMENTARY'
      ) {
        return false;
      }
      if (
        typeFilter === ELECTION_TYPES.STATE_ASSEMBLY &&
        c.constituencyType !== 'ASSEMBLY'
      ) {
        return false;
      }
      return true;
    });
  }, [constituencies, stateFilter, typeFilter]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((cand) => {
      if (electionFilter !== 'ALL' && cand.electionId !== electionFilter) return false;
      if (typeFilter !== 'ALL' && cand.electionType !== typeFilter) return false;
      if (stateFilter !== 'ALL' && cand.stateId !== stateFilter) return false;
      if (constituencyFilter !== 'ALL' && cand.constituencyId !== constituencyFilter) {
        return false;
      }
      if (partyFilter !== 'ALL' && cand.partyId !== partyFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const party = parties.find((p) => p.partyId === cand.partyId);
        const constObj = constituencies.find(
          (c) => c.constituencyId === cand.constituencyId
        );
        const matchName = cand.name.toLowerCase().includes(q);
        const matchParty =
          party?.partyName.toLowerCase().includes(q) ||
          party?.abbreviation.toLowerCase().includes(q);
        const matchConst = constObj?.name.toLowerCase().includes(q);
        if (!matchName && !matchParty && !matchConst) return false;
      }
      return true;
    });
  }, [
    candidates,
    electionFilter,
    typeFilter,
    stateFilter,
    constituencyFilter,
    partyFilter,
    search,
    parties,
    constituencies,
  ]);

  const handleInspectCandidate = (cand, party, constituency) => {
    recordCandidateView(cand.candidateId);
    setSelectedCandidate({ candidate: cand, party, constituency });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        badge="Affidavits & Nominations"
        title="Contesting Candidates Directory"
        subtitle="Browse candidates nominated across Lok Sabha Parliamentary Constituencies and State Legislative Assembly Constituencies."
      />

      {/* Multi-Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search candidate, party, or seat..."
          />
        </div>

        <select
          value={electionFilter}
          onChange={(e) => setElectionFilter(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">All Elections</option>
          {elections.map((el) => (
            <option key={el.electionId} value={el.electionId}>
              {el.title}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setConstituencyFilter('ALL');
          }}
          className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">All Election Types</option>
          <option value={ELECTION_TYPES.LOK_SABHA}>Lok Sabha (PC)</option>
          <option value={ELECTION_TYPES.STATE_ASSEMBLY}>State Assembly (AC)</option>
        </select>

        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setConstituencyFilter('ALL');
          }}
          className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">All States &amp; UTs</option>
          {states.map((st) => (
            <option key={st.stateId} value={st.stateId}>
              {st.stateName} ({st.stateId})
            </option>
          ))}
        </select>

        <select
          value={constituencyFilter}
          onChange={(e) => setConstituencyFilter(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="ALL">All Constituencies</option>
          {availableConstituencies.map((c) => (
            <option key={c.constituencyId} value={c.constituencyId}>
              {c.name} ({c.constituencyType === 'PARLIAMENTARY' ? 'PC' : 'AC'})
            </option>
          ))}
        </select>
      </div>

      {/* Party Quick Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setPartyFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors ${
            partyFilter === 'ALL'
              ? 'bg-[#002868] text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Parties ({candidates.length})
        </button>
        {parties.map((p) => (
          <button
            key={p.partyId}
            type="button"
            onClick={() => setPartyFilter(p.partyId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors ${
              partyFilter === p.partyId
                ? 'bg-[#002868] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <img
              src={p.symbolUrl}
              alt={p.abbreviation}
              className="w-4 h-4 rounded-full object-contain bg-white"
            />
            <span>{p.abbreviation}</span>
          </button>
        ))}
      </div>

      {/* Candidate Grid */}
      {filteredCandidates.length === 0 ? (
        <EmptyState
          title="No Contesting Candidates Match Filters"
          description="Adjust your election, state, constituency, or party filter to see registered candidates."
          actionLabel="Clear All Filters"
          onAction={() => {
            setSearch('');
            setElectionFilter('ALL');
            setTypeFilter('ALL');
            setStateFilter('ALL');
            setConstituencyFilter('ALL');
            setPartyFilter('ALL');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCandidates.map((cand) => {
            const party = parties.find((p) => p.partyId === cand.partyId);
            const constituency = constituencies.find(
              (c) => c.constituencyId === cand.constituencyId
            );
            return (
              <div key={cand.candidateId} className="space-y-2">
                <CandidateCard
                  candidate={cand}
                  party={party}
                  constituency={constituency}
                  showSelectButton={false}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleInspectCandidate(cand, party, constituency)}
                    className="text-xs font-bold text-[#002868] hover:underline cursor-pointer"
                  >
                    Inspect Full Affidavit &amp; Manifesto &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Candidate Profile Modal */}
      <Modal
        isOpen={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidate(null)}
        title={
          selectedCandidate
            ? `Candidate Affidavit: ${selectedCandidate.candidate.name}`
            : 'Candidate Details'
        }
      >
        {selectedCandidate && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
              <img
                src={selectedCandidate.candidate.photoUrl}
                alt={selectedCandidate.candidate.name}
                className="w-20 h-20 rounded-xl object-cover border border-slate-200"
              />
              <div>
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-xs font-bold">
                  Ballot #{selectedCandidate.candidate.ballotNumber} •{' '}
                  {selectedCandidate.candidate.electionType === 'LOK_SABHA'
                    ? 'Lok Sabha (MP)'
                    : 'State Assembly (MLA)'}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  {selectedCandidate.candidate.name}
                </h3>
                <p className="text-xs text-slate-600">
                  Party:{' '}
                  <strong>
                    {selectedCandidate.party?.partyName || 'Independent'} (
                    {selectedCandidate.party?.abbreviation || 'IND'})
                  </strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Constituency</span>
                <strong className="text-slate-900">
                  {selectedCandidate.constituency?.name ||
                    selectedCandidate.candidate.constituencyId}
                </strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Age &amp; Gender</span>
                <strong className="text-slate-900">
                  {selectedCandidate.candidate.age} Years •{' '}
                  {selectedCandidate.candidate.gender}
                </strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Education</span>
                <strong className="text-slate-900">
                  {selectedCandidate.candidate.education}
                </strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Nomination Status</span>
                <strong className="text-emerald-700">
                  {selectedCandidate.candidate.approvalStatus}
                </strong>
              </div>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#002868] block mb-1">
                Key Manifesto &amp; Summary
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {selectedCandidate.candidate.manifestoSummary}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
