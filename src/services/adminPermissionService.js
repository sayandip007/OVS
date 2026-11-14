import {
  ADMIN_ROLES,
  ELECTION_TYPES,
  DEMO_CLOCK_CONFIG,
  RESULT_STATUSES,
  getDemoReferenceDate,
} from '../utils/constants';

/**
 * Valid forward lifecycle transitions for elections (Phase 5 Section 5).
 */
export const VALID_ELECTION_TRANSITIONS = {
  DRAFT: ['UPCOMING', 'CANCELLED'],
  UPCOMING: ['NOMINATION_OPEN', 'DRAFT', 'CANCELLED'],
  NOMINATION_OPEN: ['NOMINATION_CLOSED', 'CANCELLED'],
  NOMINATION_CLOSED: ['READY', 'CANCELLED'],
  READY: ['POLLING_ACTIVE', 'CANCELLED'],
  POLLING_ACTIVE: ['POLLING_COMPLETED', 'CANCELLED'],
  ACTIVE: ['POLLING_COMPLETED', 'CANCELLED'],
  POLLING_COMPLETED: ['COUNTING'],
  COUNTING: ['RESULTS_DECLARED'],
  RESULTS_DECLARED: ['ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
  CANCELLED: ['ARCHIVED'],
};

/**
 * Valid candidate approval lifecycle transitions (Phase 5 Section 9).
 */
export const VALID_CANDIDATE_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  PENDING: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: ['SUSPENDED', 'WITHDRAWN', 'ARCHIVED', 'REJECTED'],
  SUSPENDED: ['APPROVED', 'REJECTED', 'ARCHIVED'],
  REJECTED: ['UNDER_REVIEW', 'APPROVED', 'ARCHIVED'],
  WITHDRAWN: ['ARCHIVED'],
  ARCHIVED: [],
};

/**
 * Route access matrix by Admin Role (Phase 5 Section 3).
 * Enforced in navigation, route guards, and action handlers.
 */
export const ADMIN_ROUTE_PERMISSIONS = {
  '/eci/dashboard': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/elections': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/states': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/districts': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/constituencies': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/parties': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/candidates': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/voters': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/schedules': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/monitoring': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/announcements': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/results': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/audit-logs': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/admin-users': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/profile': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
  '/eci/settings': [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.NATIONAL_ADMIN,
    ADMIN_ROLES.STATE_ADMIN,
    ADMIN_ROLES.ELECTION_OFFICER,
    ADMIN_ROLES.READ_ONLY_AUDITOR,
  ],
};

/**
 * Checks whether an authenticated admin officer can access a given route path.
 * Returns boolean when evaluated directly or via .allowed in detail checks.
 */
export function canAdminAccessRoute(admin, routePath = '/eci/dashboard') {
  const role = admin?.role || admin?.adminRole;
  if (!admin || !role) {
    return false;
  }

  let baseRoute = routePath;
  if (routePath.startsWith('/eci/elections')) {
    baseRoute = '/eci/elections';
  }

  const allowedRoles = ADMIN_ROUTE_PERMISSIONS[baseRoute];
  if (!allowedRoles) {
    return true;
  }

  if (!allowedRoles.includes(role)) {
    return false;
  }

  if (
    routePath === '/eci/elections/create' &&
    role === ADMIN_ROLES.READ_ONLY_AUDITOR
  ) {
    return false;
  }

  return true;
}

const ACTION_TO_DOMAIN_MAP = {
  CREATE_ELECTION: 'ELECTION',
  EDIT_ELECTION: 'ELECTION',
  MANAGE_STATE: 'STATE',
  MANAGE_DISTRICT: 'DISTRICT',
  MANAGE_CONSTITUENCY: 'CONSTITUENCY',
  MANAGE_PARTY: 'PARTY',
  MANAGE_CANDIDATE: 'CANDIDATE',
  MANAGE_VOTER: 'VOTER',
  MANAGE_SCHEDULE: 'SCHEDULE',
  MANAGE_ANNOUNCEMENT: 'ANNOUNCEMENT',
  MANAGE_RESULT: 'RESULT',
  RESET_DEMO_DATA: 'SYSTEM_RESET',
};

/**
 * Checks whether an admin officer can perform a specific mutating or scoped action.
 */
export function canAdminPerformAction(
  admin,
  actionTypeOrVerb = 'WRITE',
  domainOrScope = {},
  maybeScope = {}
) {
  const role = admin?.role || admin?.adminRole;
  if (!admin || !role) {
    const msg =
      'Authentication required: Only authenticated ECI officers can perform administrative actions.';
    return { allowed: false, reason: msg, error: msg };
  }

  let domain;
  let targetScope;

  if (typeof domainOrScope === 'string') {
    domain = domainOrScope;
    targetScope = maybeScope || {};
  } else {
    domain = ACTION_TO_DOMAIN_MAP[actionTypeOrVerb] || actionTypeOrVerb || 'ELECTION';
    targetScope = domainOrScope || {};
  }

  // 1. READ_ONLY_AUDITOR cannot modify any records
  if (role === ADMIN_ROLES.READ_ONLY_AUDITOR && actionTypeOrVerb !== 'READ') {
    const msg =
      'Permission denied: READ_ONLY_AUDITOR has view-only access and cannot create, modify, approve, or delete records.';
    return { allowed: false, reason: msg, error: msg };
  }

  // 2. SUPER_ADMIN can perform all demonstration actions
  if (role === ADMIN_ROLES.SUPER_ADMIN) {
    return { allowed: true, reason: 'Permitted for SUPER_ADMIN.' };
  }

  // 3. NATIONAL_ADMIN
  if (role === ADMIN_ROLES.NATIONAL_ADMIN) {
    if (domain === 'SYSTEM_RESET' || actionTypeOrVerb === 'RESET_DEMO_DATA') {
      const msg =
        'Only SUPER_ADMIN can reset or overwrite the entire demonstration dataset.';
      return { allowed: false, reason: msg, error: msg };
    }
    return { allowed: true, reason: 'Permitted for NATIONAL_ADMIN.' };
  }

  // 4. STATE_ADMIN
  if (role === ADMIN_ROLES.STATE_ADMIN) {
    if (
      domain === 'SYSTEM_RESET' ||
      domain === 'STATE' ||
      domain === 'PARTY' ||
      actionTypeOrVerb === 'RESET_DEMO_DATA'
    ) {
      const msg =
        'STATE_ADMIN cannot modify national state metadata, national party registry, or reset global demo data.';
      return { allowed: false, reason: msg, error: msg };
    }
    if (
      domain === 'ELECTION' &&
      targetScope.electionType === ELECTION_TYPES.LOK_SABHA
    ) {
      const msg =
        'STATE_ADMIN can manage State Assembly elections for their assigned state, not nationwide Lok Sabha elections.';
      return { allowed: false, reason: msg, error: msg };
    }
    if (
      targetScope.stateId &&
      admin.assignedStateId &&
      targetScope.stateId !== admin.assignedStateId
    ) {
      const msg = `Scope restriction: STATE_ADMIN for ${admin.assignedStateId} cannot modify records belonging to state ${targetScope.stateId}.`;
      return { allowed: false, reason: msg, error: msg };
    }
    return { allowed: true, reason: 'Permitted for STATE_ADMIN.' };
  }

  // 5. ELECTION_OFFICER
  if (role === ADMIN_ROLES.ELECTION_OFFICER) {
    const permittedDomains = ['CANDIDATE', 'SCHEDULE', 'ELECTION', 'RESULT'];
    if (!permittedDomains.includes(domain)) {
      const msg = `ELECTION_OFFICER cannot modify ${domain} records. Permitted scopes: assigned elections, candidates, and schedules.`;
      return { allowed: false, reason: msg, error: msg };
    }

    if (
      targetScope.electionId &&
      Array.isArray(admin.assignedElectionIds) &&
      admin.assignedElectionIds.length > 0 &&
      !admin.assignedElectionIds.includes(targetScope.electionId)
    ) {
      const msg = `Scope restriction: Election ${targetScope.electionId} is not assigned to this Election Officer.`;
      return { allowed: false, reason: msg, error: msg };
    }

    if (
      targetScope.stateId &&
      admin.assignedStateId &&
      targetScope.stateId !== admin.assignedStateId
    ) {
      const msg = `Scope restriction: Record belongs to state ${targetScope.stateId}, outside officer's assigned state (${admin.assignedStateId}).`;
      return { allowed: false, reason: msg, error: msg };
    }

    return { allowed: true, reason: 'Permitted for ELECTION_OFFICER.' };
  }

  const msg = `Role ${role} is not authorised for this action.`;
  return { allowed: false, reason: msg, error: msg };
}

/**
 * Validates election status transitions (Phase 5 Section 5 & Phase 7.5 Section 2).
 * Supports both positional `(currentStatus, nextStatus, options)` and object `{ currentStatus, nextStatus, ... }`.
 * Enforces:
 * - Forward lifecycle transition rules
 * - Cannot enter POLLING_ACTIVE before pollingStartDate (unless demoLifecycleOverride is enabled)
 * - Cannot enter RESULTS_DECLARED before counting is complete
 * - Cannot enter contradictory states (e.g., POLLING_ACTIVE when published results exist without sandbox override)
 */
export function validateElectionStatusTransition(
  arg1,
  arg2,
  arg3 = {}
) {
  let currentStatus;
  let nextStatus;
  let confirmCancel;
  let demoLifecycleOverride;
  let election;
  let pollingStartDate;
  let referenceDate;
  let countingCompleted;
  let hasPublishedResults;
  let results;

  if (typeof arg1 === 'object' && arg1 !== null) {
    currentStatus = arg1.currentStatus;
    nextStatus = arg1.nextStatus;
    confirmCancel = Boolean(arg1.confirmCancel || arg1.confirmCancellation);
    demoLifecycleOverride = Boolean(
      arg1.demoLifecycleOverride || arg1.demoLifecycleMode
    );
    election = arg1.election || null;
    pollingStartDate =
      arg1.pollingStartDate ||
      arg1.election?.pollingStartDate ||
      arg1.election?.pollingDate ||
      null;
    referenceDate = arg1.referenceDate || null;
    countingCompleted = arg1.countingCompleted;
    hasPublishedResults = Boolean(arg1.hasPublishedResults);
    results = Array.isArray(arg1.results) ? arg1.results : [];
  } else {
    currentStatus = arg1;
    nextStatus = arg2;
    confirmCancel = Boolean(arg3?.confirmCancel || arg3?.confirmCancellation);
    demoLifecycleOverride = Boolean(
      arg3?.demoLifecycleOverride || arg3?.demoLifecycleMode
    );
    election = arg3?.election || null;
    pollingStartDate =
      arg3?.pollingStartDate ||
      arg3?.election?.pollingStartDate ||
      arg3?.election?.pollingDate ||
      null;
    referenceDate = arg3?.referenceDate || null;
    countingCompleted = arg3?.countingCompleted;
    hasPublishedResults = Boolean(arg3?.hasPublishedResults);
    results = Array.isArray(arg3?.results) ? arg3.results : [];
  }

  if (!currentStatus || !nextStatus) {
    const error = 'Both current and target election statuses are required.';
    return { ok: false, valid: false, error };
  }

  const normalizedCurrent =
    currentStatus === 'ACTIVE'
      ? 'POLLING_ACTIVE'
      : currentStatus === 'COMPLETED'
      ? 'RESULTS_DECLARED'
      : currentStatus;

  const normalizedNext =
    nextStatus === 'ACTIVE'
      ? 'POLLING_ACTIVE'
      : nextStatus === 'COMPLETED'
      ? 'RESULTS_DECLARED'
      : nextStatus;

  if (normalizedCurrent === normalizedNext) {
    return { ok: true, valid: true, status: normalizedNext };
  }

  if (
    ['RESULTS_DECLARED', 'ARCHIVED', 'CANCELLED'].includes(normalizedCurrent) &&
    normalizedNext !== 'ARCHIVED' &&
    !demoLifecycleOverride
  ) {
    const error = `Cannot transition election from terminal/historical status ${normalizedCurrent} to ${normalizedNext}. Duplicate the election as a new DRAFT instead.`;
    return { ok: false, valid: false, error };
  }

  if (normalizedNext === 'CANCELLED' && !confirmCancel) {
    const error =
      'Cancelling an election requires explicit administrative confirmation.';
    return {
      ok: false,
      valid: false,
      requiresConfirmation: true,
      error,
    };
  }

  // Phase 7.5 Section 2: Prevent entering POLLING_ACTIVE before pollingStartDate
  if (normalizedNext === 'POLLING_ACTIVE' && !demoLifecycleOverride) {
    const resolvedPollStart =
      pollingStartDate ||
      election?.pollingStartDate ||
      election?.pollingDate ||
      null;
    const resolvedRefDate = getDemoReferenceDate(
      referenceDate || election?.simulationClockDate || null
    );
    if (
      resolvedPollStart &&
      resolvedRefDate &&
      new Date(`${resolvedRefDate}T00:00:00`) <
        new Date(`${resolvedPollStart}T00:00:00`)
    ) {
      const error = `Cannot transition election to POLLING_ACTIVE before its scheduled polling start date (${resolvedPollStart}; current demo reference date: ${resolvedRefDate}). Enable Demo Lifecycle Mode only for sandbox overrides.`;
      return { ok: false, valid: false, error };
    }

    const publishedExist =
      hasPublishedResults ||
      results.some(
        (r) =>
          r.status === RESULT_STATUSES.PUBLISHED ||
          r.status === RESULT_STATUSES.CORRECTED
      );
    if (
      publishedExist &&
      election?.demoSandboxMode !== DEMO_CLOCK_CONFIG.sandboxConcurrencyMode
    ) {
      const error =
        'Contradictory lifecycle state: An election cannot enter POLLING_ACTIVE when published final results already exist.';
      return { ok: false, valid: false, error };
    }
  }

  // Phase 7.5 Section 2: Prevent entering RESULTS_DECLARED before counting is complete
  if (normalizedNext === 'RESULTS_DECLARED' && !demoLifecycleOverride) {
    if (countingCompleted === false) {
      const error =
        'Cannot declare election results (RESULTS_DECLARED) while constituency counting is still incomplete.';
      return { ok: false, valid: false, error };
    }
    if (results.length > 0) {
      const incompleteSessions = results.filter((r) =>
        [
          RESULT_STATUSES.DRAFT,
          RESULT_STATUSES.COUNTING_IN_PROGRESS,
          RESULT_STATUSES.COUNTING_PAUSED,
          RESULT_STATUSES.TIED,
        ].includes(r.status)
      );
      if (incompleteSessions.length > 0) {
        const error = `Cannot transition election to RESULTS_DECLARED while ${incompleteSessions.length} constituency counting session(s) remain incomplete or tied.`;
        return { ok: false, valid: false, error };
      }
    }
  }

  const allowedNext = VALID_ELECTION_TRANSITIONS[normalizedCurrent] || [];
  if (!allowedNext.includes(normalizedNext) && !demoLifecycleOverride) {
    const error = `Invalid lifecycle transition from ${normalizedCurrent} to ${normalizedNext}. Allowed next state(s): ${
      allowedNext.join(', ') || 'None'
    }.`;
    return { ok: false, valid: false, error };
  }

  return { ok: true, valid: true, status: normalizedNext };
}

/**
 * Validates full election timeline consistency against the centralized demo clock
 * and associated constituency result records (Phase 7.5 Section 2).
 */
export function validateElectionTimelineConsistency(
  election,
  results = [],
  options = {}
) {
  if (!election || typeof election !== 'object') {
    return {
      isValid: false,
      errors: ['Election record is required for timeline validation.'],
      warnings: [],
    };
  }

  const errors = [];
  const warnings = [];
  const referenceDate = getDemoReferenceDate(
    options.referenceDate || election.simulationClockDate || null
  );

  // 1. Validate 8+ milestone chronology (registration -> nomination -> scrutiny -> withdrawal -> campaign -> polling -> counting -> result)
  const scheduleValidation = validateElectionSchedule(election);
  if (!scheduleValidation.isValid) {
    errors.push(...scheduleValidation.errors);
  }

  const toDate = (d) => (d ? new Date(`${d}T00:00:00`) : null);
  const refDateObj = toDate(referenceDate);
  const pollStartObj = toDate(
    election.pollingStartDate || election.pollingDate
  );
  const pollEndObj = toDate(
    election.pollingEndDate || election.pollingStartDate || election.pollingDate
  );
  const status = election.status || 'DRAFT';
  const isSandboxConcurrent =
    election.demoSandboxMode === DEMO_CLOCK_CONFIG.sandboxConcurrencyMode ||
    Boolean(options.allowSandboxConcurrency);

  const electionId = election.id || election.electionId;
  const scopedResults = (results || []).filter(
    (r) => !r.electionId || r.electionId === electionId
  );
  const publishedResults = scopedResults.filter(
    (r) =>
      r.status === RESULT_STATUSES.PUBLISHED ||
      r.status === RESULT_STATUSES.CORRECTED
  );
  const incompleteResults = scopedResults.filter((r) =>
    [
      RESULT_STATUSES.DRAFT,
      RESULT_STATUSES.COUNTING_IN_PROGRESS,
      RESULT_STATUSES.COUNTING_PAUSED,
      RESULT_STATUSES.TIED,
    ].includes(r.status)
  );

  // 2. Election cannot be POLLING_ACTIVE before its pollingStartDate
  if (
    (status === 'POLLING_ACTIVE' || status === 'ACTIVE') &&
    pollStartObj &&
    refDateObj &&
    refDateObj < pollStartObj &&
    !options.demoLifecycleOverride
  ) {
    errors.push(
      `Election "${electionId}" cannot be POLLING_ACTIVE on ${referenceDate} before its pollingStartDate (${election.pollingStartDate || election.pollingDate}).`
    );
  }

  // 3. DRAFT or UPCOMING election cannot have PUBLISHED results
  if (
    ['DRAFT', 'UPCOMING', 'NOMINATION_OPEN', 'NOMINATION_CLOSED', 'READY'].includes(
      status
    ) &&
    publishedResults.length > 0
  ) {
    errors.push(
      `Election "${electionId}" in pre-polling status "${status}" cannot have ${publishedResults.length} published result(s).`
    );
  }

  // 4. Non-sandbox election cannot simultaneously be POLLING_ACTIVE and have PUBLISHED final results
  if (
    (status === 'POLLING_ACTIVE' || status === 'ACTIVE') &&
    publishedResults.length > 0 &&
    !isSandboxConcurrent
  ) {
    errors.push(
      `Contradictory lifecycle state for "${electionId}": Election is in ${status} while ${publishedResults.length} result(s) are already PUBLISHED without concurrent sandbox mode.`
    );
  } else if (
    (status === 'POLLING_ACTIVE' || status === 'ACTIVE') &&
    publishedResults.length > 0 &&
    isSandboxConcurrent
  ) {
    warnings.push(
      `Election "${electionId}" operates in ${DEMO_CLOCK_CONFIG.sandboxConcurrencyMode} so both live ballot simulation and sample constituency counting/results can be demonstrated concurrently.`
    );
  }

  // 5. RESULTS_DECLARED election cannot have incomplete counting sessions
  if (
    (status === 'RESULTS_DECLARED' || status === 'COMPLETED') &&
    incompleteResults.length > 0
  ) {
    errors.push(
      `Election "${electionId}" is marked ${status} while ${incompleteResults.length} constituency counting session(s) are still incomplete.`
    );
  }

  // 6. Past completed election check
  if (
    (status === 'RESULTS_DECLARED' || status === 'ARCHIVED') &&
    pollEndObj &&
    refDateObj &&
    pollEndObj > refDateObj &&
    !options.demoLifecycleOverride
  ) {
    errors.push(
      `Election "${electionId}" is marked ${status}, but its pollingEndDate (${election.pollingEndDate}) is in the future relative to ${referenceDate}.`
    );
  }

  return {
    isValid: errors.length === 0,
    referenceDate,
    status,
    isSandboxConcurrent,
    errors,
    warnings,
  };
}

/**
 * Validates candidate approval status transitions (Phase 5 Section 9).
 */
export function validateCandidateStatusTransition(currentStatus, nextStatus, options = {}) {
  const normCurrent = currentStatus || 'SUBMITTED';
  if (normCurrent === nextStatus) {
    return { ok: true, valid: true, status: nextStatus };
  }

  if (options.demoLifecycleMode) {
    return { ok: true, valid: true, status: nextStatus };
  }

  const allowed = VALID_CANDIDATE_TRANSITIONS[normCurrent] || [];
  if (!allowed.includes(nextStatus)) {
    const error = `Invalid candidate status transition from ${normCurrent} to ${nextStatus}. Allowed transitions: ${
      allowed.join(', ') || 'None'
    }.`;
    return { ok: false, valid: false, error };
  }

  return { ok: true, valid: true, status: nextStatus };
}

/**
 * Checks whether modifying or archiving a constituency affects existing voters or elections
 * (Phase 5 Section 6).
 */
export function checkConstituencyModificationImpact({
  constituencyId,
  updates = {},
  constituencies = [],
  voters = [],
  elections = [],
  candidates = [],
} = {}) {
  if (!constituencyId) {
    return {
      hasImpact: false,
      referencedVoters: [],
      referencedElections: [],
      referencedCandidates: [],
      warnings: [],
    };
  }

  const target = constituencies.find(
    (c) => (c.id || c.constituencyId) === constituencyId
  );
  const displayName = target ? `${target.name} (${constituencyId})` : constituencyId;

  const affectedVoters = voters.filter(
    (v) =>
      v.parliamentaryConstituencyId === constituencyId ||
      v.assemblyConstituencyId === constituencyId
  );

  const affectedElections = elections.filter(
    (e) =>
      Array.isArray(e.constituencyIds) &&
      e.constituencyIds.includes(constituencyId)
  );

  const affectedCandidates = candidates.filter(
    (c) => c.constituencyId === constituencyId
  );

  const isStructuralChange =
    target &&
    ((updates.stateId && updates.stateId !== target.stateId) ||
      (updates.type && updates.type !== (target.type || target.constituencyType)) ||
      (updates.constituencyType &&
        updates.constituencyType !== (target.type || target.constituencyType)) ||
      updates.status === 'ARCHIVED' ||
      updates.status === 'INACTIVE');

  const warnings = [];
  if (affectedVoters.length > 0) {
    warnings.push(
      `${affectedVoters.length} registered demo voter(s) are mapped to ${displayName}.`
    );
  }
  if (affectedElections.length > 0) {
    warnings.push(
      `${affectedElections.length} configured election(s) reference ${displayName}.`
    );
  }
  if (affectedCandidates.length > 0) {
    warnings.push(
      `${affectedCandidates.length} candidate record(s) are associated with ${displayName}.`
    );
  }

  return {
    hasImpact: warnings.length > 0,
    isStructuralChange: Boolean(isStructuralChange),
    affectedVoterCount: affectedVoters.length,
    affectedElectionCount: affectedElections.length,
    affectedCandidateCount: affectedCandidates.length,
    referencedVoters: affectedVoters,
    referencedElections: affectedElections,
    referencedCandidates: affectedCandidates,
    warnings,
  };
}

/**
 * Checks whether a political party can be deleted (Phase 5 Section 8).
 */
export function canDeleteParty(partyId, candidates = []) {
  const referenced = candidates.filter((c) => c.partyId === partyId);
  if (referenced.length > 0) {
    return {
      canDelete: false,
      referencedCount: referenced.length,
      error: `Cannot delete party ${partyId} because it is referenced by ${referenced.length} candidate record(s). Archive the party instead to preserve historical candidate records.`,
    };
  }
  return { canDelete: true, referencedCount: 0 };
}

/**
 * Validates a full election schedule including registration, nominations, scrutiny,
 * withdrawal, campaigning, polling, counting, and result publication (Phase 5 Section 11 & Phase 7.5 Section 2).
 */
export function validateElectionSchedule(schedule = {}) {
  const fieldErrors = {};
  const {
    registrationDeadline,
    nominationStartDate,
    nominationEndDate,
    scrutinyDate,
    withdrawalDeadline,
    campaignStartDate,
    campaignEndDate,
    pollingStartDate,
    pollingEndDate,
    countingDate,
    resultDate,
  } = schedule;

  const toDate = (d) => (d ? new Date(`${d}T00:00:00`) : null);

  const regEnd = toDate(registrationDeadline);
  const nomStart = toDate(nominationStartDate);
  const nomEnd = toDate(nominationEndDate);
  const scrutiny = toDate(scrutinyDate);
  const withdrawal = toDate(withdrawalDeadline);
  const campStart = toDate(campaignStartDate);
  const campEnd = toDate(campaignEndDate);
  const pollStart = toDate(pollingStartDate || schedule.pollingDate);
  const pollEnd = toDate(pollingEndDate || pollingStartDate || schedule.pollingDate);
  const counting = toDate(countingDate);
  const result = toDate(resultDate);

  if (regEnd && pollStart && pollStart < regEnd) {
    fieldErrors.registrationDeadline =
      'Voter registration deadline cannot be later than polling start date.';
  }
  if (nomStart && nomEnd && nomEnd < nomStart) {
    fieldErrors.nominationEndDate =
      'Nomination end date cannot be earlier than nomination start date.';
  }
  if (nomEnd && scrutiny && scrutiny < nomEnd) {
    fieldErrors.scrutinyDate =
      'Scrutiny date cannot be earlier than nomination end date.';
  }
  if (scrutiny && withdrawal && withdrawal < scrutiny) {
    fieldErrors.withdrawalDeadline =
      'Withdrawal deadline cannot be earlier than scrutiny date.';
  }
  if (withdrawal && campStart && campStart < withdrawal) {
    fieldErrors.campaignStartDate =
      'Campaign start date cannot be earlier than candidate withdrawal deadline.';
  }
  if (campStart && campEnd && campEnd < campStart) {
    fieldErrors.campaignEndDate =
      'Campaign end date cannot be earlier than campaign start date.';
  }
  if (campEnd && pollStart && pollStart < campEnd) {
    fieldErrors.campaignEndDate =
      'Campaign end date cannot be later than polling start date.';
  }
  if (nomEnd && pollStart && pollStart < nomEnd) {
    fieldErrors.pollingStartDate =
      'Polling start date cannot be earlier than nomination end date.';
  }
  if (withdrawal && pollStart && pollStart < withdrawal) {
    fieldErrors.pollingStartDate =
      'Polling start date cannot be earlier than candidate withdrawal deadline.';
  }
  if (pollStart && pollEnd && pollEnd < pollStart) {
    fieldErrors.pollingEndDate =
      'Polling end date cannot be earlier than polling start date.';
  }
  if (pollEnd && counting && counting < pollEnd) {
    fieldErrors.countingDate =
      'Counting date cannot be earlier than polling end date.';
  }
  if (counting && result && result < counting) {
    fieldErrors.resultDate =
      'Result declaration date cannot be earlier than counting date.';
  }
  if (pollEnd && result && result < pollEnd && !fieldErrors.resultDate) {
    fieldErrors.resultDate =
      'Result declaration date cannot be earlier than polling end date.';
  }

  const errors = Object.values(fieldErrors);

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

/**
 * Detects schedule overlaps/conflicts with other active or upcoming elections.
 */
export function detectScheduleConflicts(targetElection, allElections = []) {
  if (!targetElection) return [];
  const startA = targetElection.pollingStartDate || targetElection.pollingDate;
  const endA = targetElection.pollingEndDate || targetElection.pollingDate;
  if (!startA || !endA) return [];

  const a0 = new Date(`${startA}T00:00:00`).getTime();
  const a1 = new Date(`${endA}T23:59:59`).getTime();
  if (Number.isNaN(a0) || Number.isNaN(a1)) return [];

  const conflicts = [];
  for (const other of allElections) {
    const otherId = other.id || other.electionId;
    const targetId = targetElection.id || targetElection.electionId;
    if (otherId === targetId) continue;
    if (other.status === 'CANCELLED' || other.status === 'ARCHIVED') continue;

    const startB = other.pollingStartDate || other.pollingDate;
    const endB = other.pollingEndDate || other.pollingDate;
    if (!startB || !endB) continue;

    const b0 = new Date(`${startB}T00:00:00`).getTime();
    const b1 = new Date(`${endB}T23:59:59`).getTime();
    if (a0 <= b1 && b0 <= a1) {
      const sameJurisdiction =
        (targetElection.type || targetElection.electionType) ===
          ELECTION_TYPES.LOK_SABHA ||
        (other.type || other.electionType) === ELECTION_TYPES.LOK_SABHA ||
        targetElection.stateId === other.stateId;

      if (sameJurisdiction) {
        conflicts.push({
          electionId: otherId,
          title: other.name || other.title,
          type: other.type || other.electionType,
          pollingWindow: `${startB} to ${endB}`,
          message: `Overlapping polling window with ${
            other.name || other.title
          } (${startB} – ${endB}). Ensure simultaneous election logistics are confirmed.`,
        });
      }
    }
  }
  return conflicts;
}

/**
 * Creates a sanitized, append-only demonstration audit log entry (Phase 5 Section 15).
 * Explicitly strips any sensitive fields (OTP, password, candidate selection, ballot choice).
 */
export function createSanitizedAuditLogEntry({
  adminUser,
  action,
  actionType,
  entityType,
  targetEntity,
  entityId,
  targetId,
  adminId,
  adminName,
  adminRole,
  description,
  summary,
  existingLogs = [],
} = {}) {
  const resolvedAdminId =
    adminUser?.id || adminId || 'ECI-ADMIN-001';
  const resolvedAdminName =
    adminUser?.fullName || adminUser?.name || adminName || 'ECI Officer';
  const resolvedAdminRole =
    adminUser?.role || adminUser?.adminRole || adminRole || 'SUPER_ADMIN';
  const resolvedAction = String(
    actionType || action || 'ADMIN_ACTION'
  ).toUpperCase();
  const resolvedEntity = String(
    targetEntity || entityType || 'SYSTEM'
  ).toUpperCase();
  const resolvedTargetId = String(targetId || entityId || 'GLOBAL');
  const rawText = String(summary || description || '');

  const safeSummary = rawText
    .replace(/\b(123456|654321)\b/g, '[REDACTED]')
    .trim();

  const nextSeq = existingLogs.length + 1001;
  return {
    id: `AUDIT-${nextSeq}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    adminId: resolvedAdminId,
    adminName: resolvedAdminName,
    adminRole: resolvedAdminRole,
    actionType: resolvedAction,
    action: resolvedAction,
    targetEntity: resolvedEntity,
    entityType: resolvedEntity,
    targetId: resolvedTargetId,
    entityId: resolvedTargetId,
    summary: safeSummary,
    description: safeSummary,
  };
}

/**
 * Centralized Phase 8.4 Administrative Permission Keys (mirrors backend registry).
 * Used exclusively for UI visibility hints; authoritative enforcement occurs on the backend.
 */
export const ADMIN_PERMISSION_KEYS = Object.freeze({
  ADMIN_USERS_READ: 'admin.users.read',
  ADMIN_USERS_CREATE: 'admin.users.create',
  ADMIN_USERS_UPDATE: 'admin.users.update',
  ADMIN_USERS_SUSPEND: 'admin.users.suspend',
  ADMIN_ROLES_ASSIGN: 'admin.roles.assign',
  ADMIN_SCOPES_ASSIGN: 'admin.scopes.assign',
  ELECTIONS_READ: 'elections.read',
  ELECTIONS_CREATE: 'elections.create',
  ELECTIONS_UPDATE: 'elections.update',
  ELECTIONS_MANAGE_STATUS: 'elections.manage_status',
  ELECTIONS_CANCEL: 'elections.cancel',
  ELECTIONS_ARCHIVE: 'elections.archive',
  ELECTIONS_HISTORY_READ: 'elections.history.read',
  ELECTIONS_CONSTITUENCIES_READ: 'elections.constituencies.read',
  ELECTIONS_CONSTITUENCIES_MANAGE: 'elections.constituencies.manage',
  ELECTIONS_CONSTITUENCIES_BULK_MANAGE: 'elections.constituencies.bulk_manage',
  ELECTIONS_SCHEDULE_READ: 'elections.schedule.read',
  ELECTIONS_SCHEDULE_MANAGE: 'elections.schedule.manage',
  ELECTIONS_CONFIG_VALIDATE: 'elections.configuration.validate',
  ELECTIONS_CONFIG_SUBMIT: 'elections.configuration.submit',
  ELECTIONS_CONFIG_REVIEW: 'elections.configuration.review',
  ELECTIONS_CONFIG_APPROVE: 'elections.configuration.approve',
  CONSTITUENCIES_READ: 'constituencies.read',
  CANDIDATES_READ: 'candidates.read',
  CANDIDATES_CREATE: 'candidates.create',
  CANDIDATES_UPDATE: 'candidates.update',
  CANDIDATES_DEACTIVATE: 'candidates.deactivate',
  CANDIDATES_MANAGE: 'candidates.manage',
  PARTIES_READ: 'parties.read',
  PARTIES_CREATE: 'parties.create',
  PARTIES_UPDATE: 'parties.update',
  NOMINATIONS_READ: 'nominations.read',
  NOMINATIONS_CREATE: 'nominations.create',
  NOMINATIONS_SUBMIT: 'nominations.submit',
  NOMINATIONS_REVIEW: 'nominations.review',
  NOMINATIONS_APPROVE: 'nominations.approve',
  NOMINATIONS_REJECT: 'nominations.reject',
  NOMINATIONS_WITHDRAW: 'nominations.withdraw',
  NOMINATIONS_HISTORY_READ: 'nominations.history.read',
  RESULTS_READ: 'results.read',
  RESULTS_MANAGE: 'results.manage',
  RESULTS_TALLY_MANAGE: 'results.tally_manage',
  RESULTS_REVIEW: 'results.review',
  RESULTS_PUBLISH: 'results.publish',
  RESULTS_TIE_RESOLVE: 'results.tie_resolve',
  PARTICIPATION_AGGREGATE_READ: 'participation.aggregate.read',
  PARTICIPATION_RECORDS_READ: 'participation.records.read',
  AUDIT_READ: 'audit.read',
  ANALYTICS_READ: 'analytics.read',
  ANALYTICS_READ_NATIONAL: 'analytics.national.read',
  ANALYTICS_READ_STATE: 'analytics.state.read',
  ANALYTICS_READ_ELECTION: 'analytics.election.read',
  ANALYTICS_READ_PARTICIPATION: 'analytics.participation.read',
  ANALYTICS_READ_COUNTING: 'analytics.counting.read',
  ANALYTICS_READ_AUDIT: 'analytics.audit.read',
  ANALYTICS_EXPORT: 'analytics.export',
  ANNOUNCEMENTS_READ: 'announcements.read',
  ANNOUNCEMENTS_CREATE: 'announcements.create',
  ANNOUNCEMENTS_UPDATE: 'announcements.update',
  ANNOUNCEMENTS_REVIEW: 'announcements.review',
  ANNOUNCEMENTS_APPROVE: 'announcements.approve',
  ANNOUNCEMENTS_PUBLISH: 'announcements.publish',
  ANNOUNCEMENTS_SCHEDULE: 'announcements.schedule',
  ANNOUNCEMENTS_ARCHIVE: 'announcements.archive',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
  NOTIFICATIONS_RETRY: 'notifications.retry',
  NOTIFICATIONS_READ: 'notifications.read',
});

export const ROLE_PERMISSIONS_MAP = Object.freeze({
  [ADMIN_ROLES.SUPER_ADMIN]: Object.values(ADMIN_PERMISSION_KEYS),
  [ADMIN_ROLES.NATIONAL_ADMIN]: [
    ADMIN_PERMISSION_KEYS.ADMIN_USERS_READ,
    ADMIN_PERMISSION_KEYS.ADMIN_USERS_CREATE,
    ADMIN_PERMISSION_KEYS.ADMIN_USERS_UPDATE,
    ADMIN_PERMISSION_KEYS.ADMIN_USERS_SUSPEND,
    ADMIN_PERMISSION_KEYS.ADMIN_ROLES_ASSIGN,
    ADMIN_PERMISSION_KEYS.ADMIN_SCOPES_ASSIGN,
    ADMIN_PERMISSION_KEYS.ELECTIONS_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CREATE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_UPDATE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_MANAGE_STATUS,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CANCEL,
    ADMIN_PERMISSION_KEYS.ELECTIONS_ARCHIVE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_HISTORY_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_MANAGE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_BULK_MANAGE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_SCHEDULE_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_SCHEDULE_MANAGE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_VALIDATE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_SUBMIT,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_REVIEW,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_APPROVE,
    ADMIN_PERMISSION_KEYS.CONSTITUENCIES_READ,
    ADMIN_PERMISSION_KEYS.CANDIDATES_READ,
    ADMIN_PERMISSION_KEYS.CANDIDATES_CREATE,
    ADMIN_PERMISSION_KEYS.CANDIDATES_UPDATE,
    ADMIN_PERMISSION_KEYS.CANDIDATES_DEACTIVATE,
    ADMIN_PERMISSION_KEYS.CANDIDATES_MANAGE,
    ADMIN_PERMISSION_KEYS.PARTIES_READ,
    ADMIN_PERMISSION_KEYS.PARTIES_CREATE,
    ADMIN_PERMISSION_KEYS.PARTIES_UPDATE,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_READ,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_CREATE,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_SUBMIT,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_REVIEW,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_APPROVE,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_REJECT,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_WITHDRAW,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_HISTORY_READ,
    ADMIN_PERMISSION_KEYS.RESULTS_READ,
    ADMIN_PERMISSION_KEYS.RESULTS_MANAGE,
    ADMIN_PERMISSION_KEYS.RESULTS_TALLY_MANAGE,
    ADMIN_PERMISSION_KEYS.RESULTS_REVIEW,
    ADMIN_PERMISSION_KEYS.RESULTS_PUBLISH,
    ADMIN_PERMISSION_KEYS.RESULTS_TIE_RESOLVE,
    ADMIN_PERMISSION_KEYS.PARTICIPATION_AGGREGATE_READ,
    ADMIN_PERMISSION_KEYS.PARTICIPATION_RECORDS_READ,
    ADMIN_PERMISSION_KEYS.AUDIT_READ,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_NATIONAL,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_STATE,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_ELECTION,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_PARTICIPATION,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_COUNTING,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_AUDIT,
    ADMIN_PERMISSION_KEYS.ANALYTICS_EXPORT,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_READ,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_CREATE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_UPDATE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_REVIEW,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_APPROVE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_PUBLISH,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_SCHEDULE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_ARCHIVE,
    ADMIN_PERMISSION_KEYS.NOTIFICATIONS_MANAGE,
    ADMIN_PERMISSION_KEYS.NOTIFICATIONS_RETRY,
    ADMIN_PERMISSION_KEYS.NOTIFICATIONS_READ,
  ],
  [ADMIN_ROLES.STATE_ADMIN]: [
    ADMIN_PERMISSION_KEYS.ADMIN_USERS_READ,
    ADMIN_PERMISSION_KEYS.ADMIN_USERS_CREATE,
    ADMIN_PERMISSION_KEYS.ADMIN_USERS_UPDATE,
    ADMIN_PERMISSION_KEYS.ADMIN_USERS_SUSPEND,
    ADMIN_PERMISSION_KEYS.ADMIN_SCOPES_ASSIGN,
    ADMIN_PERMISSION_KEYS.ELECTIONS_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CREATE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_UPDATE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_MANAGE_STATUS,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CANCEL,
    ADMIN_PERMISSION_KEYS.ELECTIONS_ARCHIVE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_HISTORY_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_MANAGE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_BULK_MANAGE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_SCHEDULE_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_SCHEDULE_MANAGE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_VALIDATE,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_SUBMIT,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_REVIEW,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_APPROVE,
    ADMIN_PERMISSION_KEYS.CONSTITUENCIES_READ,
    ADMIN_PERMISSION_KEYS.CANDIDATES_READ,
    ADMIN_PERMISSION_KEYS.CANDIDATES_CREATE,
    ADMIN_PERMISSION_KEYS.CANDIDATES_UPDATE,
    ADMIN_PERMISSION_KEYS.CANDIDATES_DEACTIVATE,
    ADMIN_PERMISSION_KEYS.CANDIDATES_MANAGE,
    ADMIN_PERMISSION_KEYS.PARTIES_READ,
    ADMIN_PERMISSION_KEYS.PARTIES_CREATE,
    ADMIN_PERMISSION_KEYS.PARTIES_UPDATE,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_READ,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_CREATE,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_SUBMIT,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_REVIEW,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_APPROVE,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_REJECT,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_WITHDRAW,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_HISTORY_READ,
    ADMIN_PERMISSION_KEYS.RESULTS_READ,
    ADMIN_PERMISSION_KEYS.RESULTS_MANAGE,
    ADMIN_PERMISSION_KEYS.RESULTS_TALLY_MANAGE,
    ADMIN_PERMISSION_KEYS.RESULTS_REVIEW,
    ADMIN_PERMISSION_KEYS.RESULTS_PUBLISH,
    ADMIN_PERMISSION_KEYS.RESULTS_TIE_RESOLVE,
    ADMIN_PERMISSION_KEYS.PARTICIPATION_AGGREGATE_READ,
    ADMIN_PERMISSION_KEYS.AUDIT_READ,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_STATE,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_ELECTION,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_PARTICIPATION,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_COUNTING,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_AUDIT,
    ADMIN_PERMISSION_KEYS.ANALYTICS_EXPORT,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_READ,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_CREATE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_UPDATE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_REVIEW,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_APPROVE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_PUBLISH,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_SCHEDULE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_ARCHIVE,
    ADMIN_PERMISSION_KEYS.NOTIFICATIONS_RETRY,
    ADMIN_PERMISSION_KEYS.NOTIFICATIONS_READ,
  ],
  [ADMIN_ROLES.ELECTION_OFFICER]: [
    ADMIN_PERMISSION_KEYS.ELECTIONS_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_HISTORY_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_SCHEDULE_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_VALIDATE,
    ADMIN_PERMISSION_KEYS.CONSTITUENCIES_READ,
    ADMIN_PERMISSION_KEYS.CANDIDATES_READ,
    ADMIN_PERMISSION_KEYS.CANDIDATES_CREATE,
    ADMIN_PERMISSION_KEYS.CANDIDATES_UPDATE,
    ADMIN_PERMISSION_KEYS.CANDIDATES_MANAGE,
    ADMIN_PERMISSION_KEYS.PARTIES_READ,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_READ,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_CREATE,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_SUBMIT,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_REVIEW,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_APPROVE,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_REJECT,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_WITHDRAW,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_HISTORY_READ,
    ADMIN_PERMISSION_KEYS.RESULTS_READ,
    ADMIN_PERMISSION_KEYS.RESULTS_MANAGE,
    ADMIN_PERMISSION_KEYS.RESULTS_TALLY_MANAGE,
    ADMIN_PERMISSION_KEYS.RESULTS_REVIEW,
    ADMIN_PERMISSION_KEYS.PARTICIPATION_AGGREGATE_READ,
    ADMIN_PERMISSION_KEYS.AUDIT_READ,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_ELECTION,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_PARTICIPATION,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_COUNTING,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_READ,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_CREATE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_UPDATE,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_REVIEW,
    ADMIN_PERMISSION_KEYS.NOTIFICATIONS_READ,
  ],
  [ADMIN_ROLES.READ_ONLY_AUDITOR]: [
    ADMIN_PERMISSION_KEYS.ADMIN_USERS_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_HISTORY_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_SCHEDULE_READ,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_VALIDATE,
    ADMIN_PERMISSION_KEYS.CONSTITUENCIES_READ,
    ADMIN_PERMISSION_KEYS.CANDIDATES_READ,
    ADMIN_PERMISSION_KEYS.PARTIES_READ,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_READ,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_HISTORY_READ,
    ADMIN_PERMISSION_KEYS.RESULTS_READ,
    ADMIN_PERMISSION_KEYS.PARTICIPATION_AGGREGATE_READ,
    ADMIN_PERMISSION_KEYS.AUDIT_READ,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_NATIONAL,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_STATE,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_ELECTION,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_PARTICIPATION,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_COUNTING,
    ADMIN_PERMISSION_KEYS.ANALYTICS_READ_AUDIT,
    ADMIN_PERMISSION_KEYS.ANALYTICS_EXPORT,
    ADMIN_PERMISSION_KEYS.ANNOUNCEMENTS_READ,
    ADMIN_PERMISSION_KEYS.NOTIFICATIONS_READ,
  ],
});

export function getRolePermissions(role) {
  return [...(ROLE_PERMISSIONS_MAP[role] || [])];
}

export function hasAdminPermission(admin, permission) {
  if (!admin) return false;
  if (Array.isArray(admin.permissions)) {
    return admin.permissions.includes(permission);
  }
  const role = admin.role || admin.adminRole;
  return getRolePermissions(role).includes(permission);
}
