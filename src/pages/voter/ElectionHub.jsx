import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import VotingStatus from '../../components/voter/VotingStatus';
import Modal from '../../components/common/Modal';
import { ELECTION_TYPES, NOTA_OPTION } from '../../utils/constants';
import { notaImg, notaLogo } from '../../assets';

export default function ElectionHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    currentVoter,
    eligibleElections,
    participationSummary,
    getCandidatesForVoterElection,
    getConstituencyForVoterElection,
    hasParticipatedInElection,
    submitBallotForElection,
  } = useVoter();
  const { parties } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const requestedElectionId = searchParams.get('electionId');
  const [activeElectionId, setActiveElectionId] = useState(
    requestedElectionId || eligibleElections[0]?.electionId || 'LS-2029'
  );
  const [selectedChoiceId, setSelectedChoiceId] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(7 * 60); // 7-minute EVM session timer

  useEffect(() => {
    if (requestedElectionId && requestedElectionId !== activeElectionId) {
      setActiveElectionId(requestedElectionId);
      setSelectedChoiceId(null);
    }
  }, [requestedElectionId, activeElectionId]);

  useEffect(() => {
    const id = setInterval(() => {
      setSessionSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const activeElection = useMemo(
    () =>
      eligibleElections.find((e) => e.electionId === activeElectionId) ||
      eligibleElections[0],
    [eligibleElections, activeElectionId]
  );

  const activeConstituency = useMemo(
    () =>
      activeElection ? getConstituencyForVoterElection(activeElection) : null,
    [activeElection, getConstituencyForVoterElection]
  );

  const ballotCandidates = useMemo(
    () =>
      activeElection ? getCandidatesForVoterElection(activeElection) : [],
    [activeElection, getCandidatesForVoterElection]
  );

  const alreadyVotedInThisElection = activeElection
    ? hasParticipatedInElection(activeElection.electionId)
    : false;

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleSelectTab = (electionId) => {
    setActiveElectionId(electionId);
    setSelectedChoiceId(null);
    setSearchParams({ electionId });
  };

  const selectedCandidateOrNota = useMemo(() => {
    if (!selectedChoiceId) return null;
    if (selectedChoiceId === NOTA_OPTION.candidateId) {
      return {
        candidateId: NOTA_OPTION.candidateId,
        name: NOTA_OPTION.name,
        partyName: NOTA_OPTION.partyName,
        partyAbbr: NOTA_OPTION.abbreviation,
        photoUrl: notaImg,
        symbolUrl: notaLogo,
        isNota: true,
      };
    }
    const cand = ballotCandidates.find((c) => c.candidateId === selectedChoiceId);
    if (!cand) return null;
    const party = parties.find((p) => p.partyId === cand.partyId);
    return {
      candidateId: cand.candidateId,
      name: cand.name,
      partyName: party?.partyName || 'Independent',
      partyAbbr: party?.abbreviation || 'IND',
      photoUrl: cand.photoUrl,
      symbolUrl: party?.symbolUrl,
      isNota: false,
    };
  }, [selectedChoiceId, ballotCandidates, parties]);

  const handleConfirmVote = () => {
    if (!activeElection || !selectedChoiceId) return;

    const result = submitBallotForElection({
      electionId: activeElection.electionId,
      candidateOrNotaId: selectedChoiceId,
    });

    setConfirmModalOpen(false);
    if (!result.ok) {
      notifyError(result.error);
      return;
    }

    setSelectedChoiceId(null);
    notifySuccess(
      `Ballot recorded for ${activeElection.title}! Your participation status for this election is now VOTED.`
    );
  };

  if (!currentVoter) return null;

  return (
    <div className="space-y-6">
      {/* Simultaneous Election Progress Tracker */}
      <VotingStatus summary={participationSummary} />

      {/* Simultaneous Election Selector Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Simultaneous Multi-Election Digital Ballot Unit
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Select Active Election Ballot
            </h1>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Session Timer: {formatTimer(sessionSeconds)}</span>
          </div>
        </div>

        {/* Election Switcher Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {eligibleElections.map((el) => {
            const isSelected = el.electionId === activeElection?.electionId;
            const isVoted = hasParticipatedInElection(el.electionId);
            const isLS = el.electionType === ELECTION_TYPES.LOK_SABHA;
            const constObj = getConstituencyForVoterElection(el);

            return (
              <button
                key={el.electionId}
                type="button"
                onClick={() => handleSelectTab(el.electionId)}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-[#002868] bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        isLS
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'bg-teal-100 text-teal-900'
                      }`}
                    >
                      {isLS ? 'Lok Sabha (PC)' : 'State Assembly (AC)'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {el.electionId}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1">
                    {el.title}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Constituency: <strong>{constObj?.name || 'Mapped Seat'}</strong>
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                    isVoted
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {isVoted ? '✓ VOTED' : 'PENDING'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Election EVM Ballot Unit */}
        {activeElection && (
          <div className="pt-2 space-y-5">
            <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-300 font-bold block">
                  {activeElection.electionType === ELECTION_TYPES.LOK_SABHA
                    ? 'Parliamentary Constituency Ballot (MP)'
                    : 'State Legislative Assembly Constituency Ballot (MLA)'}
                </span>
                <h3 className="text-lg font-extrabold mt-0.5">
                  {activeElection.title} — {activeConstituency?.name} (
                  {activeConstituency?.code})
                </h3>
              </div>

              <div className="text-xs text-slate-300">
                Voter EPIC: <strong className="text-white">{currentVoter.voterRef}</strong>
              </div>
            </div>

            {alreadyVotedInThisElection ? (
              <div className="p-8 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto text-2xl font-bold">
                  ✓
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-emerald-950">
                    Participation Recorded for {activeElection.title}
                  </h3>
                  <p className="text-sm text-emerald-800 max-w-xl mx-auto">
                    You have already completed your ballot for{' '}
                    <strong>{activeConstituency?.name}</strong> in this election. In
                    accordance with ECI ballot secrecy rules, your candidate choice is not
                    stored in your voter profile.
                  </p>
                </div>

                {/* Prompt to complete the other simultaneous election if pending */}
                {participationSummary.pendingCount > 0 ? (
                  <div className="pt-2">
                    <p className="text-xs font-bold text-amber-900 mb-2">
                      You still have {participationSummary.pendingCount} pending election
                      ballot!
                    </p>
                    {eligibleElections
                      .filter((e) => !hasParticipatedInElection(e.electionId))
                      .map((pendingEl) => (
                        <button
                          key={pendingEl.electionId}
                          type="button"
                          onClick={() => handleSelectTab(pendingEl.electionId)}
                          className="px-5 py-2.5 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                        >
                          Switch to {pendingEl.title} Ballot &rarr;
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigate('/results')}
                      className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Inspect Live Constituency Tallies &rarr;
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Electronic Ballot Table with Red LED Indicator */}
                <div className="border-2 border-slate-300 rounded-2xl overflow-hidden bg-slate-50">
                  <div className="bg-slate-200 px-4 py-2.5 border-b border-slate-300 grid grid-cols-12 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <div className="col-span-1">No.</div>
                    <div className="col-span-6 sm:col-span-7">
                      Candidate &amp; Political Party
                    </div>
                    <div className="col-span-2 text-center">Symbol</div>
                    <div className="col-span-3 sm:col-span-2 text-right">
                      EVM Lamp &amp; Button
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200 bg-white">
                    {ballotCandidates.map((cand, index) => {
                      const party = parties.find((p) => p.partyId === cand.partyId);
                      const isSelected = selectedChoiceId === cand.candidateId;

                      return (
                        <div
                          key={cand.candidateId}
                          onClick={() => setSelectedChoiceId(cand.candidateId)}
                          className={`px-4 py-3.5 grid grid-cols-12 items-center gap-2 transition-colors cursor-pointer ${
                            isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="col-span-1 text-sm font-extrabold text-slate-700">
                            {cand.ballotNumber || index + 1}
                          </div>

                          <div className="col-span-6 sm:col-span-7 flex items-center gap-3">
                            <img
                              src={cand.photoUrl}
                              alt={cand.name}
                              className="w-12 h-12 rounded-lg object-cover border border-slate-300 shrink-0"
                            />
                            <div className="min-w-0">
                              <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                                {cand.name}
                              </h4>
                              <p className="text-xs text-slate-600 truncate">
                                {party?.partyName || 'Independent'} (
                                {party?.abbreviation || 'IND'})
                              </p>
                            </div>
                          </div>

                          <div className="col-span-2 flex justify-center">
                            {party?.symbolUrl && (
                              <img
                                src={party.symbolUrl}
                                alt={party.abbreviation}
                                className="w-10 h-10 object-contain rounded bg-white p-1 border border-slate-200"
                              />
                            )}
                          </div>

                          <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-3">
                            {/* Red EVM LED Indicator */}
                            <span
                              title={isSelected ? 'EVM Lamp ON' : 'EVM Lamp OFF'}
                              className={`w-4 h-4 rounded-full border transition-all ${
                                isSelected
                                  ? 'bg-red-600 border-red-700 shadow-[0_0_10px_#dc2626]'
                                  : 'bg-slate-200 border-slate-300'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedChoiceId(cand.candidateId);
                              }}
                              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#002868] text-white'
                                  : 'bg-blue-900/90 hover:bg-[#002868] text-white'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Vote'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Mandatory NOTA Row at the bottom of every ballot */}
                    <div
                      onClick={() => setSelectedChoiceId(NOTA_OPTION.candidateId)}
                      className={`px-4 py-3.5 grid grid-cols-12 items-center gap-2 transition-colors cursor-pointer ${
                        selectedChoiceId === NOTA_OPTION.candidateId
                          ? 'bg-blue-50/80'
                          : 'bg-slate-50/60 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="col-span-1 text-sm font-extrabold text-slate-700">
                        {ballotCandidates.length + 1}
                      </div>

                      <div className="col-span-6 sm:col-span-7 flex items-center gap-3">
                        <img
                          src={notaImg}
                          alt="NOTA"
                          className="w-12 h-12 rounded-lg object-cover border border-slate-300 shrink-0 bg-white"
                        />
                        <div>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900">
                            {NOTA_OPTION.name}
                          </h4>
                          <p className="text-xs text-slate-600">
                            {NOTA_OPTION.description}
                          </p>
                        </div>
                      </div>

                      <div className="col-span-2 flex justify-center">
                        <img
                          src={notaLogo}
                          alt="NOTA Symbol"
                          className="w-10 h-10 object-contain rounded bg-white p-1 border border-slate-200"
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-3">
                        <span
                          className={`w-4 h-4 rounded-full border transition-all ${
                            selectedChoiceId === NOTA_OPTION.candidateId
                              ? 'bg-red-600 border-red-700 shadow-[0_0_10px_#dc2626]'
                              : 'bg-slate-200 border-slate-300'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChoiceId(NOTA_OPTION.candidateId);
                          }}
                          className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                            selectedChoiceId === NOTA_OPTION.candidateId
                              ? 'bg-[#002868] text-white'
                              : 'bg-slate-800 hover:bg-slate-950 text-white'
                          }`}
                        >
                          {selectedChoiceId === NOTA_OPTION.candidateId
                            ? 'Selected'
                            : 'NOTA'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Ballot Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="text-xs text-slate-700">
                    {selectedCandidateOrNota ? (
                      <span>
                        Selected Choice:{' '}
                        <strong className="text-[#002868] text-sm">
                          {selectedCandidateOrNota.name} (
                          {selectedCandidateOrNota.partyAbbr})
                        </strong>{' '}
                        for <strong>{activeElection.title}</strong>
                      </span>
                    ) : (
                      <span>
                        Click any candidate row or <strong>NOTA</strong> above to light the
                        red EVM indicator lamp before submitting your ballot.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!selectedChoiceId}
                    onClick={() => setConfirmModalOpen(true)}
                    className="px-6 py-3 bg-[#138808] hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Submit Ballot for {activeElection.electionId} &rarr;
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* VVPAT / Ballot Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Simulated VVPAT Ballot Submission"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Change Selection
            </button>
            <button
              type="button"
              onClick={handleConfirmVote}
              className="px-5 py-2 rounded-lg bg-[#138808] hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
            >
              Confirm &amp; Cast Final Ballot
            </button>
          </>
        }
      >
        {selectedCandidateOrNota && activeElection && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] text-amber-300 font-bold uppercase block">
                  VVPAT Verification Slip Preview
                </span>
                <h4 className="text-base font-bold mt-0.5">{activeElection.title}</h4>
                <p className="text-slate-300">
                  Constituency: {activeConstituency?.name} ({activeConstituency?.code})
                </p>
              </div>
              <span className="w-4 h-4 rounded-full bg-red-600 shadow-[0_0_12px_#dc2626]" />
            </div>

            <div className="p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50/50 flex items-center gap-4">
              <img
                src={selectedCandidateOrNota.photoUrl}
                alt={selectedCandidateOrNota.name}
                className="w-16 h-16 rounded-xl object-cover border border-slate-300 bg-white"
              />
              <div className="flex-1">
                <span className="text-[11px] font-bold uppercase text-emerald-800">
                  Selected Ballot Choice
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {selectedCandidateOrNota.name}
                </h3>
                <p className="text-xs text-slate-700">
                  {selectedCandidateOrNota.partyName} (
                  {selectedCandidateOrNota.partyAbbr})
                </p>
              </div>
              {selectedCandidateOrNota.symbolUrl && (
                <img
                  src={selectedCandidateOrNota.symbolUrl}
                  alt={selectedCandidateOrNota.partyAbbr}
                  className="w-12 h-12 object-contain bg-white p-1 rounded-lg border border-slate-200"
                />
              )}
            </div>

            <p className="text-slate-600 leading-relaxed">
              <strong>Important:</strong> Submitting this ballot will mark only{' '}
              <strong>{activeElection.title}</strong> as <code className="font-mono">VOTED</code>. Any
              other simultaneous election you are eligible for will remain independent.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
