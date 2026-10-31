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
  const explicitId = (input.id || input.electionId || '').trim().toUpperCase();

  const normalized = {
    ...input,
    id: explicitId || undefined,
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
    scrutinyDate: input.scrutinyDate || null,
    withdrawalDeadline: input.withdrawalDeadline || null,
    pollingStartDate: input.pollingStartDate || input.pollingDate || null,
    pollingEndDate: input.pollingEndDate || input.pollingDate || null,
    countingDate: input.countingDate || null,
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

  const validation = validateElectionInput(
    normalized,
    constituencies,
    existingElections
  );
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors };
  }

  let finalId = explicitId;
  if (!finalId) {
    const baseId =
      normalized.type === ELECTION_TYPES.LOK_SABHA
        ? `LS-${normalized.year}`
        : `${normalized.stateId}-ASSEMBLY-${normalized.year}`;

    finalId = baseId;
    let counter = 2;
    while (existingElections.some((e) => (e.id || e.electionId) === finalId)) {
      finalId = `${baseId}-${counter}`;
      counter += 1;
    }
  }

  const record = {
    ...normalized,
    id: finalId,
    electionId: finalId,
    lifecycleHistory: Array.isArray(input.lifecycleHistory)
      ? input.lifecycleHistory
      : [
          {
            status: normalized.status,
            changedAt: new Date().toISOString(),
            note: 'Election record created in ECI Admin Portal',
          },
        ],
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

  const nextType =
    updates.type || updates.electionType || target.type || target.electionType;
  const merged = {
    ...target,
    ...updates,
    isUpdate: true,
    name: updates.name || updates.title || target.name || target.title,
    type: nextType,
    stateId:
      nextType === ELECTION_TYPES.LOK_SABHA
        ? null
        : updates.stateId !== undefined
        ? updates.stateId
        : target.stateId,
  };

  const validation = validateElectionInput(
    merged,
    constituencies,
    existingElections
  );
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors };
  }

  delete merged.isUpdate;
  return { ok: true, election: merged };
}

/**
 * Generates a non-sensitive demonstration participation reference that never
 * encodes candidate or party selection.
 * Format: DEMO-LS-000001 or DEMO-ASM-000001
 */
export function generateNonSensitiveDemoReference(electionId, electionType, voterId) {
  const isLS =
    electionType === ELECTION_TYPES.LOK_SABHA ||
    String(electionId || '').startsWith('LS');
  const prefix = isLS ? 'DEMO-LS' : 'DEMO-ASM';
  const numericDigits = String(voterId || '000001').replace(/\D/g, '');
  const paddedSeq = (numericDigits || '1').padStart(6, '0').slice(-6);
  return `${prefix}-${paddedSeq}`;
}

/**
 * Records simulated participation for ONE specific election without touching any other election.
 * Strictly omits storing which candidate or party was selected in the voter's participation record.
 * Generates both `demoReference` (e.g. `DEMO-LS-000001`) and `referenceId` (`DEMO-REF-...`).
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
  const targetElectionType =
    election?.type ||
    election?.electionType ||
    (String(targetElectionId || '').startsWith('LS')
      ? ELECTION_TYPES.LOK_SABHA
      : ELECTION_TYPES.STATE_ASSEMBLY);

  const resolvedConstituencyId =
    constituencyId ||
    (targetElectionType === ELECTION_TYPES.LOK_SABHA
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

  const voterCode = (voter.id || voter.voterId || 'VOTER001').replace(
    /[^A-Z0-9]/gi,
    ''
  );
  const cleanElectionCode = String(targetElectionId).replace(/[^A-Z0-9]/gi, '');
  const referenceId = `DEMO-REF-${cleanElectionCode}-${voterCode}`;
  const demoReference = generateNonSensitiveDemoReference(
    targetElectionId,
    targetElectionType,
    voter.id || voter.voterId
  );
  const participatedAt = new Date().toISOString();

  // PRIVACY REQUIREMENT: Never store candidateId, partyId, or ballot selection in voter.elections
  const updatedVoter = {
    ...voter,
    elections: {
      ...(voter.elections || {}),
      [targetElectionId]: {
        status: 'VOTED',
        participated: true,
        participatedAt,
        demoReference,
        referenceId,
      },
    },
  };

  // Optional aggregate tally increment (not linked to voter)
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
    demoReference,
    referenceId,
    participatedAt,
  };
}
