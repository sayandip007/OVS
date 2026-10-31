import {
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  NOTA_OPTION,
} from '../utils/constants';
import { isVoterEligibleForElection } from '../utils/electionHelpers';

/**
 * Returns a clear human-readable explanation for why a ballot can or cannot be opened
 * for each of the 10 statutory election statuses.
 */
export function getElectionStatusExplanation(status) {
  switch (status) {
    case 'DRAFT':
      return 'This election is currently in DRAFT configuration. Candidate nominations and polling schedules have not been published yet.';
    case 'UPCOMING':
      return 'This election is scheduled as UPCOMING. The simulated ballot unit will open only when polling becomes active.';
    case 'NOMINATION_OPEN':
      return 'Candidate nominations are currently open (NOMINATION_OPEN). The final contesting candidate list is not yet locked for polling.';
    case 'NOMINATION_CLOSED':
      return 'Candidate nominations have closed and affidavit scrutiny is underway (NOMINATION_CLOSED). Polling has not started yet.';
    case 'READY':
      return 'Ballot units are finalized (READY), awaiting the start of the scheduled polling window.';
    case 'POLLING_ACTIVE':
    case 'ACTIVE':
      return 'Polling is currently active (POLLING_ACTIVE). Eligible voters in this constituency can open the demonstration ballot.';
    case 'POLLING_COMPLETED':
      return 'The polling period for this election has ended (POLLING_COMPLETED). No further ballot interactions are permitted.';
    case 'COUNTING':
      return 'Polling has closed and vote counting is currently in progress (COUNTING).';
    case 'RESULTS_DECLARED':
    case 'COMPLETED':
      return 'This election has concluded and official demonstration results have been declared (RESULTS_DECLARED).';
    case 'CANCELLED':
      return 'This election notification has been cancelled or adjourned (CANCELLED). The ballot unit is disabled.';
    default:
      return `Ballot access is unavailable for election status: ${status || 'UNKNOWN'}.`;
  }
}

/**
 * Validates all 8 conditions required before a voter can open or submit a demo ballot:
 * 1. Voter is authenticated in the demo.
 * 2. Election exists.
 * 3. Election is assigned to the voter's eligible constituency.
 * 4. Election type matches the constituency type.
 * 5. Election belongs to the expected state, where applicable.
 * 6. Election status permits the demo interaction.
 * 7. The configured polling period permits the interaction (supports controlled demo mode).
 * 8. The voter has not already completed demo participation for this election.
 *
 * NOTE: Because this is a frontend-only educational prototype, these checks run in
 * browser memory and can be bypassed by modifying local browser data.
 */
export function validateBallotAccess({
  voter,
  election,
  constituency,
  constituencies = [],
  demoPollingOverride = false,
  enforceStrictSystemClock = false,
  referenceDate = null,
} = {}) {
  // 1. Voter is authenticated
  if (!voter || !(voter.id || voter.voterId)) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'UNAUTHENTICATED',
      reasonCode: 'UNAUTHENTICATED',
      reason:
        'You must be logged in with a verified demonstration voter account to access an election ballot.',
    };
  }

  // 2. Election exists
  if (!election || !(election.id || election.electionId)) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'ELECTION_NOT_FOUND',
      reasonCode: 'ELECTION_NOT_FOUND',
      reason:
        'The requested election ID does not exist in the local demonstration dataset.',
    };
  }

  const elId = election.id || election.electionId;
  const elType = election.type || election.electionType;

  if (
    elType !== ELECTION_TYPES.LOK_SABHA &&
    elType !== ELECTION_TYPES.STATE_ASSEMBLY
  ) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'INVALID_ELECTION_TYPE',
      reasonCode: 'INVALID_ELECTION_TYPE',
      reason: `Unsupported election type "${elType}". Only LOK_SABHA and STATE_ASSEMBLY elections are supported.`,
    };
  }

  // 5. Election belongs to expected state (for State Assembly)
  if (
    elType === ELECTION_TYPES.STATE_ASSEMBLY &&
    election.stateId &&
    voter.stateId !== election.stateId
  ) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'STATE_MISMATCH',
      reasonCode: 'STATE_MISMATCH',
      reason: `State mismatch: This State Legislative Assembly election belongs to ${election.stateId}, whereas your voter profile is registered in ${voter.stateId}.`,
    };
  }

  // Resolve constituency from voter + constituencies list if not explicitly provided
  const expectedVoterConstituencyId =
    elType === ELECTION_TYPES.LOK_SABHA
      ? voter.parliamentaryConstituencyId
      : voter.assemblyConstituencyId;

  const resolvedConstituency =
    constituency ||
    constituencies.find(
      (c) => (c.id || c.constituencyId) === expectedVoterConstituencyId
    ) ||
    null;

  if (!resolvedConstituency) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'CONSTITUENCY_NOT_FOUND',
      reasonCode: 'CONSTITUENCY_NOT_FOUND',
      reason:
        'Your eligible constituency record could not be resolved for this election.',
    };
  }

  // 4. Election type matches the constituency type
  const constType =
    resolvedConstituency.type || resolvedConstituency.constituencyType;
  const expectedConstType =
    elType === ELECTION_TYPES.LOK_SABHA
      ? CONSTITUENCY_TYPES.PARLIAMENTARY
      : CONSTITUENCY_TYPES.ASSEMBLY;

  if (constType !== expectedConstType) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'CONSTITUENCY_TYPE_MISMATCH',
      reasonCode: 'CONSTITUENCY_TYPE_MISMATCH',
      reason: `Constituency type mismatch: ${elType} requires a ${expectedConstType} constituency, but received ${constType}.`,
    };
  }

  // Verify the constituency actually matches the voter's mapped PC or AC
  const actualConstituencyId =
    resolvedConstituency.id || resolvedConstituency.constituencyId;

  if (actualConstituencyId !== expectedVoterConstituencyId) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'INELIGIBLE_CONSTITUENCY',
      reasonCode: 'INELIGIBLE_CONSTITUENCY',
      reason: `You are not registered in ${resolvedConstituency.name}. Your registered constituency for this election type is ${expectedVoterConstituencyId}.`,
    };
  }

  // 6a. If election is CANCELLED, report ELECTION_CANCELLED immediately
  if (election.status === 'CANCELLED') {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'ELECTION_CANCELLED',
      reasonCode: 'ELECTION_CANCELLED',
      reason: getElectionStatusExplanation('CANCELLED'),
    };
  }

  // 3. Election is assigned to the voter's eligible constituency
  if (!isVoterEligibleForElection(voter, election)) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'NOT_ELIGIBLE',
      reasonCode: 'NOT_ELIGIBLE',
      reason:
        'Your registered constituency is not included in the eligible constituencies for this election.',
    };
  }

  // 8. Check if the voter has already completed demo participation for this election
  const existingRecord = voter.elections?.[elId];
  if (
    existingRecord?.status === 'VOTED' ||
    existingRecord?.participated === true
  ) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'ALREADY_PARTICIPATED',
      reasonCode: 'ALREADY_PARTICIPATED',
      alreadyParticipated: true,
      participatedAt: existingRecord.participatedAt,
      demoReference:
        existingRecord.demoReference || existingRecord.referenceId || null,
      reason: `You have already completed your demonstration participation for ${
        election.name || election.title
      }. Duplicate submissions in the same election are prevented.`,
    };
  }

  // 6b. Election status permits the demo interaction
  const isClosedStatus = [
    'POLLING_COMPLETED',
    'COMPLETED',
    'COUNTING',
    'RESULTS_DECLARED',
  ].includes(election.status);

  if (isClosedStatus) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'ELECTION_CLOSED',
      reasonCode: 'ELECTION_CLOSED',
      reason: getElectionStatusExplanation(election.status),
    };
  }

  const isStatusPollingActive =
    election.status === 'POLLING_ACTIVE' || election.status === 'ACTIVE';

  if (!isStatusPollingActive && !demoPollingOverride) {
    return {
      canOpenBallot: false,
      canVote: false,
      code: 'ELECTION_NOT_ACTIVE',
      reasonCode: 'ELECTION_NOT_ACTIVE',
      reason: getElectionStatusExplanation(election.status),
    };
  }

  // 7. Configured polling period check
  if (enforceStrictSystemClock && !demoPollingOverride) {
    const now = referenceDate ? new Date(referenceDate) : new Date();
    const startStr = election.pollingStartDate || election.pollingDate;
    const endStr = election.pollingEndDate || election.pollingDate;

    if (startStr) {
      const startDate = new Date(`${startStr}T00:00:00`);
      if (!Number.isNaN(startDate.getTime()) && now < startDate) {
        return {
          canOpenBallot: false,
          canVote: false,
          code: 'POLLING_NOT_STARTED',
          reasonCode: 'POLLING_NOT_STARTED',
          reason: `Polling for this election is scheduled to begin on ${startStr}.`,
        };
      }
    }
    if (endStr) {
      const endDate = new Date(`${endStr}T23:59:59`);
      if (!Number.isNaN(endDate.getTime()) && now > endDate) {
        return {
          canOpenBallot: false,
          canVote: false,
          code: 'POLLING_ENDED',
          reasonCode: 'POLLING_ENDED',
          reason: `The configured polling window for this election ended on ${endStr}.`,
        };
      }
    }
  }

  return {
    canOpenBallot: true,
    canVote: true,
    code: 'VALID',
    reasonCode: 'VALID',
    electionId: elId,
    electionType: elType,
    constituency: resolvedConstituency,
    constituencyId: actualConstituencyId,
    reason: 'Eligible to open demonstration ballot.',
  };
}

/**
 * Strictly filters candidates for a specific ballot by:
 * - electionId
 * - constituencyId
 * - electionType
 * - APPROVED status
 * Never mixes Lok Sabha and Assembly candidates or candidates from other constituencies.
 * Also applies optional search, party filter, and sorting.
 */
export function filterAndSortBallotCandidates({
  candidates = [],
  electionId,
  constituencyId,
  electionType,
  parties = [],
  searchQuery = '',
  partyFilter = 'ALL',
  sortBy = 'BALLOT_ORDER',
} = {}) {
  if (!electionId || !constituencyId || !electionType) {
    return [];
  }

  const strictMatches = candidates.filter((cand) => {
    if (!cand) return false;
    const candElectionId = cand.electionId;
    const candConstituencyId = cand.constituencyId;
    const candElectionType = cand.electionType || cand.type;
    const candStatus = cand.status || cand.approvalStatus || 'APPROVED';

    return (
      candElectionId === electionId &&
      candConstituencyId === constituencyId &&
      candElectionType === electionType &&
      candStatus === 'APPROVED'
    );
  });

  const filtered = strictMatches.filter((cand) => {
    const party = parties.find(
      (p) => (p.id || p.partyId) === cand.partyId
    );
    const isIndependent =
      cand.partyId === 'PARTY-IND' ||
      cand.partyId === 'IND' ||
      party?.abbreviation === 'IND' ||
      party?.type === 'INDEPENDENT';

    if (partyFilter && partyFilter !== 'ALL') {
      if (
        partyFilter === 'INDEPENDENT' ||
        partyFilter === 'IND' ||
        partyFilter === 'PARTY-IND'
      ) {
        if (!isIndependent) return false;
      } else if (cand.partyId !== partyFilter) {
        return false;
      }
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const nameMatch = (cand.name || '').toLowerCase().includes(q);
      const partyNameMatch = (party?.name || party?.partyName || '')
        .toLowerCase()
        .includes(q);
      const partyAbbrMatch = (party?.abbreviation || '')
        .toLowerCase()
        .includes(q);
      const indMatch = isIndependent && 'independent'.includes(q);

      if (!nameMatch && !partyNameMatch && !partyAbbrMatch && !indMatch) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'NAME_ASC') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'NAME_DESC') {
      return (b.name || '').localeCompare(a.name || '');
    }
    // Default BALLOT_ORDER
    const numA = Number(a.ballotNumber) || 999;
    const numB = Number(b.ballotNumber) || 999;
    if (numA !== numB) return numA - numB;
    return (a.id || a.candidateId || '').localeCompare(
      b.id || b.candidateId || ''
    );
  });

  return sorted;
}

/**
 * Resolves the temporary in-memory selection for the ballot review screen.
 * Strictly supports selecting at most ONE option (either one valid candidate from the
 * current ballot's candidate list OR NOTA).
 * Returns null if selectionId is empty or does not belong to this ballot.
 */
export function resolveTemporaryBallotSelection({
  selectedOptionId,
  selectedId,
  ballotCandidates = [],
  parties = [],
} = {}) {
  const targetId = selectedOptionId || selectedId;
  if (!targetId) return null;

  if (targetId === NOTA_OPTION.id || targetId === 'NOTA') {
    return {
      isValid: true,
      optionId: NOTA_OPTION.id,
      isNota: true,
      candidate: null,
      label: NOTA_OPTION.name,
      partyLabel: NOTA_OPTION.partyName,
      partyAbbreviation: NOTA_OPTION.abbreviation,
    };
  }

  const matchedCandidate = ballotCandidates.find(
    (c) => (c.id || c.candidateId) === targetId
  );
  if (!matchedCandidate) {
    return null;
  }

  const party = parties.find(
    (p) => (p.id || p.partyId) === matchedCandidate.partyId
  );
  const isIndependent =
    matchedCandidate.partyId === 'PARTY-IND' ||
    matchedCandidate.partyId === 'IND' ||
    party?.abbreviation === 'IND';

  return {
    isValid: true,
    optionId: matchedCandidate.id || matchedCandidate.candidateId,
    isNota: false,
    candidate: matchedCandidate,
    label: matchedCandidate.name,
    partyLabel: isIndependent
      ? 'Independent Candidate'
      : party?.name || party?.partyName || matchedCandidate.partyId,
    partyAbbreviation: isIndependent
      ? 'IND'
      : party?.abbreviation || matchedCandidate.partyId,
  };
}
