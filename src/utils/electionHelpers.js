import {
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  PARTICIPATION_STATUSES,
} from './constants';

/**
 * Checks whether a voter is eligible for a specific election based on their
 * independent parliamentaryConstituencyId and assemblyConstituencyId.
 */
export function isVoterEligibleForElection(voter, election) {
  if (!voter || !election) return false;
  if (election.status === 'CANCELLED' || election.status === 'DRAFT') {
    return false;
  }

  const elType = election.type || election.electionType;

  if (elType === ELECTION_TYPES.LOK_SABHA) {
    if (!voter.parliamentaryConstituencyId) return false;
    if (
      Array.isArray(election.constituencyIds) &&
      election.constituencyIds.length > 0
    ) {
      return election.constituencyIds.includes(voter.parliamentaryConstituencyId);
    }
    return true;
  }

  if (elType === ELECTION_TYPES.STATE_ASSEMBLY) {
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
}

/**
 * Returns all elections relevant/eligible to a given voter based on their independent
 * parliamentaryConstituencyId and assemblyConstituencyId.
 */
export function getVoterEligibleElections(voter, elections = []) {
  if (!voter) return [];
  return elections.filter((election) => isVoterEligibleForElection(voter, election));
}

/**
 * Returns the specific constituency ID a voter uses for a given election.
 */
export function getVoterConstituencyIdForElection(voter, election) {
  if (!voter || !election) return null;
  const elType = election.type || election.electionType;
  if (elType === ELECTION_TYPES.LOK_SABHA) {
    return voter.parliamentaryConstituencyId;
  }
  if (elType === ELECTION_TYPES.STATE_ASSEMBLY) {
    return voter.assemblyConstituencyId;
  }
  return null;
}

/**
 * Derives the voter's participation status for a given election:
 * PENDING | VOTED | UPCOMING | CLOSED | NOT_ELIGIBLE
 */
export function getVoterElectionParticipationStatus(voter, election) {
  if (!voter || !election) return PARTICIPATION_STATUSES.NOT_ELIGIBLE;
  if (!isVoterEligibleForElection(voter, election)) {
    return PARTICIPATION_STATUSES.NOT_ELIGIBLE;
  }

  const elId = election.id || election.electionId;
  const record = voter.elections?.[elId];
  if (record?.status === 'VOTED' || record?.participated === true) {
    return PARTICIPATION_STATUSES.VOTED;
  }

  if (
    election.status === 'UPCOMING' ||
    election.status === 'NOMINATION_OPEN' ||
    election.status === 'NOMINATION_CLOSED' ||
    election.status === 'READY'
  ) {
    return PARTICIPATION_STATUSES.UPCOMING;
  }

  if (
    election.status === 'POLLING_COMPLETED' ||
    election.status === 'COMPLETED' ||
    election.status === 'COUNTING' ||
    election.status === 'RESULTS_DECLARED'
  ) {
    return PARTICIPATION_STATUSES.CLOSED;
  }

  return PARTICIPATION_STATUSES.PENDING;
}

/**
 * Computes simultaneous participation summary (e.g. 0/2 completed, 1/2 completed, 2/2 completed)
 * plus counts for all 5 dashboard stat cards.
 */
export function getVoterParticipationSummary(voter, eligibleElections = []) {
  const activePollingElections = eligibleElections.filter(
    (e) => e.status === 'POLLING_ACTIVE' || e.status === 'ACTIVE'
  );
  const upcomingElections = eligibleElections.filter(
    (e) =>
      e.status === 'UPCOMING' ||
      e.status === 'NOMINATION_OPEN' ||
      e.status === 'NOMINATION_CLOSED' ||
      e.status === 'READY'
  );
  const targetElections =
    activePollingElections.length > 0 ? activePollingElections : eligibleElections;

  const totalCount = targetElections.length;
  let completedCount = 0;
  const byElectionId = {};

  for (const election of targetElections) {
    const elId = election.id || election.electionId;
    const record = voter?.elections?.[elId];
    const isVoted = record?.status === 'VOTED' || record?.participated === true;
    const status = isVoted ? 'VOTED' : 'PENDING';
    byElectionId[elId] = {
      status,
      participatedAt: record?.participatedAt || null,
      referenceId: record?.referenceId || null,
    };
    if (isVoted) {
      completedCount += 1;
    }
  }

  return {
    totalEligible: eligibleElections.length,
    upcomingCount: upcomingElections.length,
    activeCount: activePollingElections.length,
    completedCount,
    totalCount,
    pendingCount: Math.max(0, totalCount - completedCount),
    label: `${completedCount}/${totalCount} completed`,
    percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    byElectionId,
    targetElections,
  };
}

/**
 * Computes voter profile completion percentage and missing items.
 */
export function getVoterProfileCompletion(voter) {
  if (!voter) {
    return { percentage: 0, isComplete: false, missingFields: ['All Fields'] };
  }
  const checks = [
    { key: 'fullName', label: 'Full Name', valid: Boolean(voter.fullName?.trim()) },
    {
      key: 'dob',
      label: 'Date of Birth',
      valid: Boolean(voter.dateOfBirth || voter.dob),
    },
    { key: 'email', label: 'Email Address', valid: Boolean(voter.email?.trim()) },
    { key: 'mobile', label: 'Mobile Number', valid: Boolean(voter.mobile?.trim()) },
    {
      key: 'epicReference',
      label: 'Demo EPIC Reference',
      valid: Boolean(voter.epicReference || voter.epicRef || voter.voterRef),
    },
    { key: 'address', label: 'Residential Address', valid: Boolean(voter.address?.trim()) },
    { key: 'pinCode', label: 'PIN Code', valid: Boolean(voter.pinCode?.trim()) },
    { key: 'stateId', label: 'State / UT', valid: Boolean(voter.stateId) },
    { key: 'districtId', label: 'District', valid: Boolean(voter.districtId) },
    {
      key: 'parliamentaryConstituencyId',
      label: 'Parliamentary Constituency (PC)',
      valid: Boolean(voter.parliamentaryConstituencyId),
    },
    {
      key: 'assemblyConstituencyId',
      label: 'Assembly Constituency (AC)',
      valid: Boolean(voter.assemblyConstituencyId),
    },
  ];

  const completed = checks.filter((c) => c.valid).length;
  const percentage = Math.round((completed / checks.length) * 100);
  const missingFields = checks.filter((c) => !c.valid).map((c) => c.label);

  return {
    percentage,
    isComplete: missingFields.length === 0,
    missingFields,
    checks,
  };
}

/**
 * Cascading Geography Helpers for Registration & Constituency Selection.
 * Ensures changing state or district clears invalid dependent selections.
 */
export function getCascadingGeographyOptions({
  stateId,
  districtId,
  parliamentaryConstituencyId,
  districts = [],
  constituencies = [],
}) {
  const availableDistricts = stateId
    ? districts.filter((d) => d.stateId === stateId)
    : [];

  const availablePCs = stateId
    ? constituencies.filter((c) => {
        const cType = c.type || c.constituencyType;
        if (c.stateId !== stateId || cType !== CONSTITUENCY_TYPES.PARLIAMENTARY) {
          return false;
        }
        if (
          districtId &&
          Array.isArray(c.districtIds) &&
          c.districtIds.length > 0
        ) {
          return c.districtIds.includes(districtId);
        }
        return true;
      })
    : [];

  const availableACs = stateId
    ? constituencies.filter((c) => {
        const cType = c.type || c.constituencyType;
        if (c.stateId !== stateId || cType !== CONSTITUENCY_TYPES.ASSEMBLY) {
          return false;
        }
        if (districtId && c.districtId && c.districtId !== districtId) {
          return false;
        }
        const parentPcId =
          c.parentParliamentaryConstituencyId || c.parentParliamentaryId;
        if (
          parliamentaryConstituencyId &&
          parentPcId &&
          parentPcId !== parliamentaryConstituencyId
        ) {
          return false;
        }
        return true;
      })
    : [];

  return {
    availableDistricts,
    availablePCs,
    availableACs,
    districts: availableDistricts,
    parliamentaryConstituencies: availablePCs,
    assemblyConstituencies: availableACs,
  };
}

/**
 * Reconciles geographical selections when State or District changes,
 * clearing any dependent selection that is no longer valid.
 * Supports both positional `(currentSelection, districts, constituencies)`
 * and object `{ nextSelection, districts, constituencies }` call styles.
 */
export function reconcileGeographySelection(
  arg1,
  arg2 = [],
  arg3 = []
) {
  let selectionObj = arg1 || {};
  let districts = arg2;
  let constituencies = arg3;

  if (arg1 && typeof arg1 === 'object' && 'nextSelection' in arg1) {
    selectionObj = arg1.nextSelection || {};
    districts = arg1.districts || [];
    constituencies = arg1.constituencies || [];
  }

  const {
    stateId = '',
    districtId = '',
    parliamentaryConstituencyId = '',
    assemblyConstituencyId = '',
  } = selectionObj;

  if (!stateId) {
    return {
      stateId: '',
      districtId: '',
      parliamentaryConstituencyId: '',
      assemblyConstituencyId: '',
    };
  }

  const validDistrict = districts.find(
    (d) => (d.id || d.districtId) === districtId && d.stateId === stateId
  );
  const nextDistrictId = validDistrict ? districtId : '';

  const { availablePCs } = getCascadingGeographyOptions({
    stateId,
    districtId: nextDistrictId,
    districts,
    constituencies,
  });

  const validPC = availablePCs.find(
    (pc) => (pc.id || pc.constituencyId) === parliamentaryConstituencyId
  );
  const nextPCId = validPC ? parliamentaryConstituencyId : '';

  const { availableACs } = getCascadingGeographyOptions({
    stateId,
    districtId: nextDistrictId,
    parliamentaryConstituencyId: nextPCId,
    districts,
    constituencies,
  });

  const validAC = availableACs.find(
    (ac) => (ac.id || ac.constituencyId) === assemblyConstituencyId
  );
  const nextACId = validAC ? assemblyConstituencyId : '';

  return {
    stateId,
    districtId: nextDistrictId,
    parliamentaryConstituencyId: nextPCId,
    assemblyConstituencyId: nextACId,
  };
}

/**
 * Filters candidates strictly by BOTH electionId AND constituencyId.
 */
export function getCandidatesForElectionConstituency(
  arg1,
  arg2,
  arg3,
  onlyApproved = true
) {
  let candidates = [];
  let electionId = '';
  let constituencyId = '';

  if (Array.isArray(arg1)) {
    candidates = arg1;
    electionId = arg2;
    constituencyId = arg3;
  } else {
    electionId = arg1;
    constituencyId = arg2;
    candidates = Array.isArray(arg3) ? arg3 : [];
  }

  if (!electionId || !constituencyId) return [];
  return candidates.filter((cand) => {
    const matchesElection = cand.electionId === electionId;
    const matchesConstituency = cand.constituencyId === constituencyId;
    const candStatus = cand.status || cand.approvalStatus || 'APPROVED';
    const matchesStatus = !onlyApproved || candStatus === 'APPROVED';
    return matchesElection && matchesConstituency && matchesStatus;
  });
}

/**
 * Returns eligible constituencies for a given election configuration.
 */
export function getConstituenciesForElection(election, constituencies = []) {
  if (!election) return [];
  const elType = election.type || election.electionType;
  if (elType === ELECTION_TYPES.LOK_SABHA) {
    return constituencies.filter(
      (c) => (c.type || c.constituencyType) === CONSTITUENCY_TYPES.PARLIAMENTARY
    );
  }
  if (elType === ELECTION_TYPES.STATE_ASSEMBLY) {
    return constituencies.filter(
      (c) =>
        (c.type || c.constituencyType) === CONSTITUENCY_TYPES.ASSEMBLY &&
        (!election.stateId || c.stateId === election.stateId)
    );
  }
  return [];
}
