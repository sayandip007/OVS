import {
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  METADATA_SOURCES,
  RESULT_STATUSES,
} from '../utils/constants';

/**
 * Deterministic hash helper for reproducible round simulation.
 * Never uses Math.random().
 */
export function deterministicHash(inputString) {
  const str = String(inputString || '');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

/**
 * Formats a percentage to 2 decimal places as a number.
 */
export function roundPercentage(numerator, denominator) {
  const num = Number(numerator) || 0;
  const den = Number(denominator) || 0;
  if (den <= 0 || num <= 0) return 0;
  return Number(((num / den) * 100).toFixed(2));
}

/**
 * Calculates candidate standings, vote shares, leading candidate,
 * winner, runner-up, victory margin, and tie detection.
 *
 * Rules:
 * - NOTA is included in totalCountedVotes denominator for total ballot share,
 *   and validCandidateVotes is tracked separately for valid candidate share.
 * - NOTA is never treated as a candidate or party and can never lead or win a seat.
 * - Winner & runner-up are ONLY declared when counting is completed.
 * - If there is a tie for highest final vote total (> 0), isTied = true and winnerCandidateId = null.
 */
export function calculateConstituencyStandings({
  candidates = [],
  notaVotes = 0,
  isCompleted = false,
}) {
  const cleanNota = Math.max(0, Math.trunc(Number(notaVotes) || 0));
  const normalizedCandidates = candidates.map((c) => ({
    ...c,
    totalVotes: Math.max(0, Math.trunc(Number(c.totalVotes) || 0)),
  }));

  const validCandidateVotes = normalizedCandidates.reduce(
    (sum, c) => sum + c.totalVotes,
    0
  );
  const totalCountedVotes = validCandidateVotes + cleanNota;

  // Sort contesting candidates descending by totalVotes, tie-break deterministically by candidateId for display order only
  const sorted = [...normalizedCandidates].sort((a, b) => {
    if (b.totalVotes !== a.totalVotes) {
      return b.totalVotes - a.totalVotes;
    }
    return String(a.candidateId).localeCompare(String(b.candidateId));
  });

  const highestVotes = sorted[0]?.totalVotes || 0;
  const topTiedCandidates =
    highestVotes > 0
      ? sorted.filter((c) => c.totalVotes === highestVotes)
      : [];
  const isTied = topTiedCandidates.length > 1;

  const rankedCandidates = sorted.map((c, idx) => ({
    ...c,
    votePercentage: roundPercentage(c.totalVotes, totalCountedVotes),
    validVotePercentage: roundPercentage(c.totalVotes, validCandidateVotes),
    rank: idx + 1,
  }));

  const notaPercentage = roundPercentage(cleanNota, totalCountedVotes);

  const first = rankedCandidates[0] || null;
  const second = rankedCandidates[1] || null;

  const leadingCandidateId =
    !isTied && first && first.totalVotes > 0 ? first.candidateId : null;
  const leadingMargin =
    !isTied && first && first.totalVotes > 0
      ? second
        ? Math.max(0, first.totalVotes - second.totalVotes)
        : first.totalVotes
      : 0;

  let winnerCandidateId = null;
  let runnerUpCandidateId = null;
  let victoryMargin = null;
  let winningPercentage = null;

  if (isCompleted && totalCountedVotes > 0) {
    if (isTied) {
      winnerCandidateId = null;
      runnerUpCandidateId = null;
      victoryMargin = 0;
      winningPercentage = roundPercentage(highestVotes, totalCountedVotes);
    } else if (first && first.totalVotes > 0) {
      winnerCandidateId = first.candidateId;
      runnerUpCandidateId = second ? second.candidateId : null;
      victoryMargin = second
        ? Math.max(0, first.totalVotes - second.totalVotes)
        : first.totalVotes;
      winningPercentage = first.votePercentage;
    }
  }

  return {
    candidates: rankedCandidates,
    validCandidateVotes,
    notaVotes: cleanNota,
    notaPercentage,
    totalCountedVotes,
    leadingCandidateId,
    leadingMargin,
    winnerCandidateId,
    runnerUpCandidateId,
    victoryMargin,
    winningPercentage,
    isTied,
    tiedCandidateIds: isTied ? topTiedCandidates.map((c) => c.candidateId) : [],
    requiresResolution: Boolean(isCompleted && isTied),
  };
}

/**
 * Reusable Result Data Validation (Phase 6 Section 4).
 * Validates all 12 rules:
 * 1. Election exists.
 * 2. Election type is valid (LOK_SABHA or STATE_ASSEMBLY).
 * 3. Constituency belongs to the election and matches type.
 * 4. Candidate belongs to the same election.
 * 5. Candidate belongs to the same constituency.
 * 6. Party references are valid.
 * 7. Vote totals are non-negative integers.
 * 8. Vote percentages are calculated correctly.
 * 9. Candidate totals (+ NOTA) do not exceed configured constituency totals.
 * 10. Counting rounds are sequential without duplicates and cumulative totals never decrease.
 * 11. Completed/Published result cannot be modified without explicit correction flag.
 * 12. Winner calculation is based on final candidate totals only (never declared before completion).
 */
export function validateResultRecord(
  resultInput,
  {
    elections = [],
    constituencies = [],
    candidates = [],
    parties = [],
    existingResult = null,
    allowCorrection = false,
  } = {}
) {
  const errors = [];

  if (!resultInput || typeof resultInput !== 'object') {
    return {
      isValid: false,
      ok: false,
      errors: ['Result payload must be a valid object.'],
    };
  }

  // Rule 11: Completed/Published modification guard
  if (
    existingResult &&
    [
      RESULT_STATUSES.COUNTING_COMPLETED,
      RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
      RESULT_STATUSES.PUBLISHED,
      RESULT_STATUSES.CORRECTED,
    ].includes(existingResult.status) &&
    !allowCorrection
  ) {
    errors.push(
      `Result record ${existingResult.id} has completed counting (${existingResult.status}) and cannot be modified without an explicit administrative correction workflow.`
    );
  }

  // Rule 1: Election exists
  const election = elections.find(
    (e) => (e.id || e.electionId) === resultInput.electionId
  );
  if (!election) {
    errors.push(`Invalid election ID: "${resultInput.electionId}" does not exist.`);
  }

  // Rule 2: Election type is valid
  const electionType =
    resultInput.electionType || election?.type || election?.electionType;
  if (
    electionType !== ELECTION_TYPES.LOK_SABHA &&
    electionType !== ELECTION_TYPES.STATE_ASSEMBLY
  ) {
    errors.push(
      `Invalid election type "${electionType}". Expected LOK_SABHA or STATE_ASSEMBLY.`
    );
  }

  if (
    election &&
    resultInput.electionType &&
    (election.type || election.electionType) !== resultInput.electionType
  ) {
    errors.push(
      `Election type mismatch: Election ${resultInput.electionId} is ${
        election.type || election.electionType
      }, not ${resultInput.electionType}.`
    );
  }

  // Rule 3: Constituency belongs to the election
  const constituency = constituencies.find(
    (c) => (c.id || c.constituencyId) === resultInput.constituencyId
  );
  if (!constituency) {
    errors.push(
      `Invalid constituency ID: "${resultInput.constituencyId}" does not exist.`
    );
  } else if (election) {
    const cType = constituency.type || constituency.constituencyType;
    const expectedType =
      (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA
        ? CONSTITUENCY_TYPES.PARLIAMENTARY
        : CONSTITUENCY_TYPES.ASSEMBLY;

    if (cType !== expectedType) {
      errors.push(
        `Constituency ${resultInput.constituencyId} (${cType}) does not match election type ${
          election.type || election.electionType
        }.`
      );
    }

    if (
      (election.type || election.electionType) ===
        ELECTION_TYPES.STATE_ASSEMBLY &&
      election.stateId &&
      constituency.stateId !== election.stateId
    ) {
      errors.push(
        `Constituency ${resultInput.constituencyId} belongs to state ${constituency.stateId}, not election state ${election.stateId}.`
      );
    }

    if (
      Array.isArray(election.constituencyIds) &&
      election.constituencyIds.length > 0 &&
      !election.constituencyIds.includes(resultInput.constituencyId)
    ) {
      errors.push(
        `Constituency ${resultInput.constituencyId} is not configured in election ${resultInput.electionId}.`
      );
    }
  }

  // Rule 7: Vote totals are non-negative integers
  const totalConfiguredVotes = Number(resultInput.totalConfiguredVotes ?? 15000);
  if (
    !Number.isInteger(totalConfiguredVotes) ||
    totalConfiguredVotes < 0
  ) {
    errors.push('totalConfiguredVotes must be a non-negative integer.');
  }

  const notaVotes = Number(resultInput.notaVotes ?? 0);
  if (!Number.isInteger(notaVotes) || notaVotes < 0) {
    errors.push('notaVotes must be a non-negative integer.');
  }

  const inputCandidates = Array.isArray(resultInput.candidates)
    ? resultInput.candidates
    : [];

  let sumCandidateVotes = 0;

  for (const candEntry of inputCandidates) {
    if (candEntry.candidateId === 'NOTA') {
      errors.push(
        'NOTA must not be listed as a candidate record; track NOTA in notaVotes.'
      );
      continue;
    }

    const masterCand = candidates.find(
      (c) => (c.id || c.candidateId) === candEntry.candidateId
    );
    if (!masterCand) {
      errors.push(
        `Candidate "${candEntry.candidateId}" does not exist in candidate registry.`
      );
      continue;
    }

    // Rule 4: Candidate belongs to the same election
    if (masterCand.electionId !== resultInput.electionId) {
      errors.push(
        `Candidate "${candEntry.candidateId}" belongs to election "${masterCand.electionId}", not "${resultInput.electionId}".`
      );
    }

    // Rule 5: Candidate belongs to the same constituency
    if (masterCand.constituencyId !== resultInput.constituencyId) {
      errors.push(
        `Candidate "${candEntry.candidateId}" belongs to constituency "${masterCand.constituencyId}", not "${resultInput.constituencyId}".`
      );
    }

    // Rule 6: Party reference is valid
    const partyId = candEntry.partyId || masterCand.partyId;
    if (partyId && parties.length > 0) {
      const partyExists = parties.some(
        (p) => (p.id || p.partyId) === partyId
      );
      if (!partyExists) {
        errors.push(
          `Invalid party ID "${partyId}" for candidate "${candEntry.candidateId}".`
        );
      }
    }

    // Rule 7: Non-negative integer vote total
    const cVotes = Number(candEntry.totalVotes);
    if (!Number.isInteger(cVotes) || cVotes < 0) {
      errors.push(
        `Vote total for candidate "${candEntry.candidateId}" must be a non-negative integer (received ${candEntry.totalVotes}).`
      );
    } else {
      sumCandidateVotes += cVotes;
    }
  }

  const totalCounted = sumCandidateVotes + (Number.isInteger(notaVotes) && notaVotes >= 0 ? notaVotes : 0);

  // Rule 8: Vote percentages check (if provided explicitly and totalCounted > 0)
  if (totalCounted > 0) {
    for (const candEntry of inputCandidates) {
      if (
        candEntry.votePercentage !== undefined &&
        candEntry.votePercentage !== null &&
        Number.isInteger(Number(candEntry.totalVotes)) &&
        Number(candEntry.totalVotes) >= 0
      ) {
        const expectedPct = roundPercentage(
          Number(candEntry.totalVotes),
          totalCounted
        );
        if (Math.abs(Number(candEntry.votePercentage) - expectedPct) > 0.15) {
          errors.push(
            `Vote percentage mismatch for candidate "${candEntry.candidateId}": expected ${expectedPct}%, received ${candEntry.votePercentage}%.`
          );
        }
      }
    }
  }

  // Rule 9: Totals do not exceed configured constituency totals
  if (
    Number.isInteger(totalConfiguredVotes) &&
    totalConfiguredVotes >= 0 &&
    totalCounted > totalConfiguredVotes
  ) {
    errors.push(
      `Total counted votes (${totalCounted}) exceed configured constituency limit (${totalConfiguredVotes}).`
    );
  }

  // Rule 10: Counting rounds are sequential and cumulative totals never decrease
  const rounds = Array.isArray(resultInput.rounds) ? resultInput.rounds : [];
  const seenRoundNumbers = new Set();
  const prevCumulativeByCand = {};
  let prevRoundTotal = 0;

  for (let i = 0; i < rounds.length; i += 1) {
    const r = rounds[i];
    const rNum = Number(r.roundNumber);
    if (!Number.isInteger(rNum) || rNum !== i + 1) {
      errors.push(
        `Counting rounds must be sequential starting at 1. Expected round ${
          i + 1
        }, found ${r.roundNumber}.`
      );
    }
    if (seenRoundNumbers.has(rNum)) {
      errors.push(`Duplicate counting round number ${rNum} detected.`);
    }
    seenRoundNumbers.add(rNum);

    if (Number(r.totalVotesCounted) < prevRoundTotal) {
      errors.push(
        `Cumulative totalVotesCounted decreased in round ${rNum} (${r.totalVotesCounted} < ${prevRoundTotal}).`
      );
    }
    prevRoundTotal = Number(r.totalVotesCounted) || prevRoundTotal;

    for (const cv of r.candidateVotes || []) {
      const prevCum = prevCumulativeByCand[cv.candidateId] || 0;
      const curCum = Number(cv.cumulativeVotes ?? 0);
      if (curCum < prevCum) {
        errors.push(
          `Cumulative votes for candidate ${cv.candidateId} decreased in round ${rNum} (${curCum} < ${prevCum}).`
        );
      }
      prevCumulativeByCand[cv.candidateId] = curCum;
    }
  }

  // Rule 12: Winner cannot be declared before counting is completed
  const status = resultInput.status || RESULT_STATUSES.DRAFT;
  const incompleteStatuses = [
    RESULT_STATUSES.DRAFT,
    RESULT_STATUSES.COUNTING_IN_PROGRESS,
    RESULT_STATUSES.COUNTING_PAUSED,
  ];
  if (
    incompleteStatuses.includes(status) &&
    resultInput.winnerCandidateId !== null &&
    resultInput.winnerCandidateId !== undefined
  ) {
    errors.push(
      `Cannot declare a winner (${resultInput.winnerCandidateId}) while counting status is ${status}.`
    );
  }

  return {
    isValid: errors.length === 0,
    ok: errors.length === 0,
    error: errors[0] || null,
    errors,
  };
}

/**
 * Creates a new deterministic simulated counting session for a constituency in an election.
 */
export function createCountingSession({
  electionId,
  constituencyId,
  totalConfiguredVotes = 15000,
  totalConfiguredRounds = 3,
  elections = [],
  constituencies = [],
  candidates = [],
  parties = [],
  existingResults = [],
}) {
  const duplicate = existingResults.find(
    (r) => r.electionId === electionId && r.constituencyId === constituencyId
  );
  if (duplicate) {
    return {
      ok: false,
      error: `A result/counting session already exists for ${electionId} — ${constituencyId} (${duplicate.id}).`,
      result: duplicate,
    };
  }

  const election = elections.find(
    (e) => (e.id || e.electionId) === electionId
  );
  if (!election) {
    return { ok: false, error: `Election "${electionId}" not found.` };
  }

  const constituency = constituencies.find(
    (c) => (c.id || c.constituencyId) === constituencyId
  );
  if (!constituency) {
    return { ok: false, error: `Constituency "${constituencyId}" not found.` };
  }

  // Filter approved contesting candidates for this exact election & constituency
  const seatCandidates = candidates.filter((c) => {
    const status = c.status || c.approvalStatus || 'APPROVED';
    return (
      c.electionId === electionId &&
      c.constituencyId === constituencyId &&
      status === 'APPROVED'
    );
  });

  if (seatCandidates.length === 0) {
    return {
      ok: false,
      error: `No approved contesting candidates found for ${constituency.name} (${constituencyId}) in ${electionId}.`,
    };
  }

  const candidateRecords = seatCandidates.map((c, idx) => {
    const party = parties.find((p) => (p.id || p.partyId) === c.partyId);
    return {
      candidateId: c.id || c.candidateId,
      partyId: c.partyId || 'PARTY-IND',
      totalVotes: 0,
      votePercentage: 0,
      validVotePercentage: 0,
      rank: idx + 1,
      snapshotName: c.name,
      snapshotPartyAbbr: party?.abbreviation || 'IND',
    };
  });

  const cleanConfigured = Math.max(
    100,
    Math.trunc(Number(totalConfiguredVotes) || 15000)
  );
  const cleanRounds = Math.max(
    1,
    Math.min(10, Math.trunc(Number(totalConfiguredRounds) || 3))
  );

  const newRecord = {
    id: `RESULT-${electionId}-${constituencyId}`,
    resultId: `RESULT-${electionId}-${constituencyId}`,
    electionId,
    electionType: election.type || election.electionType,
    electionYear: Number(election.year) || 2029,
    stateId: constituency.stateId || election.stateId || 'IN',
    constituencyId,
    status: RESULT_STATUSES.DRAFT,
    countingStatus: 'NOT_STARTED',
    totalConfiguredVotes: cleanConfigured,
    totalEligibleDemoVoters: Math.round(cleanConfigured * 1.25),
    totalCountedVotes: 0,
    validCandidateVotes: 0,
    notaVotes: 0,
    notaPercentage: 0,
    currentRound: 0,
    totalConfiguredRounds: cleanRounds,
    candidates: candidateRecords,
    rounds: [],
    leadingCandidateId: null,
    winnerCandidateId: null,
    runnerUpCandidateId: null,
    victoryMargin: null,
    winningPercentage: null,
    isTied: false,
    tiedCandidateIds: [],
    publishedAt: null,
    publishedBy: null,
    correctionHistory: [],
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  };

  const validation = validateResultRecord(newRecord, {
    elections,
    constituencies,
    candidates,
    parties,
  });

  if (!validation.isValid) {
    return {
      ok: false,
      error: validation.errors[0],
      errors: validation.errors,
    };
  }

  return { ok: true, result: newRecord };
}

/**
 * Generates deterministic vote increments for a counting round so results are
 * 100% reproducible without Math.random().
 */
export function generateDeterministicRoundIncrements(resultRecord, roundNumber) {
  const totalConfigured = Math.max(
    0,
    Number(resultRecord.totalConfiguredVotes) || 15000
  );
  const totalRounds = Math.max(
    1,
    Number(resultRecord.totalConfiguredRounds) || 3
  );
  const alreadyCounted = Math.max(
    0,
    Number(resultRecord.totalCountedVotes) || 0
  );
  const remainingConfigurable = Math.max(0, totalConfigured - alreadyCounted);

  // Target ~88% of configured votes across all rounds so totalCountedVotes never exceeds totalConfiguredVotes
  const targetTotalPolled = Math.floor(totalConfigured * 0.88);
  const targetPerRound = Math.min(
    remainingConfigurable,
    Math.floor(targetTotalPolled / totalRounds)
  );

  const candidates = resultRecord.candidates || [];
  if (candidates.length === 0 || targetPerRound <= 0) {
    return {
      candidateIncrements: {},
      notaIncrement: 0,
    };
  }

  const notaIncrement = Math.min(
    remainingConfigurable,
    Math.max(1, Math.floor(targetPerRound * 0.02))
  );
  const distributable = Math.max(0, targetPerRound - notaIncrement);

  const weights = candidates.map((c, idx) => {
    const h = deterministicHash(
      `${resultRecord.electionId}::${resultRecord.constituencyId}::${c.candidateId}::R${roundNumber}`
    );
    // Give descending base weight by candidate order + deterministic offset
    const baseWeight = Math.max(15, 100 - idx * 22);
    const variation = (h % 19) - 9; // -9 to +9
    return Math.max(10, baseWeight + variation);
  });

  const weightSum = weights.reduce((a, b) => a + b, 0);
  const candidateIncrements = {};
  let allocated = 0;

  candidates.forEach((c, idx) => {
    if (idx === candidates.length - 1) {
      candidateIncrements[c.candidateId] = Math.max(0, distributable - allocated);
    } else {
      const share = Math.floor((distributable * weights[idx]) / weightSum);
      candidateIncrements[c.candidateId] = share;
      allocated += share;
    }
  });

  return {
    candidateIncrements,
    notaIncrement,
  };
}

/**
 * Starts a counting session (transitions DRAFT -> COUNTING_IN_PROGRESS).
 */
export function startCountingSession(resultRecord) {
  if (!resultRecord) {
    return { ok: false, error: 'Result record is required.' };
  }
  if (
    [
      RESULT_STATUSES.COUNTING_COMPLETED,
      RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
      RESULT_STATUSES.PUBLISHED,
      RESULT_STATUSES.CORRECTED,
    ].includes(resultRecord.status)
  ) {
    return {
      ok: false,
      error: `Counting session for ${resultRecord.constituencyId} is already completed (${resultRecord.status}).`,
    };
  }

  return {
    ok: true,
    result: {
      ...resultRecord,
      status: RESULT_STATUSES.COUNTING_IN_PROGRESS,
      countingStatus: 'IN_PROGRESS',
      winnerCandidateId: null,
      runnerUpCandidateId: null,
      victoryMargin: null,
      winningPercentage: null,
    },
  };
}

/**
 * Pauses an active counting session.
 */
export function pauseCountingSession(resultRecord) {
  if (!resultRecord) {
    return { ok: false, error: 'Result record is required.' };
  }
  if (resultRecord.status !== RESULT_STATUSES.COUNTING_IN_PROGRESS) {
    return {
      ok: false,
      error: `Cannot pause session in status "${resultRecord.status}". Session must be COUNTING_IN_PROGRESS.`,
    };
  }

  return {
    ok: true,
    result: {
      ...resultRecord,
      status: RESULT_STATUSES.COUNTING_PAUSED,
      countingStatus: 'PAUSED',
    },
  };
}

/**
 * Resumes a paused counting session.
 */
export function resumeCountingSession(resultRecord) {
  if (!resultRecord) {
    return { ok: false, error: 'Result record is required.' };
  }
  if (resultRecord.status !== RESULT_STATUSES.COUNTING_PAUSED) {
    return {
      ok: false,
      error: `Cannot resume session in status "${resultRecord.status}". Session must be COUNTING_PAUSED.`,
    };
  }

  return {
    ok: true,
    result: {
      ...resultRecord,
      status: RESULT_STATUSES.COUNTING_IN_PROGRESS,
      countingStatus: 'IN_PROGRESS',
    },
  };
}

/**
 * Processes the next sequential counting round.
 * Prevents duplicate rounds, prevents decreasing cumulative totals, and
 * ensures total counted votes do not exceed totalConfiguredVotes.
 */
export function processNextCountingRound(resultRecord, customRoundData = null) {
  if (!resultRecord) {
    return { ok: false, error: 'Result record is required.' };
  }

  if (resultRecord.status === RESULT_STATUSES.COUNTING_PAUSED) {
    return {
      ok: false,
      error: 'Counting is currently paused. Resume the counting session before processing the next round.',
    };
  }

  if (
    [
      RESULT_STATUSES.COUNTING_COMPLETED,
      RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
      RESULT_STATUSES.PUBLISHED,
      RESULT_STATUSES.CORRECTED,
      RESULT_STATUSES.TIED,
    ].includes(resultRecord.status)
  ) {
    return {
      ok: false,
      error: `Cannot process additional rounds when status is ${resultRecord.status}.`,
    };
  }

  const existingRounds = Array.isArray(resultRecord.rounds)
    ? resultRecord.rounds
    : [];
  const nextRoundNumber = existingRounds.length + 1;
  const maxRounds = Number(resultRecord.totalConfiguredRounds) || 3;

  // Check if a specific roundNumber was passed in customRoundData to prevent duplicate round processing
  if (
    customRoundData &&
    customRoundData.roundNumber !== undefined &&
    Number(customRoundData.roundNumber) !== nextRoundNumber
  ) {
    const alreadyExists = existingRounds.some(
      (r) => Number(r.roundNumber) === Number(customRoundData.roundNumber)
    );
    if (alreadyExists) {
      return {
        ok: false,
        error: `Round ${customRoundData.roundNumber} has already been counted. Duplicate round processing is not permitted.`,
      };
    }
    return {
      ok: false,
      error: `Out-of-sequence round number ${customRoundData.roundNumber}. Expected sequential round ${nextRoundNumber}.`,
    };
  }

  if (nextRoundNumber > maxRounds) {
    return {
      ok: false,
      error: `All ${maxRounds} configured counting rounds have already been processed. Complete the counting session to finalize results.`,
    };
  }

  const resolvedIncrements =
    customRoundData && customRoundData.candidateIncrements
      ? {
          candidateIncrements: customRoundData.candidateIncrements,
          notaIncrement: Number(customRoundData.notaIncrement ?? 0),
        }
      : generateDeterministicRoundIncrements(resultRecord, nextRoundNumber);

  const notaInc = Math.max(
    0,
    Math.trunc(Number(resolvedIncrements.notaIncrement) || 0)
  );
  if (Number(resolvedIncrements.notaIncrement || 0) < 0) {
    return {
      ok: false,
      error: 'Round NOTA increment cannot be negative.',
    };
  }

  const updatedCandidatesRaw = [];
  const roundCandidateVotes = [];
  let newlyCountedCandidateVotes = 0;

  for (const cand of resultRecord.candidates || []) {
    const rawInc =
      resolvedIncrements.candidateIncrements?.[cand.candidateId] ?? 0;
    const inc = Number(rawInc);
    if (!Number.isInteger(inc) || inc < 0) {
      return {
        ok: false,
        error: `Invalid round vote increment (${rawInc}) for candidate ${cand.candidateId}. Cumulative values must never decrease.`,
      };
    }

    const prevVotes = Math.max(0, Math.trunc(Number(cand.totalVotes) || 0));
    const nextCumulative = prevVotes + inc;
    newlyCountedCandidateVotes += inc;

    updatedCandidatesRaw.push({
      ...cand,
      totalVotes: nextCumulative,
    });

    roundCandidateVotes.push({
      candidateId: cand.candidateId,
      partyId: cand.partyId,
      roundVotes: inc,
      cumulativeVotes: nextCumulative,
    });
  }

  const newlyCountedVotes = newlyCountedCandidateVotes + notaInc;
  const nextNotaVotes =
    Math.max(0, Math.trunc(Number(resultRecord.notaVotes) || 0)) + notaInc;
  const nextTotalCounted =
    Math.max(0, Math.trunc(Number(resultRecord.totalCountedVotes) || 0)) +
    newlyCountedVotes;

  if (nextTotalCounted > Number(resultRecord.totalConfiguredVotes || 15000)) {
    return {
      ok: false,
      error: `Round ${nextRoundNumber} total (${nextTotalCounted}) would exceed configured constituency limit (${resultRecord.totalConfiguredVotes}).`,
    };
  }

  // Calculate interim standings (isCompleted = false so winnerCandidateId remains null during ongoing counting!)
  const standings = calculateConstituencyStandings({
    candidates: updatedCandidatesRaw,
    notaVotes: nextNotaVotes,
    isCompleted: false,
  });

  const roundRecord = {
    id: `ROUND-${String(nextRoundNumber).padStart(3, '0')}`,
    roundNumber: nextRoundNumber,
    newlyCountedVotes,
    totalVotesCounted: standings.totalCountedVotes,
    notaVotes: standings.notaVotes,
    leadingCandidateId: standings.leadingCandidateId,
    completedAt: new Date().toISOString(),
    candidateVotes: roundCandidateVotes,
  };

  const updatedResult = {
    ...resultRecord,
    status: RESULT_STATUSES.COUNTING_IN_PROGRESS,
    countingStatus: 'IN_PROGRESS',
    currentRound: nextRoundNumber,
    totalCountedVotes: standings.totalCountedVotes,
    validCandidateVotes: standings.validCandidateVotes,
    notaVotes: standings.notaVotes,
    notaPercentage: standings.notaPercentage,
    candidates: standings.candidates,
    rounds: [...existingRounds, roundRecord],
    leadingCandidateId: standings.leadingCandidateId,
    winnerCandidateId: null,
    runnerUpCandidateId: null,
    victoryMargin: null,
    winningPercentage: null,
    isTied: standings.isTied,
    tiedCandidateIds: standings.tiedCandidateIds,
  };

  return {
    ok: true,
    round: roundRecord,
    result: updatedResult,
  };
}

/**
 * Completes the counting session and computes the final winner, runner-up,
 * victory margin, winning percentage, or tie status.
 */
export function completeCountingSession(resultRecord, options = {}) {
  if (!resultRecord) {
    return { ok: false, error: 'Result record is required.' };
  }

  // If rounds are still remaining and fillRemainingRounds is true, process them deterministically first
  let working = { ...resultRecord };
  if (
    options.autoProcessRemainingRounds &&
    (working.rounds || []).length < (working.totalConfiguredRounds || 3)
  ) {
    if (working.status === RESULT_STATUSES.COUNTING_PAUSED) {
      working.status = RESULT_STATUSES.COUNTING_IN_PROGRESS;
    }
    while ((working.rounds || []).length < (working.totalConfiguredRounds || 3)) {
      const step = processNextCountingRound(working);
      if (!step.ok) return step;
      working = step.result;
    }
  }

  if ((working.rounds || []).length === 0 && working.totalCountedVotes === 0) {
    return {
      ok: false,
      error: 'Cannot complete counting before at least one counting round has been processed.',
    };
  }

  const standings = calculateConstituencyStandings({
    candidates: working.candidates,
    notaVotes: working.notaVotes,
    isCompleted: true,
  });

  const nextStatus = standings.isTied
    ? RESULT_STATUSES.TIED
    : options.readyForReview
    ? RESULT_STATUSES.RESULT_READY_FOR_REVIEW
    : RESULT_STATUSES.COUNTING_COMPLETED;

  const completedResult = {
    ...working,
    status: nextStatus,
    countingStatus: 'COMPLETED',
    totalCountedVotes: standings.totalCountedVotes,
    validCandidateVotes: standings.validCandidateVotes,
    notaVotes: standings.notaVotes,
    notaPercentage: standings.notaPercentage,
    candidates: standings.candidates,
    leadingCandidateId: standings.leadingCandidateId,
    winnerCandidateId: standings.winnerCandidateId,
    runnerUpCandidateId: standings.runnerUpCandidateId,
    victoryMargin: standings.victoryMargin,
    winningPercentage: standings.winningPercentage,
    isTied: standings.isTied,
    tiedCandidateIds: standings.tiedCandidateIds,
    requiresResolution: standings.requiresResolution,
    completedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    result: completedResult,
    summary: prepareResultSummary(completedResult),
  };
}

/**
 * Resets a demo counting session back to DRAFT (requires explicit confirmation).
 */
export function resetCountingSession(resultRecord, { confirmed = false } = {}) {
  if (!resultRecord) {
    return { ok: false, error: 'Result record is required.' };
  }
  if (!confirmed) {
    return {
      ok: false,
      requiresConfirmation: true,
      error: 'Resetting a demo counting session requires explicit confirmation.',
    };
  }

  const zeroedCandidates = (resultRecord.candidates || []).map((c, idx) => ({
    ...c,
    totalVotes: 0,
    votePercentage: 0,
    validVotePercentage: 0,
    rank: idx + 1,
  }));

  return {
    ok: true,
    result: {
      ...resultRecord,
      status: RESULT_STATUSES.DRAFT,
      countingStatus: 'NOT_STARTED',
      currentRound: 0,
      totalCountedVotes: 0,
      validCandidateVotes: 0,
      notaVotes: 0,
      notaPercentage: 0,
      candidates: zeroedCandidates,
      rounds: [],
      leadingCandidateId: null,
      winnerCandidateId: null,
      runnerUpCandidateId: null,
      victoryMargin: null,
      winningPercentage: null,
      isTied: false,
      tiedCandidateIds: [],
      requiresResolution: false,
      publishedAt: null,
      publishedBy: null,
    },
  };
}

/**
 * Prepares a clean summary of a constituency result record.
 */
export function prepareResultSummary(resultRecord, parties = [], candidates = []) {
  if (!resultRecord) return null;

  const isCompleted = [
    RESULT_STATUSES.COUNTING_COMPLETED,
    RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
    RESULT_STATUSES.PUBLISHED,
    RESULT_STATUSES.CORRECTED,
    RESULT_STATUSES.TIED,
  ].includes(resultRecord.status);

  const standings = calculateConstituencyStandings({
    candidates: resultRecord.candidates || [],
    notaVotes: resultRecord.notaVotes || 0,
    isCompleted,
  });

  const resolveCand = (cid) => {
    if (!cid) return null;
    const entry = standings.candidates.find((c) => c.candidateId === cid);
    const master = candidates.find((c) => (c.id || c.candidateId) === cid);
    const party = parties.find(
      (p) => (p.id || p.partyId) === (entry?.partyId || master?.partyId)
    );
    return {
      candidateId: cid,
      name: entry?.snapshotName || master?.name || cid,
      partyId: entry?.partyId || master?.partyId || 'PARTY-IND',
      partyName: party?.name || party?.partyName || 'Independent',
      partyAbbreviation:
        entry?.snapshotPartyAbbr || party?.abbreviation || 'IND',
      totalVotes: entry?.totalVotes || 0,
      votePercentage: entry?.votePercentage || 0,
    };
  };

  return {
    resultId: resultRecord.id,
    electionId: resultRecord.electionId,
    electionType: resultRecord.electionType,
    constituencyId: resultRecord.constituencyId,
    status: resultRecord.status,
    isCompleted,
    isPublished:
      resultRecord.status === RESULT_STATUSES.PUBLISHED ||
      resultRecord.status === RESULT_STATUSES.CORRECTED,
    isTied: standings.isTied,
    requiresResolution: standings.requiresResolution,
    totalConfiguredVotes: resultRecord.totalConfiguredVotes,
    totalCountedVotes: standings.totalCountedVotes,
    validCandidateVotes: standings.validCandidateVotes,
    remainingVotes: Math.max(
      0,
      (resultRecord.totalConfiguredVotes || 0) - standings.totalCountedVotes
    ),
    countingProgressPct: roundPercentage(
      standings.totalCountedVotes,
      resultRecord.totalConfiguredVotes || 1
    ),
    notaVotes: standings.notaVotes,
    notaPercentage: standings.notaPercentage,
    currentRound: resultRecord.currentRound || (resultRecord.rounds || []).length,
    totalConfiguredRounds: resultRecord.totalConfiguredRounds || 3,
    leadingCandidate: resolveCand(standings.leadingCandidateId),
    winnerCandidate: isCompleted ? resolveCand(standings.winnerCandidateId) : null,
    runnerUpCandidate: isCompleted
      ? resolveCand(standings.runnerUpCandidateId)
      : null,
    victoryMargin: isCompleted ? standings.victoryMargin : null,
    winningPercentage: isCompleted ? standings.winningPercentage : null,
    leadingMargin: standings.leadingMargin,
    publishedAt: resultRecord.publishedAt,
  };
}

/**
 * Transitions a result record through the publication workflow:
 * DRAFT -> COUNTING_IN_PROGRESS -> COUNTING_COMPLETED -> RESULT_READY_FOR_REVIEW -> PUBLISHED
 * Plus: TIED, UNDER_REVIEW, CORRECTED, UNPUBLISHED.
 */
export function transitionResultPublicationStatus(
  resultRecord,
  targetStatus,
  { adminId = 'ECI-ADMIN-001', notes = '' } = {}
) {
  if (!resultRecord) {
    return { ok: false, error: 'Result record is required.' };
  }

  if (targetStatus === RESULT_STATUSES.PUBLISHED) {
    const canPublishStatuses = [
      RESULT_STATUSES.COUNTING_COMPLETED,
      RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
      RESULT_STATUSES.UNDER_REVIEW,
      RESULT_STATUSES.UNPUBLISHED,
      RESULT_STATUSES.PUBLISHED,
      RESULT_STATUSES.CORRECTED,
    ];
    if (!canPublishStatuses.includes(resultRecord.status)) {
      return {
        ok: false,
        error: `Cannot publish result for ${resultRecord.constituencyId} while status is ${resultRecord.status}. Complete all counting rounds first.`,
      };
    }
    if (resultRecord.isTied || resultRecord.status === RESULT_STATUSES.TIED) {
      return {
        ok: false,
        error: `Cannot publish tied result for ${resultRecord.constituencyId} without administrative resolution.`,
      };
    }
    if ((resultRecord.totalCountedVotes || 0) <= 0) {
      return {
        ok: false,
        error: 'Cannot publish result with zero counted votes.',
      };
    }

    const standings = calculateConstituencyStandings({
      candidates: resultRecord.candidates,
      notaVotes: resultRecord.notaVotes,
      isCompleted: true,
    });

    const nowIso = new Date().toISOString();
    return {
      ok: true,
      result: {
        ...resultRecord,
        status: RESULT_STATUSES.PUBLISHED,
        countingStatus: 'COMPLETED',
        candidates: standings.candidates,
        winnerCandidateId: standings.winnerCandidateId,
        runnerUpCandidateId: standings.runnerUpCandidateId,
        victoryMargin: standings.victoryMargin,
        winningPercentage: standings.winningPercentage,
        publishedAt: nowIso,
        publishedBy: adminId,
        publicationNotes: notes || 'Published simulated demonstration result.',
      },
    };
  }

  if (targetStatus === RESULT_STATUSES.RESULT_READY_FOR_REVIEW) {
    if (
      ![
        RESULT_STATUSES.COUNTING_COMPLETED,
        RESULT_STATUSES.UNDER_REVIEW,
        RESULT_STATUSES.UNPUBLISHED,
        RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
      ].includes(resultRecord.status)
    ) {
      return {
        ok: false,
        error: `Result must have completed counting before moving to RESULT_READY_FOR_REVIEW (current: ${resultRecord.status}).`,
      };
    }
    return {
      ok: true,
      result: {
        ...resultRecord,
        status: RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
      },
    };
  }

  if (targetStatus === RESULT_STATUSES.UNPUBLISHED) {
    return {
      ok: true,
      result: {
        ...resultRecord,
        status: RESULT_STATUSES.UNPUBLISHED,
        publishedAt: null,
      },
    };
  }

  if (targetStatus === RESULT_STATUSES.UNDER_REVIEW) {
    return {
      ok: true,
      result: {
        ...resultRecord,
        status: RESULT_STATUSES.UNDER_REVIEW,
      },
    };
  }

  return {
    ok: true,
    result: {
      ...resultRecord,
      status: targetStatus,
    },
  };
}

/**
 * Applies an explicit administrative correction to a completed or published demo result.
 * Preserves full correction history, validates totals, and updates timestamp.
 */
export function applyAdminResultCorrection(
  resultRecord,
  {
    candidateVotesMap = {},
    notaVotes,
    reason = '',
    confirmed = false,
    adminId = 'ECI-ADMIN-001',
    adminName = 'ECI Officer',
  } = {}
) {
  if (!resultRecord) {
    return { ok: false, error: 'Result record is required.' };
  }
  if (!confirmed) {
    return {
      ok: false,
      requiresConfirmation: true,
      error: 'Modifying a completed or published result requires explicit confirmation.',
    };
  }
  if (!String(reason || '').trim()) {
    return {
      ok: false,
      error: 'A documented administrative reason is required for result correction.',
    };
  }

  const nextNota =
    notaVotes !== undefined ? Number(notaVotes) : Number(resultRecord.notaVotes || 0);
  if (!Number.isInteger(nextNota) || nextNota < 0) {
    return { ok: false, error: 'Corrected NOTA votes must be a non-negative integer.' };
  }

  const updatedCandidates = [];
  let sumCandidateVotes = 0;

  for (const c of resultRecord.candidates || []) {
    const nextVal =
      candidateVotesMap[c.candidateId] !== undefined
        ? Number(candidateVotesMap[c.candidateId])
        : Number(c.totalVotes || 0);

    if (!Number.isInteger(nextVal) || nextVal < 0) {
      return {
        ok: false,
        error: `Corrected vote total for ${c.candidateId} must be a non-negative integer.`,
      };
    }
    sumCandidateVotes += nextVal;
    updatedCandidates.push({
      ...c,
      totalVotes: nextVal,
    });
  }

  const nextTotalCounted = sumCandidateVotes + nextNota;
  if (nextTotalCounted > Number(resultRecord.totalConfiguredVotes || 15000)) {
    return {
      ok: false,
      error: `Corrected total votes (${nextTotalCounted}) cannot exceed configured constituency limit (${resultRecord.totalConfiguredVotes}).`,
    };
  }

  const standings = calculateConstituencyStandings({
    candidates: updatedCandidates,
    notaVotes: nextNota,
    isCompleted: true,
  });

  const nowIso = new Date().toISOString();
  const historyEntry = {
    id: `CORR-${(resultRecord.correctionHistory || []).length + 1}`,
    correctedAt: nowIso,
    adminId,
    adminName,
    reason: String(reason).trim(),
    previousStatus: resultRecord.status,
    previousTotalCountedVotes: resultRecord.totalCountedVotes,
    previousWinnerCandidateId: resultRecord.winnerCandidateId,
    previousCandidates: (resultRecord.candidates || []).map((c) => ({
      candidateId: c.candidateId,
      totalVotes: c.totalVotes,
    })),
    previousNotaVotes: resultRecord.notaVotes,
  };

  const wasPublished =
    resultRecord.status === RESULT_STATUSES.PUBLISHED ||
    resultRecord.status === RESULT_STATUSES.CORRECTED;

  const nextStatus = standings.isTied
    ? RESULT_STATUSES.TIED
    : wasPublished
    ? RESULT_STATUSES.CORRECTED
    : RESULT_STATUSES.RESULT_READY_FOR_REVIEW;

  return {
    ok: true,
    result: {
      ...resultRecord,
      status: nextStatus,
      countingStatus: 'COMPLETED',
      totalCountedVotes: standings.totalCountedVotes,
      validCandidateVotes: standings.validCandidateVotes,
      notaVotes: standings.notaVotes,
      notaPercentage: standings.notaPercentage,
      candidates: standings.candidates,
      leadingCandidateId: standings.leadingCandidateId,
      winnerCandidateId: standings.winnerCandidateId,
      runnerUpCandidateId: standings.runnerUpCandidateId,
      victoryMargin: standings.victoryMargin,
      winningPercentage: standings.winningPercentage,
      isTied: standings.isTied,
      tiedCandidateIds: standings.tiedCandidateIds,
      requiresResolution: standings.requiresResolution,
      publishedAt: wasPublished ? nowIso : resultRecord.publishedAt,
      updatedAt: nowIso,
      correctionHistory: [...(resultRecord.correctionHistory || []), historyEntry],
    },
    correctionEntry: historyEntry,
  };
}

/**
 * Filters results that are publicly visible.
 * Rule: Draft and unpublished candidate vote totals are NEVER exposed publicly.
 * Only PUBLISHED or CORRECTED results expose declared winner and candidate totals on public views.
 */
export function isResultPubliclyVisible(resultRecord) {
  if (!resultRecord) return false;
  return (
    resultRecord.status === RESULT_STATUSES.PUBLISHED ||
    resultRecord.status === RESULT_STATUSES.CORRECTED
  );
}

export function getPubliclyVisibleResults(results = []) {
  return (results || []).filter(isResultPubliclyVisible);
}

/**
 * Calculates Vote Share and Demo Turnout Metrics (Phase 6 Section 13).
 * Explicitly separates:
 * - Total votes counted (validCandidateVotes + notaVotes)
 * - Valid candidate votes
 * - NOTA votes
 * - Eligible demo voters
 * - Demo participation count
 */
export function calculateTurnoutMetrics({
  simulatedParticipationCount = 0,
  totalEligibleDemoVoters = 0,
  totalCountedVotes = 0,
  validCandidateVotes = 0,
  notaVotes = 0,
} = {}) {
  const partCount = Math.max(0, Math.trunc(Number(simulatedParticipationCount) || 0));
  const eligibleCount = Math.max(0, Math.trunc(Number(totalEligibleDemoVoters) || 0));
  const counted = Math.max(0, Math.trunc(Number(totalCountedVotes) || 0));
  const valid = Math.max(0, Math.trunc(Number(validCandidateVotes) || 0));
  const nota = Math.max(0, Math.trunc(Number(notaVotes) || 0));

  return {
    simulatedParticipationCount: partCount,
    totalEligibleDemoVoters: eligibleCount,
    demoTurnoutPercentage: roundPercentage(partCount, eligibleCount),
    totalCountedVotes: counted,
    validCandidateVotes: valid,
    notaVotes: nota,
    notaBallotSharePercentage: roundPercentage(nota, counted),
    validBallotSharePercentage: roundPercentage(valid, counted),
    calculationBasis: {
      demoTurnout: '(simulatedParticipationCount / totalEligibleDemoVoters) * 100',
      totalBallotVoteShare: '(candidateVotes / totalCountedVotes [including NOTA]) * 100',
      validCandidateVoteShare: '(candidateVotes / validCandidateVotes [excluding NOTA]) * 100',
    },
  };
}

/**
 * Computes Party-Wise Analytics for a given election (and optional state scope).
 * Rules:
 * - Never mixes Lok Sabha and State Assembly results.
 * - Never assigns Independent candidates ('PARTY-IND' or type === 'INDEPENDENT') to political parties;
 *   tracks Independents as a separate Independent row in overall seat totals.
 * - NOTA is tracked separately in vote accounting and never awarded seats.
 */
export function computePartyWiseAnalytics({
  electionId,
  stateId = 'ALL',
  results = [],
  parties = [],
  candidates = [],
  publicOnly = false,
} = {}) {
  const scopedResults = (results || []).filter((r) => {
    if (electionId && r.electionId !== electionId) return false;
    if (stateId && stateId !== 'ALL' && r.stateId !== stateId) return false;
    return true;
  });

  const activeResults = publicOnly
    ? scopedResults.filter(isResultPubliclyVisible)
    : scopedResults;

  const partyStatsMap = new Map();
  let totalValidCandidateVotes = 0;
  let totalNotaVotes = 0;
  let totalCountedVotes = 0;

  const ensurePartyBucket = (partyId) => {
    const pid = partyId || 'PARTY-IND';
    if (!partyStatsMap.has(pid)) {
      const pObj = parties.find((p) => (p.id || p.partyId) === pid);
      const isInd =
        pid === 'PARTY-IND' ||
        pObj?.type === 'INDEPENDENT' ||
        pObj?.abbreviation === 'IND';
      partyStatsMap.set(pid, {
        partyId: pid,
        partyName: isInd
          ? 'Independent Candidates'
          : pObj?.name || pObj?.partyName || pid,
        abbreviation: isInd ? 'IND' : pObj?.abbreviation || pid,
        symbolUrl: pObj?.symbol || pObj?.symbolUrl || null,
        isIndependent: isInd,
        seatsWon: 0,
        seatsLeading: 0,
        totalVotes: 0,
        voteShareTotalBallotPct: 0,
        voteShareValidPct: 0,
        constituenciesWon: [],
        constituenciesLeading: [],
      });
    }
    return partyStatsMap.get(pid);
  };

  for (const res of scopedResults) {
    const isPublished = isResultPubliclyVisible(res);
    const isCompleted = [
      RESULT_STATUSES.COUNTING_COMPLETED,
      RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
      RESULT_STATUSES.PUBLISHED,
      RESULT_STATUSES.CORRECTED,
    ].includes(res.status);
    const isCounting =
      res.status === RESULT_STATUSES.COUNTING_IN_PROGRESS ||
      res.status === RESULT_STATUSES.COUNTING_PAUSED;

    // On public views, only aggregate votes & seats from published results
    if (publicOnly && !isPublished) {
      continue;
    }

    const standings = calculateConstituencyStandings({
      candidates: res.candidates || [],
      notaVotes: res.notaVotes || 0,
      isCompleted,
    });

    totalValidCandidateVotes += standings.validCandidateVotes;
    totalNotaVotes += standings.notaVotes;
    totalCountedVotes += standings.totalCountedVotes;

    for (const cand of standings.candidates) {
      const masterCand = candidates.find(
        (mc) => (mc.id || mc.candidateId) === cand.candidateId
      );
      const pid = cand.partyId || masterCand?.partyId || 'PARTY-IND';
      const bucket = ensurePartyBucket(pid);
      bucket.totalVotes += cand.totalVotes;

      if (isCompleted && !standings.isTied && standings.winnerCandidateId === cand.candidateId) {
        bucket.seatsWon += 1;
        bucket.constituenciesWon.push(res.constituencyId);
      } else if (isCounting && !standings.isTied && standings.leadingCandidateId === cand.candidateId) {
        bucket.seatsLeading += 1;
        bucket.constituenciesLeading.push(res.constituencyId);
      }
    }
  }

  const partyRows = Array.from(partyStatsMap.values())
    .map((row) => ({
      ...row,
      voteShareTotalBallotPct: roundPercentage(row.totalVotes, totalCountedVotes),
      voteShareValidPct: roundPercentage(row.totalVotes, totalValidCandidateVotes),
    }))
    .sort((a, b) => {
      if (b.seatsWon !== a.seatsWon) return b.seatsWon - a.seatsWon;
      if (b.seatsLeading !== a.seatsLeading) return b.seatsLeading - a.seatsLeading;
      return b.totalVotes - a.totalVotes;
    });

  return {
    electionId,
    stateId,
    totalCountedVotes,
    totalValidCandidateVotes,
    totalNotaVotes,
    notaSharePct: roundPercentage(totalNotaVotes, totalCountedVotes),
    partyRows,
    configuredResultCount: activeResults.length,
  };
}

/**
 * Computes Lok Sabha National & State-Wise Results Analytics (Phase 6 Section 8).
 * Distinguishes configured result records from missing demo records (never counts missing records as 0-vote declared results).
 */
export function computeLokSabhaNationalAnalytics({
  electionId = 'LS-2029',
  results = [],
  elections = [],
  constituencies = [],
  candidates = [],
  parties = [],
  states = [],
  publicOnly = false,
} = {}) {
  const election =
    elections.find(
      (e) =>
        (e.id || e.electionId) === electionId &&
        (e.type || e.electionType) === ELECTION_TYPES.LOK_SABHA
    ) ||
    elections.find((e) => (e.type || e.electionType) === ELECTION_TYPES.LOK_SABHA);

  const targetElectionId = election ? election.id || election.electionId : electionId;

  const parliamentaryConstituencies = constituencies.filter(
    (c) => (c.type || c.constituencyType) === CONSTITUENCY_TYPES.PARLIAMENTARY
  );

  // Strictly filter only LOK_SABHA results for targetElectionId
  const lsResults = (results || []).filter(
    (r) =>
      r.electionId === targetElectionId &&
      r.electionType === ELECTION_TYPES.LOK_SABHA
  );

  const declaredResults = lsResults.filter((r) =>
    publicOnly
      ? isResultPubliclyVisible(r)
      : [
          RESULT_STATUSES.PUBLISHED,
          RESULT_STATUSES.CORRECTED,
          RESULT_STATUSES.COUNTING_COMPLETED,
          RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
        ].includes(r.status)
  );

  const countingInProgressResults = lsResults.filter((r) =>
    [
      RESULT_STATUSES.COUNTING_IN_PROGRESS,
      RESULT_STATUSES.COUNTING_PAUSED,
    ].includes(r.status)
  );

  const draftOrPendingResults = lsResults.filter((r) =>
    publicOnly
      ? !isResultPubliclyVisible(r) &&
        ![
          RESULT_STATUSES.COUNTING_IN_PROGRESS,
          RESULT_STATUSES.COUNTING_PAUSED,
        ].includes(r.status)
      : [
          RESULT_STATUSES.DRAFT,
          RESULT_STATUSES.UNPUBLISHED,
          RESULT_STATUSES.UNDER_REVIEW,
          RESULT_STATUSES.TIED,
        ].includes(r.status)
  );

  const partyAnalytics = computePartyWiseAnalytics({
    electionId: targetElectionId,
    results: lsResults,
    parties,
    candidates,
    publicOnly,
  });

  // State-wise breakdown for states that have configured parliamentary constituencies or results
  const stateSummaries = states
    .map((st) => {
      const stId = st.id || st.stateId;
      const statePCs = parliamentaryConstituencies.filter(
        (c) => c.stateId === stId
      );
      const stateResults = lsResults.filter((r) => r.stateId === stId);
      const stateDeclared = stateResults.filter((r) =>
        publicOnly
          ? isResultPubliclyVisible(r)
          : [
              RESULT_STATUSES.PUBLISHED,
              RESULT_STATUSES.CORRECTED,
              RESULT_STATUSES.COUNTING_COMPLETED,
              RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
            ].includes(r.status)
      );
      const stateCounting = stateResults.filter((r) =>
        [
          RESULT_STATUSES.COUNTING_IN_PROGRESS,
          RESULT_STATUSES.COUNTING_PAUSED,
        ].includes(r.status)
      );

      const partySeats = {};
      for (const r of stateDeclared) {
        const standings = calculateConstituencyStandings({
          candidates: r.candidates || [],
          notaVotes: r.notaVotes || 0,
          isCompleted: true,
        });
        if (!standings.isTied && standings.winnerCandidateId) {
          const winCand = standings.candidates.find(
            (c) => c.candidateId === standings.winnerCandidateId
          );
          const pAbbr = winCand?.snapshotPartyAbbr || winCand?.partyId || 'IND';
          partySeats[pAbbr] = (partySeats[pAbbr] || 0) + 1;
        }
      }

      return {
        stateId: stId,
        stateName: st.name || st.stateName,
        totalConfiguredPCs: statePCs.length,
        configuredDemoResultRecords: stateResults.length,
        missingDemoResultRecords: Math.max(0, statePCs.length - stateResults.length),
        declaredCount: stateDeclared.length,
        countingCount: stateCounting.length,
        pendingCount: Math.max(
          0,
          stateResults.length - stateDeclared.length - stateCounting.length
        ),
        partySeats,
      };
    })
    .filter((s) => s.configuredDemoResultRecords > 0 || s.totalConfiguredPCs > 0);

  return {
    electionId: targetElectionId,
    electionName: election?.name || election?.title || targetElectionId,
    totalParliamentaryConstituencies: parliamentaryConstituencies.length,
    configuredResultRecordsCount: lsResults.length,
    unconfiguredConstituenciesCount: Math.max(
      0,
      parliamentaryConstituencies.length - lsResults.length
    ),
    resultsDeclaredCount: declaredResults.length,
    countingInProgressCount: countingInProgressResults.length,
    resultsPendingCount: draftOrPendingResults.length,
    totalSimulatedVotesCounted: partyAnalytics.totalCountedVotes,
    totalNotaVotes: partyAnalytics.totalNotaVotes,
    partyRows: partyAnalytics.partyRows,
    stateSummaries,
    resultsWithData: stateSummaries.filter((s) => s.configuredDemoResultRecords > 0),
  };
}

/**
 * Computes State Assembly Results Analytics for a single state (Phase 6 Section 9).
 * Strictly keeps each state's Assembly election independent and never combines states.
 */
export function computeStateAssemblyAnalytics({
  electionId,
  stateId,
  results = [],
  elections = [],
  constituencies = [],
  candidates = [],
  parties = [],
  states = [],
  publicOnly = false,
} = {}) {
  const assemblyElections = elections.filter(
    (e) => (e.type || e.electionType) === ELECTION_TYPES.STATE_ASSEMBLY
  );

  const targetElection =
    (electionId &&
      assemblyElections.find((e) => (e.id || e.electionId) === electionId)) ||
    (stateId && assemblyElections.find((e) => e.stateId === stateId)) ||
    assemblyElections[0] ||
    null;

  const resolvedStateId = stateId || targetElection?.stateId || 'WB';
  const resolvedElectionId = targetElection
    ? targetElection.id || targetElection.electionId
    : electionId;

  const stateObj = states.find((s) => (s.id || s.stateId) === resolvedStateId);

  const stateAssemblyConstituencies = constituencies.filter(
    (c) =>
      (c.type || c.constituencyType) === CONSTITUENCY_TYPES.ASSEMBLY &&
      c.stateId === resolvedStateId
  );

  // Strictly filter STATE_ASSEMBLY results matching BOTH resolvedElectionId AND resolvedStateId
  const stateResults = (results || []).filter(
    (r) =>
      r.electionType === ELECTION_TYPES.STATE_ASSEMBLY &&
      r.stateId === resolvedStateId &&
      (!resolvedElectionId || r.electionId === resolvedElectionId)
  );

  const declaredResults = stateResults.filter((r) =>
    publicOnly
      ? isResultPubliclyVisible(r)
      : [
          RESULT_STATUSES.PUBLISHED,
          RESULT_STATUSES.CORRECTED,
          RESULT_STATUSES.COUNTING_COMPLETED,
          RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
        ].includes(r.status)
  );

  const countingInProgressResults = stateResults.filter((r) =>
    [
      RESULT_STATUSES.COUNTING_IN_PROGRESS,
      RESULT_STATUSES.COUNTING_PAUSED,
    ].includes(r.status)
  );

  const pendingResults = stateResults.filter((r) =>
    publicOnly
      ? !isResultPubliclyVisible(r) &&
        ![
          RESULT_STATUSES.COUNTING_IN_PROGRESS,
          RESULT_STATUSES.COUNTING_PAUSED,
        ].includes(r.status)
      : [
          RESULT_STATUSES.DRAFT,
          RESULT_STATUSES.UNPUBLISHED,
          RESULT_STATUSES.UNDER_REVIEW,
          RESULT_STATUSES.TIED,
        ].includes(r.status)
  );

  const partyAnalytics = computePartyWiseAnalytics({
    electionId: resolvedElectionId,
    stateId: resolvedStateId,
    results: stateResults,
    parties,
    candidates,
    publicOnly,
  });

  const constituencySummaries = stateResults.map((r) => {
    const seat = stateAssemblyConstituencies.find(
      (c) => (c.id || c.constituencyId) === r.constituencyId
    );
    const summary = prepareResultSummary(r, parties, candidates);
    return {
      ...summary,
      constituencyName: seat?.name || r.constituencyId,
      constituencyCode: seat?.code || r.constituencyId,
      stateId: resolvedStateId,
    };
  });

  return {
    stateId: resolvedStateId,
    stateName: stateObj?.name || stateObj?.stateName || resolvedStateId,
    electionId: resolvedElectionId,
    electionName:
      targetElection?.name ||
      targetElection?.title ||
      `${resolvedStateId} Assembly Election`,
    totalConfiguredACs: stateAssemblyConstituencies.length,
    configuredResultRecordsCount: stateResults.length,
    unconfiguredACsCount: Math.max(
      0,
      stateAssemblyConstituencies.length - stateResults.length
    ),
    resultsDeclaredCount: declaredResults.length,
    countingInProgressCount: countingInProgressResults.length,
    resultsPendingCount: pendingResults.length,
    totalSimulatedVotesCounted: partyAnalytics.totalCountedVotes,
    totalNotaVotes: partyAnalytics.totalNotaVotes,
    partyRows: partyAnalytics.partyRows,
    constituencySummaries,
  };
}

/**
 * Computes Simultaneous Election Results Overview (Phase 6 Section 10).
 * Pairs a Parliamentary Constituency (Lok Sabha) and an Assembly Constituency (State Assembly)
 * side by side while preserving 100% independent statuses, candidates, and vote totals.
 */
export function computeSimultaneousElectionOverview({
  stateId = 'WB',
  parliamentaryConstituencyId = 'WB-PC-KRISHNANAGAR',
  assemblyConstituencyId = 'WB-AC-KRISHNANAGAR-UTTAR',
  lokSabhaElectionId = 'LS-2029',
  assemblyElectionId,
  results = [],
  elections = [],
  constituencies = [],
  candidates = [],
  parties = [],
} = {}) {
  const lsResult = (results || []).find(
    (r) =>
      r.electionType === ELECTION_TYPES.LOK_SABHA &&
      r.constituencyId === parliamentaryConstituencyId &&
      (!lokSabhaElectionId || r.electionId === lokSabhaElectionId)
  );

  const acResult = (results || []).find(
    (r) =>
      r.electionType === ELECTION_TYPES.STATE_ASSEMBLY &&
      r.constituencyId === assemblyConstituencyId &&
      (!assemblyElectionId || r.electionId === assemblyElectionId)
  );

  const pcObj = constituencies.find(
    (c) => (c.id || c.constituencyId) === parliamentaryConstituencyId
  );
  const acObj = constituencies.find(
    (c) => (c.id || c.constituencyId) === assemblyConstituencyId
  );

  const lsElection = elections.find(
    (e) => (e.id || e.electionId) === (lsResult?.electionId || lokSabhaElectionId)
  );
  const acElection = elections.find(
    (e) =>
      (e.id || e.electionId) ===
        (acResult?.electionId || assemblyElectionId) ||
      ((e.type || e.electionType) === ELECTION_TYPES.STATE_ASSEMBLY &&
        e.stateId === stateId)
  );

  return {
    stateId,
    lokSabha: {
      electionId: lsResult?.electionId || lsElection?.id || lokSabhaElectionId,
      electionName: lsElection?.name || lsElection?.title || 'Lok Sabha General Election',
      electionType: ELECTION_TYPES.LOK_SABHA,
      constituencyId: parliamentaryConstituencyId,
      constituencyName: pcObj?.name || parliamentaryConstituencyId,
      status: lsResult?.status || 'UNCONFIGURED',
      summary: lsResult ? prepareResultSummary(lsResult, parties, candidates) : null,
      resultRecord: lsResult || null,
    },
    stateAssembly: {
      electionId:
        acResult?.electionId ||
        acElection?.id ||
        assemblyElectionId ||
        `${stateId}-ASSEMBLY-2029`,
      electionName:
        acElection?.name || acElection?.title || `${stateId} Assembly Election`,
      electionType: ELECTION_TYPES.STATE_ASSEMBLY,
      constituencyId: assemblyConstituencyId,
      constituencyName: acObj?.name || assemblyConstituencyId,
      status: acResult?.status || 'UNCONFIGURED',
      summary: acResult ? prepareResultSummary(acResult, parties, candidates) : null,
      resultRecord: acResult || null,
    },
  };
}

/**
 * CSV Cell Escaping & Formula-Injection Protection Helper (Phase 7 Section 9)
 * Neutralizes spreadsheet formula execution (=, +, -, @, \t, \r) while preserving plain "-" or negative numbers.
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  const trimmed = str.trimStart();
  const isFormulaRisk =
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('@') ||
    str.startsWith('\t') ||
    str.startsWith('\r') ||
    (trimmed.startsWith('-') &&
      trimmed !== '-' &&
      !/^-\d+(\.\d+)?%?$/.test(trimmed));

  if (isFormulaRisk) {
    str = `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvString(headers, rows) {
  const disclaimerRow = [
    '# DEMONSTRATION RESULTS — SIMULATED DATA ONLY (NOT OFFICIAL ECI RESULTS)',
  ];
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [disclaimerRow.join(','), headerLine, ...dataLines].join('\n');
}

/**
 * 1. Constituency Result CSV Export (Phase 6 Section 15)
 * Contains zero personally identifiable voter information.
 */
export function exportConstituencyResultCSV(
  resultRecord,
  { parties = [], candidates = [] } = {}
) {
  const headers = [
    'DataClassification',
    'ResultId',
    'ElectionId',
    'ElectionType',
    'StateId',
    'ConstituencyId',
    'ResultStatus',
    'Rank',
    'CandidateId',
    'CandidateName',
    'PartyId',
    'PartyAbbreviation',
    'SimulatedVotes',
    'VoteSharePercent',
    'StandingLabel',
  ];

  if (!resultRecord) {
    return buildCsvString(headers, []);
  }

  const isCompleted = [
    RESULT_STATUSES.COUNTING_COMPLETED,
    RESULT_STATUSES.RESULT_READY_FOR_REVIEW,
    RESULT_STATUSES.PUBLISHED,
    RESULT_STATUSES.CORRECTED,
  ].includes(resultRecord.status);

  const standings = calculateConstituencyStandings({
    candidates: resultRecord.candidates || [],
    notaVotes: resultRecord.notaVotes || 0,
    isCompleted,
  });

  const rows = standings.candidates.map((c) => {
    const master = candidates.find(
      (mc) => (mc.id || mc.candidateId) === c.candidateId
    );
    const party = parties.find((p) => (p.id || p.partyId) === c.partyId);
    let standingLabel = 'CONTESTING';
    if (standings.isTied && standings.tiedCandidateIds.includes(c.candidateId)) {
      standingLabel = 'TIED';
    } else if (isCompleted && standings.winnerCandidateId === c.candidateId) {
      standingLabel = 'WINNER';
    } else if (isCompleted && standings.runnerUpCandidateId === c.candidateId) {
      standingLabel = 'RUNNER_UP';
    } else if (!isCompleted && standings.leadingCandidateId === c.candidateId) {
      standingLabel = 'LEADING';
    }

    return [
      'DEMONSTRATION_RESULTS',
      resultRecord.id,
      resultRecord.electionId,
      resultRecord.electionType,
      resultRecord.stateId,
      resultRecord.constituencyId,
      resultRecord.status,
      c.rank,
      c.candidateId,
      c.snapshotName || master?.name || c.candidateId,
      c.partyId || 'PARTY-IND',
      c.snapshotPartyAbbr || party?.abbreviation || 'IND',
      c.totalVotes,
      c.votePercentage,
      standingLabel,
    ];
  });

  // Append NOTA row
  rows.push([
    'DEMONSTRATION_RESULTS',
    resultRecord.id,
    resultRecord.electionId,
    resultRecord.electionType,
    resultRecord.stateId,
    resultRecord.constituencyId,
    resultRecord.status,
    '-',
    'NOTA',
    'None of the Above (NOTA)',
    'NOTA',
    'NOTA',
    standings.notaVotes,
    standings.notaPercentage,
    'NOTA_OPTION',
  ]);

  return buildCsvString(headers, rows);
}

/**
 * 2. Party-Wise Result CSV Export
 */
export function exportPartyWiseResultCSV(partyAnalytics, constituencyScope = 'ALL') {
  const headers = [
    'DataClassification',
    'ElectionId',
    'StateScope',
    'ConstituencyId',
    'PartyId',
    'PartyName',
    'Abbreviation',
    'SeatsWon',
    'SeatsLeading',
    'SimulatedTotalVotes',
    'TotalBallotSharePercent',
    'ValidVoteSharePercent',
  ];

  const rows = (partyAnalytics?.partyRows || []).map((p) => [
    'DEMONSTRATION_RESULTS',
    partyAnalytics.electionId || 'ALL',
    partyAnalytics.stateId || 'ALL',
    constituencyScope,
    p.partyId,
    p.partyName,
    p.abbreviation,
    p.seatsWon,
    p.seatsLeading,
    p.totalVotes,
    p.voteShareTotalBallotPct,
    p.voteShareValidPct,
  ]);

  return buildCsvString(headers, rows);
}

/**
 * 3. State-Wise Result CSV Export
 */
export function exportStateWiseResultCSV(electionId, stateSummaries = []) {
  const headers = [
    'DataClassification',
    'ElectionId',
    'ConstituencyId',
    'StateId',
    'StateName',
    'TotalConfiguredConstituencies',
    'ConfiguredDemoResultRecords',
    'ResultsDeclared',
    'CountingInProgress',
    'ResultsPending',
  ];

  const rows = (stateSummaries || []).map((s) => [
    'DEMONSTRATION_RESULTS',
    electionId,
    `${s.stateId}-ALL`,
    s.stateId,
    s.stateName,
    s.totalConfiguredPCs ?? s.totalConfiguredACs ?? 0,
    s.configuredDemoResultRecords ?? 0,
    s.declaredCount ?? 0,
    s.countingCount ?? 0,
    s.pendingCount ?? 0,
  ]);

  return buildCsvString(headers, rows);
}

/**
 * 4. Lok Sabha National Summary CSV Export
 */
export function exportLokSabhaNationalSummaryCSV(nationalAnalytics, results = []) {
  const headers = [
    'DataClassification',
    'ElectionId',
    'ElectionType',
    'StateId',
    'ConstituencyId',
    'ResultStatus',
    'TotalConfiguredVotes',
    'TotalCountedVotes',
    'NotaVotes',
    'LeadingOrWinningCandidateId',
    'VictoryMargin',
  ];

  const lsResults = (results || []).filter(
    (r) =>
      r.electionId === nationalAnalytics?.electionId &&
      r.electionType === ELECTION_TYPES.LOK_SABHA
  );

  const rows = lsResults.map((r) => [
    'DEMONSTRATION_RESULTS',
    r.electionId,
    r.electionType,
    r.stateId,
    r.constituencyId,
    r.status,
    r.totalConfiguredVotes,
    r.totalCountedVotes,
    r.notaVotes,
    r.winnerCandidateId || r.leadingCandidateId || 'NONE',
    r.victoryMargin ?? 0,
  ]);

  return buildCsvString(headers, rows);
}

/**
 * 5. Assembly State Summary CSV Export
 */
export function exportAssemblyStateSummaryCSV(assemblyAnalytics) {
  const headers = [
    'DataClassification',
    'ElectionId',
    'StateId',
    'ConstituencyId',
    'ConstituencyName',
    'ResultStatus',
    'TotalCountedVotes',
    'NotaVotes',
    'WinnerOrLeaderName',
    'PartyAbbreviation',
    'VictoryMargin',
  ];

  const rows = (assemblyAnalytics?.constituencySummaries || []).map((c) => {
    const topPerson = c.winnerCandidate || c.leadingCandidate;
    return [
      'DEMONSTRATION_RESULTS',
      c.electionId,
      c.stateId,
      c.constituencyId,
      c.constituencyName,
      c.status,
      c.totalCountedVotes,
      c.notaVotes,
      topPerson?.name || 'Pending',
      topPerson?.partyAbbreviation || '-',
      c.victoryMargin ?? c.leadingMargin ?? 0,
    ];
  });

  return buildCsvString(headers, rows);
}

/**
 * Browser download trigger helper for CSV exports
 */
export function triggerCsvDownload(filename, csvContent) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export const countingService = {
  deterministicHash,
  roundPercentage,
  calculateConstituencyStandings,
  validateResultRecord,
  createCountingSession,
  generateDeterministicRoundIncrements,
  startCountingSession,
  pauseCountingSession,
  resumeCountingSession,
  processNextCountingRound,
  completeCountingSession,
  resetCountingSession,
  prepareResultSummary,
  transitionResultPublicationStatus,
  applyAdminResultCorrection,
  isResultPubliclyVisible,
  getPubliclyVisibleResults,
  calculateTurnoutMetrics,
  computePartyWiseAnalytics,
  computeLokSabhaNationalAnalytics,
  computeStateAssemblyAnalytics,
  computeSimultaneousElectionOverview,
  exportConstituencyResultCSV,
  exportPartyWiseResultCSV,
  exportStateWiseResultCSV,
  exportLokSabhaNationalSummaryCSV,
  exportAssemblyStateSummaryCSV,
  triggerCsvDownload,
};
