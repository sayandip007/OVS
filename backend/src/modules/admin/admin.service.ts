import type { AdminRole, AdminStatus } from '@prisma/client';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
  UnauthorizedProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import { AUTH_CONSTANTS } from '../auth/auth.constants.js';
import type { SafeAdminUser, SafeSessionItem } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { AdminAuditService } from './admin.audit.service.js';
import {
  ADMIN_ROLE_METADATA,
  ALL_ADMIN_PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
  canActorAssignRole,
  canActorManageTargetRole,
  evaluateJurisdictionAccess,
  getPermissionsForRole,
  type AdminPermission,
} from './admin.permissions.js';
import {
  AdminRepository,
  type AdminFullRecord,
  type ConstituencyScopeInput,
} from './admin.repository.js';
import { PasswordService } from './password.service.js';

export interface RequestAuditContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SafeAdminProfileDto extends SafeAdminUser {
  permissions: AdminPermission[];
  lastLoginAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLoginResult {
  admin: SafeAdminProfileDto;
  sessionToken: string;
  csrfToken: string;
}

export interface CreateAdminServiceInput {
  officerCode: string;
  email: string;
  fullName: string;
  designation: string;
  role: AdminRole;
  password: string;
  assignedStateId?: string | null;
  stateIds?: string[];
  electionIds?: string[];
  constituencyScopes?: ConstituencyScopeInput[];
}

export interface UpdateAdminServiceInput {
  fullName?: string;
  designation?: string;
  email?: string;
  role?: AdminRole;
  password?: string;
  assignedStateId?: string | null;
  stateIds?: string[];
  electionIds?: string[];
  constituencyScopes?: ConstituencyScopeInput[];
}

export interface UpdateScopesServiceInput {
  assignedStateId?: string | null;
  stateIds?: string[];
  electionIds?: string[];
  constituencyScopes?: ConstituencyScopeInput[];
}

export class AdminService {
  constructor(
    private readonly repository: AdminRepository = new AdminRepository(),
    private readonly passwordService: PasswordService = new PasswordService(),
    private readonly sessionService: SessionService,
    private readonly auditService: AdminAuditService = new AdminAuditService()
  ) {}

  toSafeAdminDto(record: AdminFullRecord): SafeAdminProfileDto {
    const stateSet = new Set<string>();
    if (record.assignedStateId) {
      stateSet.add(record.assignedStateId.toUpperCase());
    }
    for (const s of record.assignedStateScopes ?? []) {
      stateSet.add(s.stateId.toUpperCase());
    }

    const assignedStateIds = Array.from(stateSet);
    const assignedElectionIds = (record.assignedElectionScopes ?? []).map(
      (e) => e.electionId
    );
    const assignedConstituencyScopes = (
      record.assignedConstituencyScopes ?? []
    ).map((c) => ({
      id: c.id,
      electionId: c.electionId,
      constituencyType: c.constituencyType,
      parliamentaryConstituencyId: c.parliamentaryConstituencyId,
      assemblyConstituencyId: c.assemblyConstituencyId,
    }));

    return {
      id: record.id,
      userId: record.userId,
      officerCode: record.officerCode,
      email: record.email,
      fullName: record.fullName,
      designation: record.designation,
      role: record.role,
      status: record.status,
      isActive: record.isActive,
      assignedStateId: record.assignedStateId ?? assignedStateIds[0] ?? null,
      assignedStateIds,
      assignedElectionIds,
      assignedConstituencyScopes,
      permissions: getPermissionsForRole(record.role),
      lastLoginAt: record.user?.lastLoginAt
        ? record.user.lastLoginAt.toISOString()
        : null,
      suspendedAt: record.suspendedAt ? record.suspendedAt.toISOString() : null,
      suspendedReason: record.suspendedReason ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * Normalizes and merges primary `assignedStateId` with `stateIds` array.
   */
  private resolveEffectiveStateInputs(
    assignedStateId?: string | null,
    stateIds?: string[]
  ): { primaryStateId: string | null; uniqueStateIds: string[] } {
    const set = new Set<string>();
    if (stateIds) {
      for (const s of stateIds) {
        if (s) set.add(s.trim().toUpperCase());
      }
    }
    if (assignedStateId) {
      set.add(assignedStateId.trim().toUpperCase());
    }
    const uniqueStateIds = Array.from(set);
    const primaryStateId =
      assignedStateId !== undefined ? assignedStateId : uniqueStateIds[0] ?? null;
    return { primaryStateId, uniqueStateIds };
  }

  /**
   * Verifies that an actor is allowed to delegate the target scopes and role.
   */
  private async assertScopeDelegationAllowed(
    actor: SafeAdminUser,
    targetRole: AdminRole,
    stateIds: string[],
    electionIds: string[],
    constituencyScopes: ConstituencyScopeInput[],
    ctx: RequestAuditContext,
    targetEntityId: string
  ): Promise<void> {
    const refCheck = await this.repository.validateScopeReferences({
      stateIds,
      electionIds,
      constituencyScopes,
    });

    if (!refCheck.valid) {
      throw new ValidationProblemError(
        refCheck.reason || 'Invalid jurisdiction scope reference.',
        [{ name: 'scopes', reason: refCheck.reason || 'Scope reference does not exist.' }]
      );
    }

    // State Admin must assign at least one state when creating State Admin or Election Officer
    if (targetRole === 'STATE_ADMIN' && stateIds.length === 0) {
      throw new ValidationProblemError(
        'STATE_ADMIN accounts must be assigned to at least one state jurisdiction.',
        [{ name: 'stateIds', reason: 'At least one stateId is required for STATE_ADMIN.' }]
      );
    }

    // STATE_ADMIN delegation guard: cannot grant global scope or another state's scope
    if (actor.role === 'STATE_ADMIN') {
      const actorStates = new Set(actor.assignedStateIds ?? []);
      if (actor.assignedStateId) actorStates.add(actor.assignedStateId.toUpperCase());

      if (stateIds.length === 0) {
        await this.auditService.recordSecurityEvent({
          adminUserId: actor.id,
          actorUserId: actor.userId,
          actorIdentifier: actor.officerCode,
          actorRole: actor.role,
          actionType: 'UNAUTHORIZED_SCOPE_ESCALATION',
          domain: 'ADMIN_SCOPE',
          targetEntityId,
          outcome: 'DENIED',
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: { reason: 'STATE_ADMIN attempted to grant national/unrestricted state scope.' },
        });
        throw new ForbiddenProblemError(
          'STATE_ADMIN cannot assign national-level or unrestricted state scope.'
        );
      }

      for (const sId of stateIds) {
        if (!actorStates.has(sId)) {
          await this.auditService.recordSecurityEvent({
            adminUserId: actor.id,
            actorUserId: actor.userId,
            actorIdentifier: actor.officerCode,
            actorRole: actor.role,
            actionType: 'UNAUTHORIZED_SCOPE_ESCALATION',
            domain: 'ADMIN_SCOPE',
            targetEntityId,
            outcome: 'DENIED',
            requestId: ctx.requestId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            details: { attemptedStateId: sId, actorStateIds: Array.from(actorStates) },
          });
          throw new ForbiddenProblemError(
            `Jurisdiction violation: You cannot delegate scope for state '${sId}'.`
          );
        }
      }

      // Check elections belong to actor's states
      if (electionIds.length > 0) {
        const elections = await this.repository.getElectionStateIds(electionIds);
        for (const el of elections) {
          if (!el.stateId || !actorStates.has(el.stateId)) {
            await this.auditService.recordSecurityEvent({
              adminUserId: actor.id,
              actorUserId: actor.userId,
              actorIdentifier: actor.officerCode,
              actorRole: actor.role,
              actionType: 'UNAUTHORIZED_SCOPE_ESCALATION',
              domain: 'ADMIN_SCOPE',
              targetEntityId,
              outcome: 'DENIED',
              requestId: ctx.requestId,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              details: { attemptedElectionId: el.id, electionStateId: el.stateId },
            });
            throw new ForbiddenProblemError(
              `Jurisdiction violation: Election '${el.id}' is outside your state jurisdiction.`
            );
          }
        }
      }

      // Check constituencies belong to actor's states
      for (const cs of constituencyScopes) {
        const csState =
          cs.constituencyType === 'PARLIAMENTARY'
            ? refCheck.pcStateMap?.get(cs.parliamentaryConstituencyId ?? '')
            : refCheck.acStateMap?.get(cs.assemblyConstituencyId ?? '');
        if (!csState || !actorStates.has(csState)) {
          await this.auditService.recordSecurityEvent({
            adminUserId: actor.id,
            actorUserId: actor.userId,
            actorIdentifier: actor.officerCode,
            actorRole: actor.role,
            actionType: 'UNAUTHORIZED_SCOPE_ESCALATION',
            domain: 'ADMIN_SCOPE',
            targetEntityId,
            outcome: 'DENIED',
            requestId: ctx.requestId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            details: { attemptedConstituencyState: csState },
          });
          throw new ForbiddenProblemError(
            `Jurisdiction violation: Constituency '${cs.parliamentaryConstituencyId ?? cs.assemblyConstituencyId}' is outside your state jurisdiction.`
          );
        }
      }
    }
  }

  /**
   * Verifies that `actor` can read/inspect or modify an existing `target` administrator
   * based on jurisdiction rules.
   */
  private async assertActorCanAccessTargetAdmin(
    actor: SafeAdminUser,
    target: SafeAdminProfileDto,
    ctx: RequestAuditContext,
    actionLabel: string
  ): Promise<void> {
    if (actor.id === target.id) {
      return;
    }

    if (actor.role === 'SUPER_ADMIN' || actor.role === 'NATIONAL_ADMIN') {
      return;
    }

    // READ_ONLY_AUDITOR without state restrictions can view all admin accounts (read-only)
    if (
      actor.role === 'READ_ONLY_AUDITOR' &&
      actor.assignedStateIds.length === 0 &&
      actor.assignedElectionIds.length === 0
    ) {
      return;
    }

    // Scoped actor (STATE_ADMIN or state-scoped READ_ONLY_AUDITOR):
    // Target must have at least one assigned state and ALL target states must fall inside actor's states
    const actorStates = new Set(actor.assignedStateIds);
    const targetStates = target.assignedStateIds;

    if (targetStates.length === 0 || !targetStates.every((s) => actorStates.has(s))) {
      await this.auditService.recordSecurityEvent({
        adminUserId: actor.id,
        actorUserId: actor.userId,
        actorIdentifier: actor.officerCode,
        actorRole: actor.role,
        actionType: actionLabel,
        domain: 'ADMIN_USER',
        targetEntityId: target.id,
        outcome: 'DENIED',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          reason: 'Cross-jurisdiction administrator access attempt blocked.',
          actorStates: actor.assignedStateIds,
          targetStates: target.assignedStateIds,
        },
      });
      throw new ForbiddenProblemError(
        `Jurisdiction violation: Target administrator '${target.officerCode}' is outside your assigned state scope.`
      );
    }
  }

  /**
   * Authenticates an administrator using email/officerCode + password.
   * Implements timing equalization, generic failures, lockout defense, and session fixation rotation.
   */
  async loginAdmin(
    identifier: string,
    password: string,
    ctx: RequestAuditContext,
    existingSessionToken?: string | null
  ): Promise<AdminLoginResult> {
    const cleanId = identifier.trim();
    const record = await this.repository.findAdminByLoginIdentifier(cleanId);

    // Unknown identifier (or non-admin voter identifier): equalize timing, log, and return generic 401
    if (!record) {
      await this.passwordService.simulateVerifyTiming(password);
      await this.auditService.recordSecurityEvent({
        actorIdentifier: cleanId.slice(0, 100),
        actionType: 'ADMIN_LOGIN',
        domain: 'ADMIN_AUTH',
        targetEntityId: 'UNKNOWN',
        outcome: 'FAILURE',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { reason: 'Unrecognized administrator identifier.' },
      });
      throw new UnauthorizedProblemError('Invalid administrator credentials.');
    }

    const user = record.user;
    const now = new Date();

    // Check active brute-force lockout before validating (still verify timing to avoid oracle)
    if (user.lockoutUntil && user.lockoutUntil > now) {
      await this.passwordService.simulateVerifyTiming(password);
      await this.auditService.recordSecurityEvent({
        adminUserId: record.id,
        actorUserId: user.id,
        actorIdentifier: record.officerCode,
        actorRole: record.role,
        actionType: 'ADMIN_LOGIN',
        domain: 'ADMIN_AUTH',
        targetEntityId: record.id,
        outcome: 'DENIED',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          reason: 'Account temporarily locked due to repeated failed login attempts.',
          lockoutUntil: user.lockoutUntil.toISOString(),
        },
      });
      throw new UnauthorizedProblemError('Invalid administrator credentials.');
    }

    const passwordMatches = await this.passwordService.verifyPassword(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      const failureState = await this.repository.recordLoginFailure(
        user.id,
        AUTH_CONSTANTS.ADMIN_MAX_FAILED_ATTEMPTS,
        AUTH_CONSTANTS.ADMIN_LOCKOUT_DURATION_MS
      );
      await this.auditService.recordSecurityEvent({
        adminUserId: record.id,
        actorUserId: user.id,
        actorIdentifier: record.officerCode,
        actorRole: record.role,
        actionType: 'ADMIN_LOGIN',
        domain: 'ADMIN_AUTH',
        targetEntityId: record.id,
        outcome: 'FAILURE',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          reason: 'Invalid password.',
          failedLoginAttempts: failureState.failedLoginAttempts,
          lockedOut: Boolean(failureState.lockoutUntil),
        },
      });
      throw new UnauthorizedProblemError('Invalid administrator credentials.');
    }

    // Only AFTER proving password validity, reject suspended/deactivated account cleanly
    if (!user.isActive || !record.isActive || record.status !== 'ACTIVE') {
      await this.auditService.recordSecurityEvent({
        adminUserId: record.id,
        actorUserId: user.id,
        actorIdentifier: record.officerCode,
        actorRole: record.role,
        actionType: 'ADMIN_LOGIN',
        domain: 'ADMIN_AUTH',
        targetEntityId: record.id,
        outcome: 'DENIED',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          reason: `Login blocked because admin account status is ${record.status}.`,
        },
      });
      throw new ForbiddenProblemError(
        `This administrator account is ${record.status.toLowerCase()}. Access is denied.`
      );
    }

    // Rotate pre-existing session to prevent session fixation
    if (existingSessionToken) {
      const oldHash = this.sessionService.hashSessionToken(existingSessionToken);
      await this.repository.deleteSessionByHash(oldHash);
    }

    await this.repository.recordLoginSuccess(user.id);

    const rawSessionToken = this.sessionService.generateSessionToken();
    const sessionHash = this.sessionService.hashSessionToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.SESSION_DURATION_MS);

    await this.repository.createSession({
      sessionHash,
      userId: user.id,
      expiresAt,
      userAgent: ctx.userAgent ?? null,
      ipAddress: ctx.ipAddress ?? null,
    });

    const csrfToken = this.sessionService.generateCsrfToken(rawSessionToken);
    const updatedRecord = (await this.repository.findAdminById(record.id)) ?? record;

    await this.auditService.recordSecurityEvent({
      adminUserId: record.id,
      actorUserId: user.id,
      actorIdentifier: record.officerCode,
      actorRole: record.role,
      actionType: 'ADMIN_LOGIN',
      domain: 'ADMIN_AUTH',
      targetEntityId: record.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { role: record.role },
    });

    return {
      admin: this.toSafeAdminDto(updatedRecord),
      sessionToken: rawSessionToken,
      csrfToken,
    };
  }

  async logout(
    actor: SafeAdminUser,
    rawSessionToken: string | undefined,
    ctx: RequestAuditContext
  ): Promise<void> {
    if (rawSessionToken) {
      const sessionHash = this.sessionService.hashSessionToken(rawSessionToken);
      await this.repository.deleteSessionByHash(sessionHash);
    }

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ADMIN_LOGOUT',
      domain: 'ADMIN_AUTH',
      targetEntityId: actor.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {},
    });
  }

  async logoutAll(actor: SafeAdminUser, ctx: RequestAuditContext): Promise<number> {
    const revokedCount = await this.repository.deleteAllUserSessions(actor.userId);

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ADMIN_LOGOUT_ALL',
      domain: 'ADMIN_AUTH',
      targetEntityId: actor.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { revokedCount },
    });

    return revokedCount;
  }

  async getMyAdminProfile(adminId: string): Promise<SafeAdminProfileDto> {
    const record = await this.repository.findAdminById(adminId);
    if (!record) {
      throw new NotFoundProblemError('Administrator', adminId);
    }
    return this.toSafeAdminDto(record);
  }

  async updateMyProfile(
    actor: SafeAdminUser,
    input: { fullName?: string; designation?: string },
    ctx: RequestAuditContext
  ): Promise<SafeAdminProfileDto> {
    const updated = await this.repository.updateAdminSelfProfile(actor.id, input);

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ADMIN_SELF_PROFILE_UPDATED',
      domain: 'ADMIN_USER',
      targetEntityId: actor.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { updatedFields: Object.keys(input) },
    });

    return this.toSafeAdminDto(updated);
  }

  async listSessions(
    actor: SafeAdminUser,
    currentSessionHash?: string
  ): Promise<SafeSessionItem[]> {
    const sessions = await this.repository.listActiveSessions(actor.userId);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      lastActivityAt: s.lastActivityAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrent: s.id === currentSessionHash,
    }));
  }

  async revokeSession(
    actor: SafeAdminUser,
    sessionId: string,
    ctx: RequestAuditContext
  ): Promise<void> {
    const deleted = await this.repository.deleteUserSession(actor.userId, sessionId);
    if (!deleted) {
      throw new NotFoundProblemError('Session', sessionId);
    }

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ADMIN_SESSION_REVOKED',
      domain: 'ADMIN_AUTH',
      targetEntityId: sessionId,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {},
    });
  }

  async listAdminUsers(
    actor: SafeAdminUser,
    query: {
      page: number;
      limit: number;
      role?: AdminRole;
      status?: AdminStatus;
      stateId?: string;
      search?: string;
    },
    ctx: RequestAuditContext
  ) {
    let allowedStateIds: string[] | null = null;

    if (
      actor.role === 'STATE_ADMIN' ||
      (actor.role === 'READ_ONLY_AUDITOR' && actor.assignedStateIds.length > 0)
    ) {
      const scopeCheck = evaluateJurisdictionAccess(actor, {
        stateId: query.stateId ?? null,
      });

      if (!scopeCheck.allowed) {
        await this.auditService.recordSecurityEvent({
          adminUserId: actor.id,
          actorUserId: actor.userId,
          actorIdentifier: actor.officerCode,
          actorRole: actor.role,
          actionType: 'ADMIN_USERS_LIST_DENIED',
          domain: 'ADMIN_USER',
          targetEntityId: query.stateId ?? 'ALL',
          outcome: 'DENIED',
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: { reason: scopeCheck.reason, requestedStateId: query.stateId },
        });
        throw new ForbiddenProblemError(scopeCheck.reason);
      }

      allowedStateIds = actor.assignedStateIds;
    }

    const result = await this.repository.listAdminUsers({
      ...query,
      allowedStateIds,
    });

    return {
      items: result.items.map((r) => this.toSafeAdminDto(r)),
      pagination: result.pagination,
    };
  }

  async getAdminUserById(
    actor: SafeAdminUser,
    targetAdminId: string,
    ctx: RequestAuditContext
  ): Promise<SafeAdminProfileDto> {
    const targetRecord = await this.repository.findAdminById(targetAdminId);
    if (!targetRecord) {
      throw new NotFoundProblemError('Administrator', targetAdminId);
    }

    const targetDto = this.toSafeAdminDto(targetRecord);
    await this.assertActorCanAccessTargetAdmin(
      actor,
      targetDto,
      ctx,
      'ADMIN_USER_READ_DENIED'
    );

    return targetDto;
  }

  async createAdminUser(
    actor: SafeAdminUser,
    input: CreateAdminServiceInput,
    ctx: RequestAuditContext
  ): Promise<SafeAdminProfileDto> {
    // 1. Role delegation hierarchy check
    if (!canActorAssignRole(actor.role, input.role)) {
      await this.auditService.recordSecurityEvent({
        adminUserId: actor.id,
        actorUserId: actor.userId,
        actorIdentifier: actor.officerCode,
        actorRole: actor.role,
        actionType: 'PRIVILEGE_ESCALATION_ATTEMPT',
        domain: 'ADMIN_USER',
        targetEntityId: input.officerCode,
        outcome: 'DENIED',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { attemptedRole: input.role, actorRole: actor.role },
      });
      throw new ForbiddenProblemError(
        `Role '${actor.role}' is not authorized to provision administrators with role '${input.role}'.`
      );
    }

    // 2. Password policy enforcement
    const policy = this.passwordService.validatePasswordPolicy(input.password, {
      officerCode: input.officerCode,
      email: input.email,
    });
    if (!policy.valid) {
      throw new ValidationProblemError(
        'Administrator password does not meet security policy requirements.',
        policy.reasons.map((reason) => ({ name: 'password', reason }))
      );
    }

    // 3. Uniqueness checks (normalized email & officerCode)
    const [existingEmail, existingCode, existingUser] = await Promise.all([
      this.repository.findAdminByEmail(input.email),
      this.repository.findAdminByOfficerCode(input.officerCode),
      this.repository.findUserByIdentifier(input.officerCode),
    ]);

    if (existingEmail) {
      throw new ConflictProblemError(
        `An administrator account with email '${input.email.toLowerCase()}' already exists.`
      );
    }
    if (existingCode || existingUser) {
      throw new ConflictProblemError(
        `An account with identifier '${input.officerCode.toUpperCase()}' already exists.`
      );
    }

    // 4. Scope references & delegation check
    const { primaryStateId, uniqueStateIds } = this.resolveEffectiveStateInputs(
      input.assignedStateId,
      input.stateIds
    );
    const electionIds = Array.from(new Set(input.electionIds ?? []));
    const constituencyScopes = input.constituencyScopes ?? [];

    await this.assertScopeDelegationAllowed(
      actor,
      input.role,
      uniqueStateIds,
      electionIds,
      constituencyScopes,
      ctx,
      input.officerCode
    );

    // 5. Hash password and create atomically
    const passwordHash = await this.passwordService.hashPassword(input.password);
    const created = await this.repository.createAdminUser({
      officerCode: input.officerCode,
      email: input.email,
      fullName: input.fullName,
      designation: input.designation,
      role: input.role,
      passwordHash,
      assignedStateId: primaryStateId,
      stateIds: uniqueStateIds,
      electionIds,
      constituencyScopes,
      createdByAdminId: actor.id,
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ADMIN_USER_CREATED',
      domain: 'ADMIN_USER',
      targetEntityId: created.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        createdOfficerCode: created.officerCode,
        assignedRole: created.role,
        stateIds: uniqueStateIds,
        electionIds,
      },
    });

    return this.toSafeAdminDto(created);
  }

  async updateAdminUser(
    actor: SafeAdminUser,
    targetAdminId: string,
    input: UpdateAdminServiceInput,
    ctx: RequestAuditContext
  ): Promise<SafeAdminProfileDto> {
    const targetRecord = await this.repository.findAdminById(targetAdminId);
    if (!targetRecord) {
      throw new NotFoundProblemError('Administrator', targetAdminId);
    }

    const targetDto = this.toSafeAdminDto(targetRecord);

    // Prevent self-privilege escalation or self-scope modification via management API
    if (actor.id === targetAdminId) {
      if (
        input.role !== undefined ||
        input.assignedStateId !== undefined ||
        input.stateIds !== undefined ||
        input.electionIds !== undefined ||
        input.constituencyScopes !== undefined
      ) {
        await this.auditService.recordSecurityEvent({
          adminUserId: actor.id,
          actorUserId: actor.userId,
          actorIdentifier: actor.officerCode,
          actorRole: actor.role,
          actionType: 'SELF_PRIVILEGE_ESCALATION_ATTEMPT',
          domain: 'ADMIN_USER',
          targetEntityId: actor.id,
          outcome: 'DENIED',
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: { attemptedFields: Object.keys(input) },
        });
        throw new ForbiddenProblemError(
          'Administrators cannot modify their own role or jurisdiction scopes.'
        );
      }
    } else {
      if (!canActorManageTargetRole(actor.role, targetRecord.role)) {
        await this.auditService.recordSecurityEvent({
          adminUserId: actor.id,
          actorUserId: actor.userId,
          actorIdentifier: actor.officerCode,
          actorRole: actor.role,
          actionType: 'PRIVILEGE_ESCALATION_ATTEMPT',
          domain: 'ADMIN_USER',
          targetEntityId: targetRecord.id,
          outcome: 'DENIED',
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: { targetRole: targetRecord.role, actorRole: actor.role },
        });
        throw new ForbiddenProblemError(
          `Role '${actor.role}' is not authorized to modify a '${targetRecord.role}' administrator.`
        );
      }

      await this.assertActorCanAccessTargetAdmin(
        actor,
        targetDto,
        ctx,
        'ADMIN_USER_UPDATE_DENIED'
      );
    }

    if (input.role && input.role !== targetRecord.role) {
      if (!canActorAssignRole(actor.role, input.role)) {
        await this.auditService.recordSecurityEvent({
          adminUserId: actor.id,
          actorUserId: actor.userId,
          actorIdentifier: actor.officerCode,
          actorRole: actor.role,
          actionType: 'PRIVILEGE_ESCALATION_ATTEMPT',
          domain: 'ADMIN_USER',
          targetEntityId: targetRecord.id,
          outcome: 'DENIED',
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: { attemptedRole: input.role, previousRole: targetRecord.role },
        });
        throw new ForbiddenProblemError(
          `Role '${actor.role}' is not authorized to assign role '${input.role}'.`
        );
      }
    }

    if (input.email && input.email.toLowerCase() !== targetRecord.email) {
      const dup = await this.repository.findAdminByEmail(input.email);
      if (dup && dup.id !== targetRecord.id) {
        throw new ConflictProblemError(
          `Email '${input.email.toLowerCase()}' is already in use by another administrator.`
        );
      }
    }

    let passwordHash: string | undefined;
    if (input.password) {
      const policy = this.passwordService.validatePasswordPolicy(input.password, {
        officerCode: targetRecord.officerCode,
        email: input.email ?? targetRecord.email,
      });
      if (!policy.valid) {
        throw new ValidationProblemError(
          'Password does not meet security policy requirements.',
          policy.reasons.map((reason) => ({ name: 'password', reason }))
        );
      }
      passwordHash = await this.passwordService.hashPassword(input.password);
    }

    const effectiveRole = input.role ?? targetRecord.role;
    const scopesProvided =
      input.assignedStateId !== undefined ||
      input.stateIds !== undefined ||
      input.electionIds !== undefined ||
      input.constituencyScopes !== undefined;

    let nextPrimaryStateId: string | null | undefined;
    let nextStateIds: string[] | undefined;
    let nextElectionIds: string[] | undefined;
    let nextConstituencyScopes: ConstituencyScopeInput[] | undefined;

    if (scopesProvided) {
      const mergedStates = this.resolveEffectiveStateInputs(
        input.assignedStateId !== undefined
          ? input.assignedStateId
          : targetDto.assignedStateId,
        input.stateIds !== undefined ? input.stateIds : targetDto.assignedStateIds
      );
      nextPrimaryStateId =
        input.assignedStateId === null ? null : mergedStates.primaryStateId;
      nextStateIds = mergedStates.uniqueStateIds;
      nextElectionIds =
        input.electionIds !== undefined
          ? Array.from(new Set(input.electionIds))
          : targetDto.assignedElectionIds;
      nextConstituencyScopes =
        input.constituencyScopes !== undefined
          ? input.constituencyScopes
          : targetDto.assignedConstituencyScopes;

      await this.assertScopeDelegationAllowed(
        actor,
        effectiveRole,
        nextStateIds,
        nextElectionIds,
        nextConstituencyScopes,
        ctx,
        targetRecord.id
      );
    }

    const updated = await this.repository.updateAdminUser(
      targetRecord.id,
      targetRecord.userId,
      {
        fullName: input.fullName,
        designation: input.designation,
        email: input.email,
        role: input.role,
        passwordHash,
        assignedStateId: nextPrimaryStateId,
        stateIds: nextStateIds,
        electionIds: nextElectionIds,
        constituencyScopes: nextConstituencyScopes,
        assignedByAdminId: actor.id,
      }
    );

    const roleChanged = input.role && input.role !== targetRecord.role;
    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: roleChanged ? 'ADMIN_ROLE_CHANGED' : 'ADMIN_USER_UPDATED',
      domain: 'ADMIN_USER',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        previousRole: targetRecord.role,
        newRole: updated.role,
        updatedFields: Object.keys(input).filter((k) => k !== 'password'),
      },
    });

    return this.toSafeAdminDto(updated);
  }

  async suspendAdminUser(
    actor: SafeAdminUser,
    targetAdminId: string,
    input: { reason: string; mode: 'SUSPEND' | 'DEACTIVATE' },
    ctx: RequestAuditContext
  ): Promise<SafeAdminProfileDto> {
    if (actor.id === targetAdminId) {
      throw new ForbiddenProblemError(
        'Administrators cannot suspend or deactivate their own active account.'
      );
    }

    const targetRecord = await this.repository.findAdminById(targetAdminId);
    if (!targetRecord) {
      throw new NotFoundProblemError('Administrator', targetAdminId);
    }

    if (!canActorManageTargetRole(actor.role, targetRecord.role)) {
      await this.auditService.recordSecurityEvent({
        adminUserId: actor.id,
        actorUserId: actor.userId,
        actorIdentifier: actor.officerCode,
        actorRole: actor.role,
        actionType: 'ADMIN_SUSPEND_DENIED',
        domain: 'ADMIN_USER',
        targetEntityId: targetRecord.id,
        outcome: 'DENIED',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { targetRole: targetRecord.role, actorRole: actor.role },
      });
      throw new ForbiddenProblemError(
        `Role '${actor.role}' cannot suspend or deactivate a '${targetRecord.role}' account.`
      );
    }

    const targetDto = this.toSafeAdminDto(targetRecord);
    await this.assertActorCanAccessTargetAdmin(
      actor,
      targetDto,
      ctx,
      'ADMIN_SUSPEND_DENIED'
    );

    const nextStatus: AdminStatus =
      input.mode === 'DEACTIVATE' ? 'DEACTIVATED' : 'SUSPENDED';

    const updated = await this.repository.updateAdminStatus(
      targetRecord.id,
      targetRecord.userId,
      { status: nextStatus, reason: input.reason }
    );

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType:
        nextStatus === 'DEACTIVATED'
          ? 'ADMIN_USER_DEACTIVATED'
          : 'ADMIN_USER_SUSPENDED',
      domain: 'ADMIN_USER',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        targetOfficerCode: updated.officerCode,
        reason: input.reason,
        sessionsRevoked: true,
      },
    });

    return this.toSafeAdminDto(updated);
  }

  async activateAdminUser(
    actor: SafeAdminUser,
    targetAdminId: string,
    input: { note?: string },
    ctx: RequestAuditContext
  ): Promise<SafeAdminProfileDto> {
    const targetRecord = await this.repository.findAdminById(targetAdminId);
    if (!targetRecord) {
      throw new NotFoundProblemError('Administrator', targetAdminId);
    }

    if (!canActorManageTargetRole(actor.role, targetRecord.role)) {
      throw new ForbiddenProblemError(
        `Role '${actor.role}' cannot activate a '${targetRecord.role}' account.`
      );
    }

    const targetDto = this.toSafeAdminDto(targetRecord);
    await this.assertActorCanAccessTargetAdmin(
      actor,
      targetDto,
      ctx,
      'ADMIN_ACTIVATE_DENIED'
    );

    const updated = await this.repository.updateAdminStatus(
      targetRecord.id,
      targetRecord.userId,
      { status: 'ACTIVE', reason: null }
    );

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ADMIN_USER_ACTIVATED',
      domain: 'ADMIN_USER',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { targetOfficerCode: updated.officerCode, note: input.note ?? '' },
    });

    return this.toSafeAdminDto(updated);
  }

  async getAdminScopes(
    actor: SafeAdminUser,
    targetAdminId: string,
    ctx: RequestAuditContext
  ) {
    const targetRecord = await this.repository.findAdminById(targetAdminId);
    if (!targetRecord) {
      throw new NotFoundProblemError('Administrator', targetAdminId);
    }

    const targetDto = this.toSafeAdminDto(targetRecord);

    if (actor.id !== targetAdminId) {
      if (!getPermissionsForRole(actor.role).includes('admin.users.read')) {
        throw new ForbiddenProblemError(
          'You do not have permission to inspect other administrators scopes.'
        );
      }
      await this.assertActorCanAccessTargetAdmin(
        actor,
        targetDto,
        ctx,
        'ADMIN_SCOPES_READ_DENIED'
      );
    }

    return {
      adminUserId: targetDto.id,
      officerCode: targetDto.officerCode,
      role: targetDto.role,
      assignedStateId: targetDto.assignedStateId,
      assignedStateIds: targetDto.assignedStateIds,
      assignedElectionIds: targetDto.assignedElectionIds,
      assignedConstituencyScopes: targetDto.assignedConstituencyScopes,
    };
  }

  async updateAdminScopes(
    actor: SafeAdminUser,
    targetAdminId: string,
    input: UpdateScopesServiceInput,
    ctx: RequestAuditContext
  ): Promise<SafeAdminProfileDto> {
    if (actor.id === targetAdminId && actor.role !== 'SUPER_ADMIN') {
      await this.auditService.recordSecurityEvent({
        adminUserId: actor.id,
        actorUserId: actor.userId,
        actorIdentifier: actor.officerCode,
        actorRole: actor.role,
        actionType: 'UNAUTHORIZED_SCOPE_ESCALATION',
        domain: 'ADMIN_SCOPE',
        targetEntityId: actor.id,
        outcome: 'DENIED',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { reason: 'Non-SUPER_ADMIN attempted to modify their own scopes.' },
      });
      throw new ForbiddenProblemError(
        'Administrators cannot modify or expand their own jurisdiction scopes.'
      );
    }

    const targetRecord = await this.repository.findAdminById(targetAdminId);
    if (!targetRecord) {
      throw new NotFoundProblemError('Administrator', targetAdminId);
    }

    if (!canActorManageTargetRole(actor.role, targetRecord.role)) {
      throw new ForbiddenProblemError(
        `Role '${actor.role}' cannot manage jurisdiction scopes for a '${targetRecord.role}'.`
      );
    }

    const targetDto = this.toSafeAdminDto(targetRecord);
    await this.assertActorCanAccessTargetAdmin(
      actor,
      targetDto,
      ctx,
      'ADMIN_SCOPES_UPDATE_DENIED'
    );

    const { primaryStateId, uniqueStateIds } = this.resolveEffectiveStateInputs(
      input.assignedStateId,
      input.stateIds
    );
    const electionIds = Array.from(new Set(input.electionIds ?? []));
    const constituencyScopes = input.constituencyScopes ?? [];

    await this.assertScopeDelegationAllowed(
      actor,
      targetRecord.role,
      uniqueStateIds,
      electionIds,
      constituencyScopes,
      ctx,
      targetRecord.id
    );

    const updated = await this.repository.updateAdminUser(
      targetRecord.id,
      targetRecord.userId,
      {
        assignedStateId: input.assignedStateId === null ? null : primaryStateId,
        stateIds: uniqueStateIds,
        electionIds,
        constituencyScopes,
        assignedByAdminId: actor.id,
      }
    );

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ADMIN_SCOPE_UPDATED',
      domain: 'ADMIN_SCOPE',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        stateIds: uniqueStateIds,
        electionIds,
        constituencyCount: constituencyScopes.length,
      },
    });

    return this.toSafeAdminDto(updated);
  }

  getPermissionRegistry(actor: SafeAdminUser) {
    return {
      actorRole: actor.role,
      actorPermissions: getPermissionsForRole(actor.role),
      allPermissions: ALL_ADMIN_PERMISSIONS,
      roles: ADMIN_ROLE_METADATA,
      rolePermissionMatrix: ROLE_PERMISSION_MATRIX,
    };
  }

  async listAuditLogs(
    actor: SafeAdminUser,
    query: {
      page: number;
      limit: number;
      domain?: string;
      actionType?: string;
      outcome?: 'SUCCESS' | 'FAILURE' | 'DENIED';
      actorRole?: AdminRole;
      stateId?: string;
      electionId?: string;
    },
    ctx: RequestAuditContext
  ) {
    let allowedStateIds: string[] | null = null;

    if (
      actor.role === 'STATE_ADMIN' ||
      actor.role === 'ELECTION_OFFICER' ||
      (actor.role === 'READ_ONLY_AUDITOR' && actor.assignedStateIds.length > 0)
    ) {
      const check = evaluateJurisdictionAccess(actor, {
        stateId: query.stateId ?? null,
        electionId: query.electionId ?? null,
      });

      if (!check.allowed) {
        await this.auditService.recordSecurityEvent({
          adminUserId: actor.id,
          actorUserId: actor.userId,
          actorIdentifier: actor.officerCode,
          actorRole: actor.role,
          actionType: 'AUDIT_LOGS_ACCESS_DENIED',
          domain: 'AUDIT_LOG',
          targetEntityId: query.stateId ?? query.electionId ?? 'ALL',
          outcome: 'DENIED',
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: { reason: check.reason },
        });
        throw new ForbiddenProblemError(check.reason);
      }

      allowedStateIds = actor.assignedStateIds;
    }

    return this.auditService.listAuditLogs({
      page: query.page,
      limit: query.limit,
      domain: query.domain,
      actionType: query.actionType,
      outcome: query.outcome,
      actorRole: query.actorRole,
      allowedStateIds,
    });
  }
}
