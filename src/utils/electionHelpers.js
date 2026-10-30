import { ELECTION_TYPES, CONSTITUENCY_TYPES } from './constants';

/**
 * Returns all elections relevant to a given voter based on their independent
 * parliamentaryConstituencyId and assemblyConstituencyId.
 */
export function getVoterEligibleElections(voter, elections = []) {
  if (!voter) return [];

  return elections.filter((election) => {
    if (election.status === 'CANCELLED' || election.status === 'DRAFT') {
      return false;
    }

    if (election.type === ELECTION_TYPES.LOK_SABHA) {
      if (!voter.parliamentaryConstituencyId) return false;
      if (
        Array.isArray(election.constituencyIds) &&
        election.constituencyIds.length > 0
      ) {
        return election.constituencyIds.includes(voter.parliamentaryConstituencyId);
      }
      return true;
    }

    if (election.type === ELECTION_TYPES.STATE_ASSEMBLY) {
      if (!voter.assemblyConstituencyId || !voter.stateId) return false;
      if (election.stateId !== voter.stateId) return false;
      if (
        Array.isArray(election.constituencyIds) &&
        election.constituencyIds.length > 0
      ) {
        return election.constituencyIds.includes(voter.assemblyConstituencyId);
      }
      return true;
    }

    return false;
  });
}

/**
 * Returns the specific constituency ID a voter uses for a given election.
 */
export function getVoterConstituencyIdForElection(voter, election) {
  if (!voter || !election) return null;
  if (election.type === ELECTION_TYPES.LOK_SABHA) {
    return voter.parliamentaryConstituencyId;
  }
  if (election.type === ELECTION_TYPES.STATE_ASSEMBLY) {
    return voter.assemblyConstituencyId;
  }
  return null;
}

/**
 * Computes simultaneous participation summary (e.g. 0/2 completed, 1/2 completed, 2/2 completed).
 */
export function getVoterParticipationSummary(voter, eligibleElections = []) {
  const activePollingElections = eligibleElections.filter(
    (e) => e.status === 'POLLING_ACTIVE'
  );
  const targetElections =
    activePollingElections.length > 0 ? activePollingElections : eligibleElections;

  const totalCount = targetElections.length;
  let completedCount = 0;
  const byElectionId = {};

  for (const election of targetElections) {
    const record = voter?.elections?.[election.id];
    const status = record?.status === 'VOTED' ? 'VOTED' : 'PENDING';
    byElectionId[election.id] = {
      status,
      participatedAt: record?.participatedAt || null,
    };
    if (status === 'VOTED') {
      completedCount += 1;
    }
  }

  return {
    completedCount,
    totalCount,
    label: `${completedCount}/${totalCount} completed`,
    percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    byElectionId,
    targetElections,
  };
}

/**
 * Filters candidates strictly by BOTH electionId AND constituencyId.
 */
export function getCandidatesForElectionConstituency(
  candidates = [],
  electionId,
  constituencyId,
  onlyApproved = true
) {
  if (!electionId || !constituencyId) return [];
  return candidates.filter((cand) => {
    const matchesElection = cand.electionId === electionId;
    const matchesConstituency = cand.constituencyId === constituencyId;
    const matchesStatus = !onlyApproved || cand.status === 'APPROVED';
    return matchesElection && matchesConstituency && matchesStatus;
  });
}

/**
 * Returns eligible constituencies for a given election configuration.
 */
export function getConstituenciesForElection(election, constituencies = []) {
  if (!election) return [];
  if (election.type === ELECTION_TYPES.LOK_SABHA) {
    return constituencies.filter((c) => c.type === CONSTITUENCY_TYPES.PARLIAMENTARY);
  }
  if (election.type === ELECTION_TYPES.STATE_ASSEMBLY) {
    return constituencies.filter(
      (c) =>
        c.type === CONSTITUENCY_TYPES.ASSEMBLY &&
        (!election.stateId || c.stateId === election.stateId)
    );
  }
  return [];
}
