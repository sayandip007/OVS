import type { AdminRole, ConstituencyType } from '@prisma/client';
import type { SafeAdminUser } from '../auth/auth.types.js';

/**
 * Centralized Permission Registry for Administrative RBAC (Phase 8.4).
 * Permissions are explicitly separated from jurisdiction scope verification.
 */
export const ADMIN_PERMISSIONS = {
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
  CONSTITUENCIES_READ: 'constituencies.read',
  CANDIDATES_READ: 'candidates.read',
  CANDIDATES_MANAGE: 'candidates.manage',
  NOMINATIONS_REVIEW: 'nominations.review',
  RESULTS_READ: 'results.read',
  RESULTS_REVIEW: 'results.review',
  AUDIT_READ: 'audit.read',
} as const;

export type AdminPermission =
  (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

export const ALL_ADMIN_PERMISSIONS: readonly AdminPermission[] = Object.values(
  ADMIN_PERMISSIONS
);

export const MUTATING_ADMIN_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  ADMIN_PERMISSIONS.ADMIN_USERS_CREATE,
  ADMIN_PERMISSIONS.ADMIN_USERS_UPDATE,
  ADMIN_PERMISSIONS.ADMIN_USERS_SUSPEND,
  ADMIN_PERMISSIONS.ADMIN_ROLES_ASSIGN,
  ADMIN_PERMISSIONS.ADMIN_SCOPES_ASSIGN,
  ADMIN_PERMISSIONS.ELECTIONS_CREATE,
  ADMIN_PERMISSIONS.ELECTIONS_UPDATE,
  ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
  ADMIN_PERMISSIONS.CANDIDATES_MANAGE,
  ADMIN_PERMISSIONS.NOMINATIONS_REVIEW,
  ADMIN_PERMISSIONS.RESULTS_REVIEW,
]);

/**
 * Numerical hierarchy rank for preventing lateral/upward privilege escalation.
 */
export const ADMIN_ROLE_RANK: Record<AdminRole, number> = {
  SUPER_ADMIN: 5,
  NATIONAL_ADMIN: 4,
  STATE_ADMIN: 3,
  ELECTION_OFFICER: 2,
  READ_ONLY_AUDITOR: 1,
};

export const ADMIN_ROLE_METADATA: Record<
  AdminRole,
  { label: string; scopeLevel: string; description: string }
> = {
  SUPER_ADMIN: {
    label: 'Super Administrator',
    scopeLevel: 'GLOBAL',
    description:
      'Unrestricted application governance across all states, elections, and administrator provisioning.',
  },
  NATIONAL_ADMIN: {
    label: 'National Administrator',
    scopeLevel: 'NATIONAL',
    description:
      'National election operations and management of subordinate State Admins, Election Officers, and Auditors.',
  },
  STATE_ADMIN: {
    label: 'State Administrator',
    scopeLevel: 'STATE',
    description:
      'State-level administration restricted strictly to assigned state jurisdiction(s).',
  },
  ELECTION_OFFICER: {
    label: 'Election Officer',
    scopeLevel: 'ELECTION_CONSTITUENCY',
    description:
      'Operational officer restricted strictly to assigned elections and constituency jurisdictions.',
  },
  READ_ONLY_AUDITOR: {
    label: 'Read-Only Auditor',
    scopeLevel: 'READ_ONLY',
    description:
      'Independent audit & oversight role with read-only access and zero mutation capability.',
  },
};

/**
 * Authoritative Role -> Permission Matrix.
 * Note: Having a permission never bypasses jurisdiction scope enforcement!
 */
export const ROLE_PERMISSION_MATRIX: Record<AdminRole, readonly AdminPermission[]> = {
  SUPER_ADMIN: ALL_ADMIN_PERMISSIONS,

  NATIONAL_ADMIN: [
    ADMIN_PERMISSIONS.ADMIN_USERS_READ,
    ADMIN_PERMISSIONS.ADMIN_USERS_CREATE,
    ADMIN_PERMISSIONS.ADMIN_USERS_UPDATE,
    ADMIN_PERMISSIONS.ADMIN_USERS_SUSPEND,
    ADMIN_PERMISSIONS.ADMIN_ROLES_ASSIGN,
    ADMIN_PERMISSIONS.ADMIN_SCOPES_ASSIGN,
    ADMIN_PERMISSIONS.ELECTIONS_READ,
    ADMIN_PERMISSIONS.ELECTIONS_CREATE,
    ADMIN_PERMISSIONS.ELECTIONS_UPDATE,
    ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    ADMIN_PERMISSIONS.CONSTITUENCIES_READ,
    ADMIN_PERMISSIONS.CANDIDATES_READ,
    ADMIN_PERMISSIONS.CANDIDATES_MANAGE,
    ADMIN_PERMISSIONS.NOMINATIONS_REVIEW,
    ADMIN_PERMISSIONS.RESULTS_READ,
    ADMIN_PERMISSIONS.RESULTS_REVIEW,
    ADMIN_PERMISSIONS.AUDIT_READ,
  ],

  STATE_ADMIN: [
    ADMIN_PERMISSIONS.ADMIN_USERS_READ,
    ADMIN_PERMISSIONS.ADMIN_USERS_CREATE,
    ADMIN_PERMISSIONS.ADMIN_USERS_UPDATE,
    ADMIN_PERMISSIONS.ADMIN_USERS_SUSPEND,
    ADMIN_PERMISSIONS.ADMIN_SCOPES_ASSIGN,
    ADMIN_PERMISSIONS.ELECTIONS_READ,
    ADMIN_PERMISSIONS.ELECTIONS_CREATE,
    ADMIN_PERMISSIONS.ELECTIONS_UPDATE,
    ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    ADMIN_PERMISSIONS.CONSTITUENCIES_READ,
    ADMIN_PERMISSIONS.CANDIDATES_READ,
    ADMIN_PERMISSIONS.CANDIDATES_MANAGE,
    ADMIN_PERMISSIONS.NOMINATIONS_REVIEW,
    ADMIN_PERMISSIONS.RESULTS_READ,
    ADMIN_PERMISSIONS.RESULTS_REVIEW,
    ADMIN_PERMISSIONS.AUDIT_READ,
  ],

  ELECTION_OFFICER: [
    ADMIN_PERMISSIONS.ELECTIONS_READ,
    ADMIN_PERMISSIONS.CONSTITUENCIES_READ,
    ADMIN_PERMISSIONS.CANDIDATES_READ,
    ADMIN_PERMISSIONS.CANDIDATES_MANAGE,
    ADMIN_PERMISSIONS.NOMINATIONS_REVIEW,
    ADMIN_PERMISSIONS.RESULTS_READ,
    ADMIN_PERMISSIONS.AUDIT_READ,
  ],

  READ_ONLY_AUDITOR: [
    ADMIN_PERMISSIONS.ADMIN_USERS_READ,
    ADMIN_PERMISSIONS.ELECTIONS_READ,
    ADMIN_PERMISSIONS.CONSTITUENCIES_READ,
    ADMIN_PERMISSIONS.CANDIDATES_READ,
    ADMIN_PERMISSIONS.RESULTS_READ,
    ADMIN_PERMISSIONS.AUDIT_READ,
  ],
};

export function getPermissionsForRole(role: AdminRole): AdminPermission[] {
  return [...(ROLE_PERMISSION_MATRIX[role] ?? [])];
}

export function roleHasPermission(
  role: AdminRole,
  permission: AdminPermission
): boolean {
  // Defensive invariant: READ_ONLY_AUDITOR can NEVER hold any mutating permission
  if (role === 'READ_ONLY_AUDITOR' && MUTATING_ADMIN_PERMISSIONS.has(permission)) {
    return false;
  }
  const perms = ROLE_PERMISSION_MATRIX[role];
  return Boolean(perms && perms.includes(permission));
}

/**
 * Checks whether an actor role is permitted to manage (update/suspend/activate/assign scopes on)
 * an existing administrator having `targetRole`.
 */
export function canActorManageTargetRole(
  actorRole: AdminRole,
  targetRole: AdminRole
): boolean {
  if (actorRole === 'SUPER_ADMIN') {
    return true;
  }
  if (actorRole === 'NATIONAL_ADMIN') {
    return (
      targetRole === 'STATE_ADMIN' ||
      targetRole === 'ELECTION_OFFICER' ||
      targetRole === 'READ_ONLY_AUDITOR'
    );
  }
  if (actorRole === 'STATE_ADMIN') {
    return targetRole === 'ELECTION_OFFICER';
  }
  return false;
}

/**
 * Checks whether an actor role is permitted to assign `assignedRole` to a new or existing user.
 * Enforces strict non-escalation: actors can never grant roles >= their own authority (except SUPER_ADMIN).
 */
export function canActorAssignRole(
  actorRole: AdminRole,
  assignedRole: AdminRole
): boolean {
  if (actorRole === 'SUPER_ADMIN') {
    return true;
  }
  if (actorRole === 'NATIONAL_ADMIN') {
    return (
      assignedRole === 'STATE_ADMIN' ||
      assignedRole === 'ELECTION_OFFICER' ||
      assignedRole === 'READ_ONLY_AUDITOR'
    );
  }
  if (actorRole === 'STATE_ADMIN') {
    return assignedRole === 'ELECTION_OFFICER';
  }
  return false;
}

export interface JurisdictionTarget {
  stateId?: string | null;
  stateIds?: string[];
  electionId?: string | null;
  constituencyType?: ConstituencyType;
  constituencyId?: string | null;
}

export interface JurisdictionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Evaluates whether an authenticated administrator satisfies jurisdiction scope rules
 * for a given state, election, or constituency target.
 */
export function evaluateJurisdictionAccess(
  actor: SafeAdminUser,
  target: JurisdictionTarget
): JurisdictionCheckResult {
  if (!actor.isActive || actor.status !== 'ACTIVE') {
    return {
      allowed: false,
      reason: 'Administrator account is suspended or deactivated.',
    };
  }

  // SUPER_ADMIN and NATIONAL_ADMIN have nationwide visibility/jurisdiction
  if (actor.role === 'SUPER_ADMIN' || actor.role === 'NATIONAL_ADMIN') {
    return { allowed: true };
  }

  // Gather actor's effective state scopes
  const actorStates = new Set<string>(actor.assignedStateIds ?? []);
  if (actor.assignedStateId) {
    actorStates.add(actor.assignedStateId.toUpperCase());
  }

  // 1. State-level enforcement (applies to STATE_ADMIN, ELECTION_OFFICER, and state-scoped READ_ONLY_AUDITOR)
  const requestedStates: string[] = [];
  if (target.stateId) {
    requestedStates.push(target.stateId.toUpperCase());
  }
  if (target.stateIds && target.stateIds.length > 0) {
    for (const s of target.stateIds) {
      requestedStates.push(s.toUpperCase());
    }
  }

  if (actor.role === 'STATE_ADMIN') {
    if (actorStates.size === 0) {
      return {
        allowed: false,
        reason: 'STATE_ADMIN has no assigned state jurisdiction.',
      };
    }
    for (const reqState of requestedStates) {
      if (!actorStates.has(reqState)) {
        return {
          allowed: false,
          reason: `Jurisdiction violation: State '${reqState}' is outside your assigned state scope (${Array.from(actorStates).join(', ')}).`,
        };
      }
    }
    return { allowed: true };
  }

  // 2. Scoped READ_ONLY_AUDITOR (global if no state/election assigned; otherwise restricted to assigned scope)
  if (actor.role === 'READ_ONLY_AUDITOR') {
    if (actorStates.size > 0) {
      for (const reqState of requestedStates) {
        if (!actorStates.has(reqState)) {
          return {
            allowed: false,
            reason: `Auditor jurisdiction violation: State '${reqState}' is outside assigned audit scope.`,
          };
        }
      }
    }
    if (
      target.electionId &&
      actor.assignedElectionIds.length > 0 &&
      !actor.assignedElectionIds.includes(target.electionId)
    ) {
      return {
        allowed: false,
        reason: `Auditor jurisdiction violation: Election '${target.electionId}' is outside assigned audit scope.`,
      };
    }
    return { allowed: true };
  }

  // 3. ELECTION_OFFICER enforcement
  if (actor.role === 'ELECTION_OFFICER') {
    if (actorStates.size > 0) {
      for (const reqState of requestedStates) {
        if (!actorStates.has(reqState)) {
          return {
            allowed: false,
            reason: `Jurisdiction violation: State '${reqState}' is outside your assigned state scope.`,
          };
        }
      }
    }

    if (target.electionId) {
      if (!actor.assignedElectionIds.includes(target.electionId)) {
        return {
          allowed: false,
          reason: `Jurisdiction violation: Election '${target.electionId}' is not assigned to your officer scope.`,
        };
      }
    }

    if (target.constituencyId && target.constituencyType) {
      const scopes = actor.assignedConstituencyScopes ?? [];
      if (scopes.length > 0) {
        const matched = scopes.some(
          (s) =>
            s.constituencyType === target.constituencyType &&
            (s.parliamentaryConstituencyId === target.constituencyId ||
              s.assemblyConstituencyId === target.constituencyId) &&
            (!target.electionId || !s.electionId || s.electionId === target.electionId)
        );
        if (!matched) {
          return {
            allowed: false,
            reason: `Jurisdiction violation: Constituency '${target.constituencyId}' is outside your assigned constituency scope.`,
          };
        }
      }
    }

    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Unknown administrative role.',
  };
}
