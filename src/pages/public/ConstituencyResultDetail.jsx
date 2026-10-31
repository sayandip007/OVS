import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import {
  ELECTION_TYPES,
  RESULT_STATUSES,
  RESULT_STATUS_LABELS,
} from '../../utils/constants';
import { countingService } from '../../services/countingService';
import {
  SimulatedResultDisclaimer,
  CumulativeRoundLineChart,
} from '../../components/results/ResultCharts';
import { defaultAvatar, eciLogo, notaImg, notaLogo } from '../../assets';
import {
  ArrowLeft,
  Download,
  Printer,
  Clock,
  Award,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export default function ConstituencyResultDetail() {
  const { electionId, constituencyId } = useParams();
  const {
    results = [],
    elections = [],
    constituencies = [],
    candidates = [],
    parties = [],
    states = [],
  } = useElection();

  const election = useMemo(
    () => elections.find((e) => (e.id || e.electionId) === electionId),
    [elections, electionId]
  );

  const constituency = useMemo(
    () =>
      constituencies.find((c) => (c.id || c.constituencyId) === constituencyId),
    [constituencies, constituencyId]
  );

  const stateObj = useMemo(
    () =>
      states.find(
        (s) =>
          (s.id || s.stateId) === (constituency?.stateId || election?.stateId)
      ),
    [states, constituency, election]
  );

  // Strict exact match on BOTH electionId and constituencyId
  const resultRecord = useMemo(
    () =>
      results.find(
        (r) =>
          r.electionId === electionId && r.constituencyId === constituencyId
      ),
    [results, electionId, constituencyId]
  );

  const isPublished = countingService.isResultPubliclyVisible(resultRecord);
  const isOngoingCounting =
    resultRecord?.status === RESULT_STATUSES.COUNTING_IN_PROGRESS ||
    resultRecord?.status === RESULT_STATUSES.COUNTING_PAUSED;

  const standings = useMemo(() => {
    if (!resultRecord) return null;
    return countingService.calculateConstituencyStandings({
      candidates: resultRecord.candidates || [],
      notaVotes: resultRecord.notaVotes || 0,
      isCompleted: isPublished,
    });
  }, [resultRecord, isPublished]);

  const handleDownloadCsv = () => {
    if (!resultRecord || !isPublished) return;
    const csv = countingService.exportConstituencyResultCSV(resultRecord, {
      parties,
      candidates,
    });
    countingService.triggerCsvDownload(
      `demo-result-${electionId}-${constituencyId}.csv`,
      csv
    );
  };

  if (!election || !constituency) {
    return (
      <div className="space-y-6">
        <Link
          to="/results"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#002868] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Public Results Portal
        </Link>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
          <h1 className="text-lg font-bold text-slate-900">
            Constituency Result Record Not Found
          </h1>
          <p className="text-xs text-slate-600">
            No matching election ({electionId}) or constituency ({constituencyId}) exists in the demonstration registry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <Link
            to="/results"
            className="inline-flex items-center gap-1.5 font-semibold text-[#002868] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Results
          </Link>
          <span>/</span>
          <Link
            to={
              (election.type || election.electionType) ===
              ELECTION_TYPES.LOK_SABHA
                ? '/results/lok-sabha'
                : `/results/assembly?stateId=${constituency.stateId}`
            }
            className="font-semibold text-[#002868] hover:underline"
          >
            {(election.type || election.electionType) ===
            ELECTION_TYPES.LOK_SABHA
              ? 'Lok Sabha Dashboard'
              : `${stateObj?.name || constituency.stateId} Assembly Dashboard`}
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">
            {constituency.name}
          </span>
        </div>

        {isPublished && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Constituency CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#002868] text-white hover:bg-blue-900 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Summary
            </button>
          </div>
        )}
      </div>

      <SimulatedResultDisclaimer compact />

      {/* Constituency Header Card */}
      <div className="bg-[#002868] text-white rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200">
              <span>
                {(election.type || election.electionType) ===
                ELECTION_TYPES.LOK_SABHA
                  ? 'Lok Sabha General Election (Parliamentary Constituency)'
                  : 'State Legislative Assembly Election (Assembly Constituency)'}
              </span>
              <span>·</span>
              <span>
                State: {stateObj?.name || stateObj?.stateName || constituency.stateId} (
                {constituency.stateId})
              </span>
              <span>·</span>
              <span className="font-mono">{constituency.id || constituency.constituencyId}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {constituency.name} Constituency
            </h1>
            <p className="text-xs sm:text-sm text-blue-100">
              {election.name || election.title} ({election.id || election.electionId})
            </p>
          </div>

          <div className="text-right space-y-1">
            <span className="text-xs text-blue-200 block">
              Counting &amp; Publication Status
            </span>
            <span className="text-sm font-bold text-amber-300 block">
              {resultRecord
                ? RESULT_STATUS_LABELS[resultRecord.status] || resultRecord.status
                : 'Awaiting Counting Session'}
            </span>
            {isPublished && resultRecord?.publishedAt && (
              <span className="text-[11px] text-blue-200 block font-mono tabular-nums">
                Declared: {new Date(resultRecord.publishedAt).toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Unpublished / Draft Public Status Guard */}
      {!resultRecord ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
          <Clock className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">
            No Demo Result Configured for {constituency.name}
          </h2>
          <p className="text-xs text-slate-600 max-w-lg mx-auto">
            This constituency does not yet have a configured counting dataset in {election.id || election.electionId}. Missing demo records are never counted as zero-vote declared results.
          </p>
        </div>
      ) : !isPublished && !isOngoingCounting ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <Lock className="w-8 h-8 text-amber-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">
            Result Not Yet Published ({RESULT_STATUS_LABELS[resultRecord.status] || resultRecord.status})
          </h2>
          <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
            In accordance with election publication rules, draft or unverified candidate vote totals are hidden from public display until the Returning Officer / ECI Administrator completes review and formally publishes the result.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <span className="text-xs text-slate-500">
                Total Simulated Votes Counted
              </span>
              <p className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                {(standings?.totalCountedVotes || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Valid: {(standings?.validCandidateVotes || 0).toLocaleString('en-IN')} · NOTA:{' '}
                {(standings?.notaVotes || 0).toLocaleString('en-IN')} ({standings?.notaPercentage || 0}%)
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <span className="text-xs text-slate-500">Counting Round Progress</span>
              <p className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                Round {resultRecord.currentRound || 0} of{' '}
                {resultRecord.totalConfiguredRounds || 3}
              </p>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Configured Limit: {(resultRecord.totalConfiguredVotes || 0).toLocaleString('en-IN')} votes
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <span className="text-xs text-slate-500">
                {standings?.isTied
                  ? 'Constituency Status'
                  : isPublished
                  ? 'Winning Candidate (Simulated)'
                  : 'Leading Candidate (Ongoing Counting)'}
              </span>
              {standings?.isTied ? (
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>TIED — Requires Resolution</span>
                </div>
              ) : (
                <p className="text-base font-extrabold text-slate-900 truncate">
                  {standings?.candidates?.[0]?.snapshotName || 'Pending'}
                </p>
              )}
              <span className="text-[11px] text-slate-600">
                {standings?.isTied
                  ? 'Top candidates have identical vote totals'
                  : `Party: ${standings?.candidates?.[0]?.snapshotPartyAbbr || 'IND'} · ${
                      standings?.candidates?.[0]?.votePercentage || 0
                    }% Share`}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <span className="text-xs text-slate-500">
                {isPublished ? 'Victory Margin' : 'Current Lead Margin'}
              </span>
              <p className="text-xl font-extrabold text-emerald-800 font-mono tabular-nums">
                {standings?.isTied
                  ? '0 (TIED)'
                  : `+${(
                      (isPublished
                        ? standings?.victoryMargin
                        : standings?.leadingMargin) || 0
                    ).toLocaleString('en-IN')} votes`}
              </p>
              <span className="text-[11px] text-slate-500">
                {isPublished
                  ? 'Final declared margin over runner-up'
                  : 'Interim lead — Winner not declared until completion'}
              </span>
            </div>
          </div>

          {/* Candidate-Wise Standings Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Candidate-Wise Simulated Standings &amp; Vote Share
                </h2>
                <p className="text-xs text-slate-500">
                  Ranked by simulated vote total · Vote % calculated against total counted votes (including NOTA)
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {standings?.candidates?.length || 0} Contesting Candidates + NOTA
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {(standings?.candidates || []).map((cand) => {
                const masterCand = candidates.find(
                  (mc) => (mc.id || mc.candidateId) === cand.candidateId
                );
                const partyObj = parties.find(
                  (p) => (p.id || p.partyId) === cand.partyId
                );
                const photo =
                  masterCand?.photograph || masterCand?.photoUrl || defaultAvatar;
                const symbol =
                  partyObj?.symbol || partyObj?.symbolUrl || eciLogo;

                const isWinner =
                  isPublished &&
                  !standings.isTied &&
                  standings.winnerCandidateId === cand.candidateId;
                const isRunnerUp =
                  isPublished &&
                  !standings.isTied &&
                  standings.runnerUpCandidateId === cand.candidateId;
                const isLeading =
                  !isPublished &&
                  !standings.isTied &&
                  standings.leadingCandidateId === cand.candidateId;
                const isTiedTop =
                  standings.isTied &&
                  standings.tiedCandidateIds.includes(cand.candidateId);

                return (
                  <div
                    key={cand.candidateId}
                    className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isWinner ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="w-7 text-xs font-bold text-slate-400 font-mono tabular-nums">
                        #{cand.rank}
                      </span>
                      <img
                        src={photo}
                        alt={cand.snapshotName || masterCand?.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {cand.snapshotName || masterCand?.name || cand.candidateId}
                          </span>
                          {isWinner && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                              <Award className="w-3.5 h-3.5" />
                              WINNER (SIMULATED)
                            </span>
                          )}
                          {isRunnerUp && (
                            <span className="text-xs font-semibold text-slate-600">
                              · Runner-Up
                            </span>
                          )}
                          {isLeading && (
                            <span className="text-xs font-bold text-amber-800">
                              · LEADING (Counting Ongoing)
                            </span>
                          )}
                          {isTiedTop && (
                            <span className="text-xs font-bold text-red-700">
                              · TIED FOR FIRST
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                          <img
                            src={symbol}
                            alt={cand.snapshotPartyAbbr}
                            referrerPolicy="no-referrer"
                            className="w-4 h-4 object-contain"
                          />
                          <span>
                            {partyObj?.name ||
                              partyObj?.partyName ||
                              'Independent'}{' '}
                            ({cand.snapshotPartyAbbr || partyObj?.abbreviation || 'IND'})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:w-72 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="font-bold text-slate-900">
                          {cand.totalVotes.toLocaleString('en-IN')} votes
                        </span>
                        <span className="text-slate-600">
                          {cand.votePercentage}% total ({cand.validVotePercentage}% valid)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-md overflow-hidden">
                        <div
                          className={`h-full ${
                            isWinner
                              ? 'bg-emerald-600'
                              : isLeading
                              ? 'bg-amber-500'
                              : 'bg-[#002868]'
                          }`}
                          style={{
                            width: `${Math.min(100, Number(cand.votePercentage || 0))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* NOTA Row (Explicitly included in vote accounting, never treated as candidate/winner) */}
              <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70">
                <div className="flex items-center gap-4">
                  <span className="w-7 text-xs font-bold text-slate-400 font-mono">
                    —
                  </span>
                  <img
                    src={notaImg}
                    alt="NOTA"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-800">
                      None of the Above (NOTA)
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <img
                        src={notaLogo}
                        alt="NOTA Symbol"
                        referrerPolicy="no-referrer"
                        className="w-4 h-4 object-contain"
                      />
                      <span>
                        Ballot Rejection Option · Not eligible for seat allocation
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sm:w-72 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="font-bold text-slate-800">
                      {(standings?.notaVotes || 0).toLocaleString('en-IN')} votes
                    </span>
                    <span className="text-slate-600">
                      {standings?.notaPercentage || 0}% of total counted
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-slate-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Number(standings?.notaPercentage || 0)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Round-by-Round Progression Chart & Table */}
          <CumulativeRoundLineChart
            rounds={resultRecord.rounds || []}
            candidates={standings?.candidates || []}
            totalConfiguredVotes={resultRecord.totalConfiguredVotes}
          />
        </>
      )}
    </div>
  );
}
