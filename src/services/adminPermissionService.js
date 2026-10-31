import {
  ADMIN_ROLES,
  ELECTION_TYPES,
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

  let domain = 'ELECTION';
  let targetScope = {};

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
 * Validates election status transitions (Phase 5 Section 5).
 * Supports both positional `(currentStatus, nextStatus, options)` and object `{ currentStatus, nextStatus, ... }`.
 */
export function validateElectionStatusTransition(
  arg1,
  arg2,
  arg3 = {}
) {
  let currentStatus;
  let nextStatus;
  let confirmCancel = false;
  let demoLifecycleOverride = false;

  if (typeof arg1 === 'object' && arg1 !== null) {
    currentStatus = arg1.currentStatus;
    nextStatus = arg1.nextStatus;
    confirmCancel = Boolean(arg1.confirmCancel || arg1.confirmCancellation);
    demoLifecycleOverride = Boolean(
      arg1.demoLifecycleOverride || arg1.demoLifecycleMode
    );
  } else {
    currentStatus = arg1;
    nextStatus = arg2;
    confirmCancel = Boolean(arg3?.confirmCancel || arg3?.confirmCancellation);
    demoLifecycleOverride = Boolean(
      arg3?.demoLifecycleOverride || arg3?.demoLifecycleMode
    );
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
 * Validates a full 8-milestone election schedule (Phase 5 Section 11).
 */
export function validateElectionSchedule(schedule = {}) {
  const fieldErrors = {};
  const {
    nominationStartDate,
    nominationEndDate,
    scrutinyDate,
    withdrawalDeadline,
    pollingStartDate,
    pollingEndDate,
    countingDate,
    resultDate,
  } = schedule;

  const toDate = (d) => (d ? new Date(`${d}T00:00:00`) : null);

  const nomStart = toDate(nominationStartDate);
  const nomEnd = toDate(nominationEndDate);
  const scrutiny = toDate(scrutinyDate);
  const withdrawal = toDate(withdrawalDeadline);
  const pollStart = toDate(pollingStartDate || schedule.pollingDate);
  const pollEnd = toDate(pollingEndDate || pollingStartDate || schedule.pollingDate);
  const counting = toDate(countingDate);
  const result = toDate(resultDate);

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
