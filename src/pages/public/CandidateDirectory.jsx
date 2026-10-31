import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import PageHeader from '../../components/common/PageHeader';
import SearchBar from '../../components/common/SearchBar';
import EmptyState from '../../components/common/EmptyState';
import CandidateCard from '../../components/voter/CandidateCard';
import CandidateProfileModal from '../../components/ballot/CandidateProfileModal';
import { ELECTION_TYPES } from '../../utils/constants';

export default function CandidateDirectory() {
  const [searchParams] = useSearchParams();
  const initialElectionId = searchParams.get('electionId') || 'ALL';
  const initialType = searchParams.get('type') || 'ALL';
  const initialStateId = searchParams.get('stateId') || 'ALL';
  const initialConstituencyId = searchParams.get('constituencyId') || 'ALL';

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
  const [constituencyFilter, setConstituencyFilter] = useState(
    initialConstituencyId
  );
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

  const approvedCandidates = useMemo(() => {
    return candidates.filter(
      (cand) => (cand.status || cand.approvalStatus || 'APPROVED') === 'APPROVED'
    );
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    return approvedCandidates.filter((cand) => {
      if (electionFilter !== 'ALL' && cand.electionId !== electionFilter)
        return false;
      if (typeFilter !== 'ALL' && cand.electionType !== typeFilter) return false;
      if (stateFilter !== 'ALL' && cand.stateId !== stateFilter) return false;
      if (
        constituencyFilter !== 'ALL' &&
        cand.constituencyId !== constituencyFilter
      ) {
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
    approvedCandidates,
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
    recordCandidateView(cand.id || cand.candidateId);
    const election = elections.find(
      (e) => (e.id || e.electionId) === cand.electionId
    );
    const stateObj = states.find(
      (s) => (s.id || s.stateId) === (cand.stateId || constituency?.stateId)
    );
    setSelectedCandidate({
      candidate: cand,
      party,
      constituency,
      election,
      stateName: stateObj?.name || stateObj?.stateName,
    });
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
          <option value={ELECTION_TYPES.STATE_ASSEMBLY}>
            State Assembly (AC)
          </option>
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
          All Parties ({approvedCandidates.length})
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
                  onSelectProfile={() =>
                    handleInspectCandidate(cand, party, constituency)
                  }
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      handleInspectCandidate(cand, party, constituency)
                    }
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

      {/* Unified Reusable Candidate Profile Modal */}
      <CandidateProfileModal
        isOpen={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidate(null)}
        candidate={selectedCandidate?.candidate}
        party={selectedCandidate?.party}
        constituency={selectedCandidate?.constituency}
        election={selectedCandidate?.election}
        stateName={selectedCandidate?.stateName}
      />
    </div>
  );
}
