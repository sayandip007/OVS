import {
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  METADATA_SOURCES,
} from '../utils/constants';
import { validateElectionInput } from '../utils/validation';

export function createElectionRecord(input, existingElections = [], constituencies = []) {
  const normalized = {
    ...input,
    type: input.type || ELECTION_TYPES.LOK_SABHA,
    year: Number(input.year) || 2029,
    stateId:
      input.type === ELECTION_TYPES.LOK_SABHA
        ? null
        : input.stateId
        ? String(input.stateId).trim()
        : '',
    status: input.status || 'UPCOMING',
    nominationStartDate: input.nominationStartDate || null,
    nominationEndDate: input.nominationEndDate || null,
    pollingStartDate: input.pollingStartDate || null,
    pollingEndDate: input.pollingEndDate || null,
    resultDate: input.resultDate || null,
    description: input.description ? input.description.trim() : '',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  };

  if (!Array.isArray(normalized.constituencyIds) || normalized.constituencyIds.length === 0) {
    if (normalized.type === ELECTION_TYPES.LOK_SABHA) {
      normalized.constituencyIds = constituencies
        .filter((c) => c.type === CONSTITUENCY_TYPES.PARLIAMENTARY)
        .map((c) => c.id);
    } else if (normalized.type === ELECTION_TYPES.STATE_ASSEMBLY && normalized.stateId) {
      normalized.constituencyIds = constituencies
        .filter(
          (c) =>
            c.type === CONSTITUENCY_TYPES.ASSEMBLY &&
            c.stateId === normalized.stateId
        )
        .map((c) => c.id);
    } else {
      normalized.constituencyIds = [];
    }
  }

  const validation = validateElectionInput(normalized, constituencies);
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors };
  }

  const baseId =
    input.id && input.id.trim()
      ? input.id.trim().toUpperCase()
      : normalized.type === ELECTION_TYPES.LOK_SABHA
      ? `LS-${normalized.year}`
      : `${normalized.stateId}-ASSEMBLY-${normalized.year}`;

  let finalId = baseId;
  let counter = 2;
  while (existingElections.some((e) => e.id === finalId)) {
    finalId = `${baseId}-${counter}`;
    counter += 1;
  }

  const record = {
    ...normalized,
    id: finalId,
  };

  return { ok: true, election: record };
}

export function updateElectionRecord(electionId, updates, existingElections = [], constituencies = []) {
  const target = existingElections.find((e) => e.id === electionId);
  if (!target) {
    return { ok: false, errors: { id: 'Election not found.' } };
  }

  const merged = {
    ...target,
    ...updates,
    stateId:
      (updates.type || target.type) === ELECTION_TYPES.LOK_SABHA
        ? null
        : updates.stateId !== undefined
        ? updates.stateId
        : target.stateId,
  };

  const validation = validateElectionInput(merged, constituencies);
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors };
  }

  return { ok: true, election: merged };
}

/**
 * Records simulated participation for ONE specific election without touching any other election.
 * Strictly omits storing which candidate was selected in the voter's participation record (Rule 17).
 */
export function recordSimulatedParticipation({
  voter,
  electionId,
  constituencyId,
  selectedCandidateIdOrNota,
  tallies = {},
}) {
  if (!voter || !electionId || !constituencyId || !selectedCandidateIdOrNota) {
    return { ok: false, error: 'Missing required participation parameters.' };
  }

  const existingStatus = voter.elections?.[electionId]?.status;
  if (existingStatus === 'VOTED') {
    return { ok: false, error: 'Participation already completed for this election.' };
  }

  const updatedVoter = {
    ...voter,
    elections: {
      ...(voter.elections || {}),
      [electionId]: {
        status: 'VOTED',
        participatedAt: new Date().toISOString(),
      },
    },
  };

  const tallyKey = `${electionId}::${constituencyId}::${selectedCandidateIdOrNota}`;
  const updatedTallies = {
    ...tallies,
    [tallyKey]: (tallies[tallyKey] || 0) + 1,
  };

  return {
    ok: true,
    voter: updatedVoter,
    tallies: updatedTallies,
  };
}
