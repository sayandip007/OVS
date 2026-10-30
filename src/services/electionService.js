import {
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  METADATA_SOURCES,
} from '../utils/constants';
import { validateElectionInput } from '../utils/validation';

export function createElectionRecord(
  input,
  existingElections = [],
  constituencies = []
) {
  const normalized = {
    ...input,
    name: input.name || input.title || '',
    type: input.type || input.electionType || ELECTION_TYPES.LOK_SABHA,
    year: Number(input.year) || 2029,
    stateId:
      (input.type || input.electionType) === ELECTION_TYPES.LOK_SABHA
        ? null
        : input.stateId
        ? String(input.stateId).trim()
        : '',
    status: input.status || 'UPCOMING',
    nominationStartDate: input.nominationStartDate || null,
    nominationEndDate: input.nominationEndDate || null,
    pollingStartDate: input.pollingStartDate || input.pollingDate || null,
    pollingEndDate: input.pollingEndDate || input.pollingDate || null,
    resultDate: input.resultDate || null,
    description: input.description ? input.description.trim() : '',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  };

  if (
    !Array.isArray(normalized.constituencyIds) ||
    normalized.constituencyIds.length === 0
  ) {
    if (normalized.type === ELECTION_TYPES.LOK_SABHA) {
      normalized.constituencyIds = constituencies
        .filter(
          (c) =>
            (c.type || c.constituencyType) === CONSTITUENCY_TYPES.PARLIAMENTARY
        )
        .map((c) => c.id || c.constituencyId);
    } else if (
      normalized.type === ELECTION_TYPES.STATE_ASSEMBLY &&
      normalized.stateId
    ) {
      normalized.constituencyIds = constituencies
        .filter(
          (c) =>
            (c.type || c.constituencyType) === CONSTITUENCY_TYPES.ASSEMBLY &&
            c.stateId === normalized.stateId
        )
        .map((c) => c.id || c.constituencyId);
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
  while (existingElections.some((e) => (e.id || e.electionId) === finalId)) {
    finalId = `${baseId}-${counter}`;
    counter += 1;
  }

  const record = {
    ...normalized,
    id: finalId,
    electionId: finalId,
  };

  return { ok: true, election: record };
}

export function updateElectionRecord(
  electionId,
  updates,
  existingElections = [],
  constituencies = []
) {
  const target = existingElections.find(
    (e) => (e.id || e.electionId) === electionId
  );
  if (!target) {
    return { ok: false, errors: { id: 'Election not found.' } };
  }

  const nextType = updates.type || updates.electionType || target.type || target.electionType;
  const merged = {
    ...target,
    ...updates,
    name: updates.name || updates.title || target.name || target.title,
    type: nextType,
    stateId:
      nextType === ELECTION_TYPES.LOK_SABHA
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
 * Strictly omits storing which candidate or party was selected in the voter's participation record.
 * Generates a non-revealing demonstration participation reference (`referenceId`).
 */
export function recordSimulatedParticipation({
  voter,
  electionId,
  election,
  constituencyId,
  selectedCandidateIdOrNota,
  candidateOrNotaId,
  tallies = {},
}) {
  const targetElectionId = electionId || election?.id || election?.electionId;
  const resolvedConstituencyId =
    constituencyId ||
    ((election?.type || election?.electionType) === ELECTION_TYPES.LOK_SABHA
      ? voter?.parliamentaryConstituencyId
      : voter?.assemblyConstituencyId);

  if (!voter || !targetElectionId) {
    return { ok: false, error: 'Missing required participation parameters.' };
  }

  const existingStatus = voter.elections?.[targetElectionId]?.status;
  if (existingStatus === 'VOTED') {
    return {
      ok: false,
      error: 'Participation already completed for this election.',
    };
  }

  const voterCode = (voter.id || voter.voterId || 'VOTER').replace(/[^A-Z0-9]/gi, '');
  const cleanElectionCode = String(targetElectionId).replace(/[^A-Z0-9]/gi, '');
  const referenceId = `DEMO-REF-${cleanElectionCode}-${voterCode}`;

  const updatedVoter = {
    ...voter,
    elections: {
      ...(voter.elections || {}),
      [targetElectionId]: {
        status: 'VOTED',
        participated: true,
        participatedAt: new Date().toISOString(),
        referenceId,
      },
    },
  };

  const choice = selectedCandidateIdOrNota || candidateOrNotaId;
  let updatedTallies = { ...tallies };
  if (choice && resolvedConstituencyId) {
    const tallyKey = `${targetElectionId}::${resolvedConstituencyId}::${choice}`;
    updatedTallies = {
      ...tallies,
      [tallyKey]: (tallies[tallyKey] || 0) + 1,
    };
  }

  return {
    ok: true,
    voter: updatedVoter,
    tallies: updatedTallies,
    referenceId,
  };
}
