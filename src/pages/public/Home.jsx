import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { ELECTION_TYPES, CONSTITUENCY_TYPES, ELECTION_STATUS_LABELS } from '../../utils/constants';
import { eciLogo } from '../../assets';

export default function Home() {
  const navigate = useNavigate();
  const {
    states,
    districts,
    constituencies,
    elections,
    candidates,
    parties,
    announcements,
  } = useElection();
  const { isVoterAuthenticated, isAdminAuthenticated } = useAuth();

  const [selectedStateId, setSelectedStateId] = useState('WB');
  const [stateSearch, setStateSearch] = useState('');

  const filteredStates = useMemo(() => {
    if (!stateSearch.trim()) return states;
    const q = stateSearch.toLowerCase();
    return states.filter(
      (s) =>
        s.stateName.toLowerCase().includes(q) ||
        s.stateId.toLowerCase().includes(q) ||
        s.capital.toLowerCase().includes(q)
    );
  }, [states, stateSearch]);

  const selectedState = useMemo(
    () => states.find((s) => s.stateId === selectedStateId) || states[0],
    [states, selectedStateId]
  );

  const stateDistricts = useMemo(
    () => districts.filter((d) => d.stateId === selectedState?.stateId),
    [districts, selectedState]
  );

  const statePCs = useMemo(
    () =>
      constituencies.filter(
        (c) =>
          c.stateId === selectedState?.stateId &&
          c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
      ),
    [constituencies, selectedState]
  );

  const stateACs = useMemo(
    () =>
      constituencies.filter(
        (c) =>
          c.stateId === selectedState?.stateId &&
          c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY
      ),
    [constituencies, selectedState]
  );

  const activeElections = useMemo(
    () => elections.filter((e) => e.status === 'POLLING_ACTIVE' || e.status === 'READY'),
    [elections]
  );

  const totalStatesCount = states.filter((s) => s.type === 'STATE').length;
  const totalUTCount = states.filter((s) => s.type === 'UT').length;
  const totalPCCount = constituencies.filter(
    (c) => c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
  ).length;
  const totalACCount = constituencies.filter(
    (c) => c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY
  ).length;

  return (
    <div className="space-y-8 pb-12">
      {/* Official Announcements Marquee / Banner */}
      {announcements && announcements.length > 0 && (
        <div className="bg-[#002868] text-white border-b-2 border-[#FF9933] shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <span className="bg-[#FF9933] text-slate-950 font-bold uppercase tracking-wider px-2 py-0.5 rounded text-[11px] shrink-0">
                ECI Bulletin
              </span>
              <span className="font-medium text-blue-50">
                {announcements[0].title}: {announcements[0].message}
              </span>
            </div>
            <Link
              to="/elections"
              className="text-[#FF9933] hover:text-amber-300 font-semibold shrink-0 underline underline-offset-2"
            >
              View Schedule &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="bg-gradient-to-br from-[#002868] via-[#003380] to-slate-900 rounded-2xl text-white shadow-xl overflow-hidden border border-blue-800/60">
          <div className="h-1.5 w-full flex">
            <div className="w-1/3 bg-[#FF9933]" />
            <div className="w-1/3 bg-white" />
            <div className="w-1/3 bg-[#138808]" />
          </div>

          <div className="p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold tracking-wider uppercase text-amber-300">
                <span>National &amp; State Digital Election Infrastructure</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                Online Voting &amp; Election Management Portal of India
              </h1>

              <p className="text-blue-100 text-sm sm:text-base leading-relaxed max-w-2xl">
                Unified, strictly decoupled architecture supporting nationwide{' '}
                <strong className="text-white">Lok Sabha General Elections</strong>,{' '}
                <strong className="text-white">State Legislative Assembly Elections</strong>{' '}
                across all {totalStatesCount} States and {totalUTCount} Union Territories, and{' '}
                <strong className="text-amber-300">Simultaneous Multi-Election Participation</strong>.
              </p>

              {/* Primary Role Selection Buttons (preserving original portal intent + modern portal access) */}
              <div className="pt-2 flex flex-wrap items-center gap-3.5">
                {isVoterAuthenticated ? (
                  <button
                    onClick={() => navigate('/voter/dashboard')}
                    className="px-6 py-3.5 bg-[#FF9933] hover:bg-amber-500 text-slate-950 font-bold rounded-xl shadow-md transition-all cursor-pointer text-sm sm:text-base"
                  >
                    Go to Voter Dashboard &rarr;
                  </button>
                ) : (
                  <button
                    id="voterButton"
                    onClick={() => navigate('/voter/login')}
                    className="px-6 py-3.5 bg-[#FF9933] hover:bg-amber-500 text-slate-950 font-bold rounded-xl shadow-md transition-all cursor-pointer text-sm sm:text-base"
                  >
                    I am a Voter (Login / Vote)
                  </button>
                )}

                {isAdminAuthenticated ? (
                  <button
                    onClick={() => navigate('/eci/dashboard')}
                    className="px-6 py-3.5 bg-white hover:bg-blue-50 text-[#002868] font-bold rounded-xl shadow-md transition-all cursor-pointer text-sm sm:text-base"
                  >
                    Open ECI Officer Console &rarr;
                  </button>
                ) : (
                  <button
                    id="eciButton"
                    onClick={() => navigate('/eci/login')}
                    className="px-6 py-3.5 bg-white hover:bg-blue-50 text-[#002868] font-bold rounded-xl shadow-md transition-all cursor-pointer text-sm sm:text-base"
                  >
                    I am an ECI Officer
                  </button>
                )}

                <Link
                  to="/voter/register"
                  className="px-5 py-3.5 bg-blue-800/60 hover:bg-blue-800 text-white border border-blue-400/30 font-semibold rounded-xl transition-all text-sm"
                >
                  New Voter Registration
                </Link>
              </div>

              <div className="pt-3 flex flex-wrap items-center gap-4 text-xs text-blue-200 border-t border-white/10">
                <div className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-lg shadow-xs">
                  <img src={eciLogo} alt="Election Commission of India" className="h-7 w-7 object-contain" />
                  <span className="text-[11px] font-bold text-[#002868]">Election Commission of India</span>
                </div>
                <span>
                  Supports Simultaneous Lok Sabha (PC) &amp; State Assembly (AC) Ballots with NOTA
                </span>
              </div>
            </div>

            {/* Right Column: Live National Architecture Snapshot */}
            <div className="lg:col-span-5 bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Pan-India Electoral Hierarchy
                  </h2>
                  <p className="text-xs text-blue-200">
                    Live frontend architecture &amp; constituency dataset
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                  {activeElections.length} Active Polls
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-3.5">
                  <p className="text-xs text-blue-200 font-medium">States &amp; UTs</p>
                  <p className="text-2xl font-extrabold text-white mt-0.5">
                    {states.length}{' '}
                    <span className="text-xs font-normal text-blue-200">
                      ({totalStatesCount}S + {totalUTCount}UT)
                    </span>
                  </p>
                </div>
                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-3.5">
                  <p className="text-xs text-blue-200 font-medium">Sample Districts</p>
                  <p className="text-2xl font-extrabold text-white mt-0.5">
                    {districts.length}
                  </p>
                </div>
                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-3.5">
                  <p className="text-xs text-blue-200 font-medium">
                    Parliamentary (PC)
                  </p>
                  <p className="text-2xl font-extrabold text-amber-300 mt-0.5">
                    {totalPCCount}{' '}
                    <span className="text-xs font-normal text-blue-200">
                      (543 Official Cap)
                    </span>
                  </p>
                </div>
                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-3.5">
                  <p className="text-xs text-blue-200 font-medium">
                    Assembly (AC)
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-300 mt-0.5">
                    {totalACCount}{' '}
                    <span className="text-xs font-normal text-blue-200">
                      State Seats
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-blue-950/70 border border-blue-700/50 rounded-lg p-3.5 text-xs space-y-1.5">
                <p className="font-bold text-amber-300 uppercase tracking-wider">
                  Try Simultaneous Elections Demo:
                </p>
                <p className="text-blue-100 leading-relaxed">
                  Login as voter <strong>Aarav Sen</strong> (EPIC:{' '}
                  <code className="bg-white/15 px-1.5 py-0.5 rounded text-white font-mono">
                    WBX1234567
                  </code>{' '}
                  / Mobile:{' '}
                  <code className="bg-white/15 px-1.5 py-0.5 rounded text-white font-mono">
                    9876543210
                  </code>
                  , OTP: <code className="font-mono text-white">123456</code>) to vote
                  independently in both <strong>Lok Sabha 2029 (Krishnanagar PC)</strong>{' '}
                  and <strong>West Bengal Assembly 2029 (Krishnanagar Uttar AC)</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Election Architecture Comparison Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-900">
                  Election Type 1: LOK_SABHA
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Nationwide Scope • 543 Official Seats
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Lok Sabha General Elections
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Conducted across <strong>Parliamentary Constituencies (PC)</strong> spanning
                all 28 States and 8 Union Territories to elect Members of Parliament (MPs)
                to the Lower House of the Parliament of India.
              </p>
              <ul className="text-xs text-slate-700 space-y-1.5 mb-5 bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
                <li>• Uses Parliamentary Constituency (<code className="font-mono">PARLIAMENTARY</code>) mapping</li>
                <li>• Separate candidate nomination list &amp; independent EVM ballot</li>
                <li>• Independent participation status per election ID</li>
              </ul>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <Link
                to="/elections?type=LOK_SABHA"
                className="text-sm font-bold text-[#002868] hover:underline"
              >
                Explore Lok Sabha Elections &rarr;
              </Link>
              <span className="text-slate-300">|</span>
              <Link
                to="/candidates?type=LOK_SABHA"
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                View MP Candidates
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-teal-100 text-teal-900">
                  Election Type 2: STATE_ASSEMBLY
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  State / UT Scope • Vidhan Sabha
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                State Legislative Assembly Elections
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Conducted within an individual State or Union Territory across{' '}
                <strong>Assembly Constituencies (AC)</strong> to elect Members of the
                Legislative Assembly (MLAs). Can run independently or simultaneously with
                Lok Sabha elections.
              </p>
              <ul className="text-xs text-slate-700 space-y-1.5 mb-5 bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
                <li>• Uses Assembly Constituency (<code className="font-mono">ASSEMBLY</code>) mapping</li>
                <li>• Scoped strictly to the target State/UT and its Assembly seats</li>
                <li>• Never conflicts with or overwrites Lok Sabha ballot status</li>
              </ul>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <Link
                to="/elections?type=STATE_ASSEMBLY"
                className="text-sm font-bold text-teal-800 hover:underline"
              >
                Explore State Assembly Elections &rarr;
              </Link>
              <span className="text-slate-300">|</span>
              <Link
                to="/candidates?type=STATE_ASSEMBLY"
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                View MLA Candidates
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Active & Upcoming Elections Schedule */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Live Electoral Calendar
            </span>
            <h2 className="text-2xl font-bold text-slate-900">
              Active &amp; Configured Elections
            </h2>
          </div>
          <Link
            to="/elections"
            className="text-sm font-bold text-[#002868] hover:text-blue-800"
          >
            View Complete Election Directory ({elections.length}) &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {elections.map((election) => {
            const isLS = election.electionType === ELECTION_TYPES.LOK_SABHA;
            const stateObj = states.find((s) => s.stateId === election.stateId);
            const electionCandCount = candidates.filter(
              (c) => c.electionId === election.electionId
            ).length;

            return (
              <div
                key={election.electionId}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                        isLS
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-teal-100 text-teal-800'
                      }`}
                    >
                      {isLS ? 'Lok Sabha' : `State Assembly (${election.stateId})`}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        election.status === 'POLLING_ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : election.status === 'RESULTS_DECLARED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ELECTION_STATUS_LABELS[election.status] || election.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {election.title}
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Jurisdiction:{' '}
                    <strong className="text-slate-700">
                      {isLS
                        ? 'All India (28 States & 8 UTs)'
                        : stateObj?.stateName || election.stateId}
                    </strong>
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-4">
                    {election.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Polling Date:</span>
                    <span className="font-semibold text-slate-900">
                      {election.pollingDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Contesting Candidates:</span>
                    <span className="font-semibold text-slate-900">
                      {electionCandCount} Registered
                    </span>
                  </div>
                  <div className="pt-2 flex items-center justify-between gap-2">
                    <Link
                      to={`/candidates?electionId=${election.electionId}`}
                      className="text-xs font-bold text-[#002868] hover:underline"
                    >
                      View Candidates
                    </Link>
                    {election.status === 'POLLING_ACTIVE' ? (
                      <Link
                        to="/voter/login"
                        className="px-3 py-1.5 bg-[#002868] hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Participate / Vote
                      </Link>
                    ) : (
                      <Link
                        to={`/results?electionId=${election.electionId}`}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors"
                      >
                        View Results
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive All-India State & Union Territory Explorer */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
                All 28 States &amp; 8 Union Territories
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">
                Interactive State &amp; Constituency Explorer
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Select any Indian State or Union Territory to inspect its official Lok Sabha
                &amp; Assembly seat counts, sample districts, and constituencies.
              </p>
            </div>
            <div className="w-full lg:w-72">
              <input
                type="text"
                value={stateSearch}
                onChange={(e) => setStateSearch(e.target.value)}
                placeholder="Search State, UT, or code (e.g. WB, DL)..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
            {/* State Selector Pills */}
            <div className="lg:col-span-5 max-h-96 overflow-y-auto pr-1 space-y-1.5">
              {filteredStates.map((st) => {
                const isSelected = st.stateId === selectedState?.stateId;
                return (
                  <button
                    key={st.stateId}
                    type="button"
                    onClick={() => setSelectedStateId(st.stateId)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#002868] text-white border-[#002868] shadow-xs'
                        : 'bg-slate-50/70 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-8 h-7 rounded text-xs font-bold flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {st.stateId}
                      </span>
                      <div className="truncate">
                        <p className="text-sm font-bold truncate">{st.stateName}</p>
                        <p
                          className={`text-[11px] ${
                            isSelected ? 'text-blue-200' : 'text-slate-500'
                          }`}
                        >
                          {st.type === 'UT' ? 'Union Territory' : 'State'} • Capital:{' '}
                          {st.capital}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span
                        className={`text-xs font-semibold block ${
                          isSelected ? 'text-amber-300' : 'text-slate-700'
                        }`}
                      >
                        {st.totalLokSabhaSeats} PC
                      </span>
                      <span
                        className={`text-[11px] block ${
                          isSelected ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        {st.totalAssemblySeats} AC
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected State Detail Panel */}
            {selectedState && (
              <div className="lg:col-span-7 bg-slate-50 rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-[#002868] text-white text-xs font-bold">
                        {selectedState.stateId}
                      </span>
                      <span className="px-2.5 py-0.5 rounded bg-slate-200 text-slate-700 text-xs font-semibold">
                        {selectedState.type === 'UT' ? 'Union Territory' : 'State'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                        {selectedState.metadataSource}
                      </span>
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900 mt-2">
                      {selectedState.stateName}
                    </h3>
                    <p className="text-xs text-slate-600">
                      Capital: <strong>{selectedState.capital}</strong> • Region:{' '}
                      <strong>{selectedState.region}</strong>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-center">
                      <span className="block text-[11px] text-slate-500 font-medium">
                        Official Lok Sabha
                      </span>
                      <span className="text-lg font-extrabold text-indigo-900">
                        {selectedState.totalLokSabhaSeats} Seats
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-center">
                      <span className="block text-[11px] text-slate-500 font-medium">
                        Official Assembly
                      </span>
                      <span className="text-lg font-extrabold text-teal-800">
                        {selectedState.totalAssemblySeats} Seats
                      </span>
                    </div>
                  </div>
                </div>

                {/* Districts & Constituencies in Selected State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2">
                      Parliamentary Constituencies ({statePCs.length} Loaded)
                    </h4>
                    <ul className="space-y-2 text-xs">
                      {statePCs.map((pc) => (
                        <li
                          key={pc.constituencyId}
                          className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {pc.name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Code: {pc.code} • {pc.reservationType}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                            {pc.metadataSource === 'VERIFIED_OFFICIAL'
                              ? 'Official'
                              : 'Demo Sample'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 mb-2">
                      Assembly Constituencies ({stateACs.length} Loaded)
                    </h4>
                    <ul className="space-y-2 text-xs max-h-48 overflow-y-auto">
                      {stateACs.map((ac) => (
                        <li
                          key={ac.constituencyId}
                          className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {ac.name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Code: {ac.code} • {ac.reservationType}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-semibold">
                            {ac.metadataSource === 'VERIFIED_OFFICIAL'
                              ? 'Official'
                              : 'Demo Sample'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Districts & Applicable Elections */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-800">
                      Sample Districts ({stateDistricts.length}):{' '}
                    </span>
                    {stateDistricts.map((d) => d.districtName).join(', ')}
                  </div>
                  <Link
                    to={`/candidates?stateId=${selectedState.stateId}`}
                    className="font-bold text-[#002868] hover:underline"
                  >
                    View Candidates in {selectedState.stateName} &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Portal Navigation Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/candidates"
            className="bg-white p-5 rounded-xl border border-slate-200 hover:border-[#002868] shadow-xs transition-all group"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              Candidate Directory
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-[#002868]">
              Search {candidates.length} Candidates &amp; {parties.length} Parties
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Filter by Lok Sabha, State Assembly, State, Constituency, or Party symbol.
            </p>
          </Link>

          <Link
            to="/results"
            className="bg-white p-5 rounded-xl border border-slate-200 hover:border-[#002868] shadow-xs transition-all group"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Election Results
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-[#002868]">
              Constituency Tallies &amp; NOTA Share
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Inspect declared Lok Sabha results and live constituency-wise demo tallies.
            </p>
          </Link>

          <Link
            to="/about"
            className="bg-white p-5 rounded-xl border border-slate-200 hover:border-[#002868] shadow-xs transition-all group"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              System Architecture
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-[#002868]">
              About Simultaneous Elections
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Learn how Parliamentary (PC) and Assembly (AC) ballots are isolated.
            </p>
          </Link>

          <Link
            to="/feedback"
            className="bg-white p-5 rounded-xl border border-slate-200 hover:border-[#002868] shadow-xs transition-all group"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Citizen Helpdesk
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-[#002868]">
              Submit Voter Feedback
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Share feedback or report electoral roll discrepancies to the ECI portal.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
