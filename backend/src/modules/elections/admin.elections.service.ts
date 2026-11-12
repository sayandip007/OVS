import { ElectionStatus, ElectionType, type MetadataSource } from '@prisma/client';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import type { SafeAdminUser } from '../auth/auth.types.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';
import { roleHasPermission } from '../admin/admin.permissions.js';

function getActorStateIds(actor: SafeAdminUser): string[] {
  const ids = new Set<string>(actor.assignedStateIds ?? []);
  if (actor.assignedStateId) {
    ids.add(actor.assignedStateId);
  }
  return Array.from(ids);
}
import {
  findTransitionRule,
  getAllowedNextStatuses,
  isElectionArchivable,
  isElectionCancellable,
  isElectionMetadataEditable,
} from './election.lifecycle.js';
import {
  AdminElectionsRepository,
  type AdminElectionJurisdictionFilter,
  type ElectionWithRelations,
} from './admin.elections.repository.js';

export interface RequestAuditContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AdminElectionDto {
  id: string;
  name: string;
  type: ElectionType;
  year: number;
  stateId: string | null;
  state: { id: string; name: string; type: string } | null;
  status: ElectionStatus;
  country: string;
  targetJurisdiction: string;
  description: string;
  version: number;
  metadataSource: MetadataSource;
  pollingStartDate: string;
  pollingEndDate: string;
  countingDate: string;
  resultDate: string;
  createdAt: string;
  updatedAt: string;
  createdByAdmin: {
    id: string;
    officerCode: string;
    fullName: string;
    role: string;
  } | null;
  updatedByAdmin: {
    id: string;
    officerCode: string;
    fullName: string;
    role: string;
  } | null;
  cancelledAt: string | null;
  cancelledByAdmin: {
    id: string;
    officerCode: string;
    fullName: string;
    role: string;
  } | null;
  cancellationReason: string | null;
  archivedAt: string | null;
  archivedByAdmin: {
    id: string;
    officerCode: string;
    fullName: string;
    role: string;
  } | null;
  archiveNote: string | null;
  allowedNextStatuses: ElectionStatus[];
  canEditMetadata: boolean;
  canCancel: boolean;
  canArchive: boolean;
  counts: {
    constituencies: number;
    nominations: number;
    countingSessions: number;
    lifecycleEvents: number;
  };
}

function toIsoDateOnly(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function parseScheduleDates(
  year: number,
  input: {
    pollingStartDate?: string;
    pollingEndDate?: string;
    countingDate?: string;
    resultDate?: string;
  },
  existing?: {
    pollingStartDate: Date;
    pollingEndDate: Date;
    countingDate: Date;
    resultDate: Date;
  }
) {
  const pollingStartDate = input.pollingStartDate
    ? new Date(`${input.pollingStartDate}T00:00:00.000Z`)
    : existing?.pollingStartDate ?? new Date(`${year}-04-20T00:00:00.000Z`);
  const pollingEndDate = input.pollingEndDate
    ? new Date(`${input.pollingEndDate}T00:00:00.000Z`)
    : existing?.pollingEndDate ?? new Date(`${year}-05-15T00:00:00.000Z`);
  const countingDate = input.countingDate
    ? new Date(`${input.countingDate}T00:00:00.000Z`)
    : existing?.countingDate ?? new Date(`${year}-05-20T00:00:00.000Z`);
  const resultDate = input.resultDate
    ? new Date(`${input.resultDate}T00:00:00.000Z`)
    : existing?.resultDate ?? new Date(`${year}-05-22T00:00:00.000Z`);

  if (pollingStartDate > pollingEndDate) {
    throw new ValidationProblemError('Polling end date must be on or after polling start date.', [
      { name: 'pollingEndDate', reason: 'Must be >= pollingStartDate.' },
    ]);
  }
  if (pollingEndDate > countingDate) {
    throw new ValidationProblemError('Counting date must be on or after polling end date.', [
      { name: 'countingDate', reason: 'Must be >= pollingEndDate.' },
    ]);
  }
  if (countingDate > resultDate) {
    throw new ValidationProblemError('Result date must be on or after counting date.', [
      { name: 'resultDate', reason: 'Must be >= countingDate.' },
    ]);
  }

  return { pollingStartDate, pollingEndDate, countingDate, resultDate };
}

export class AdminElectionsService {
  constructor(
    private readonly repo: AdminElectionsRepository = new AdminElectionsRepository(),
    private readonly auditService: AdminAuditService = new AdminAuditService()
  ) {}

  toDto(el: ElectionWithRelations): AdminElectionDto {
    return {
      id: el.id,
      name: el.name,
      type: el.type,
      year: el.year,
      stateId: el.stateId,
      state: el.state,
      status: el.status,
      country: el.country,
      targetJurisdiction: el.targetJurisdiction,
      description: el.description,
      version: el.version,
      metadataSource: el.metadataSource,
      pollingStartDate: toIsoDateOnly(el.pollingStartDate),
      pollingEndDate: toIsoDateOnly(el.pollingEndDate),
      countingDate: toIsoDateOnly(el.countingDate),
      resultDate: toIsoDateOnly(el.resultDate),
      createdAt: el.createdAt.toISOString(),
      updatedAt: el.updatedAt.toISOString(),
      createdByAdmin: el.createdByAdmin,
      updatedByAdmin: el.updatedByAdmin,
      cancelledAt: el.cancelledAt ? el.cancelledAt.toISOString() : null,
      cancelledByAdmin: el.cancelledByAdmin,
      cancellationReason: el.cancellationReason,
      archivedAt: el.archivedAt ? el.archivedAt.toISOString() : null,
      archivedByAdmin: el.archivedByAdmin,
      archiveNote: el.archiveNote,
      allowedNextStatuses: getAllowedNextStatuses(el.status),
      canEditMetadata: isElectionMetadataEditable(el.status),
      canCancel: isElectionCancellable(el.status),
      canArchive: isElectionArchivable(el.status),
      counts: {
        constituencies: el._count.constituencyMappings,
        nominations: el._count.candidateNominations,
        countingSessions: el._count.countingSessions,
        lifecycleEvents: el._count.lifecycleHistory,
      },
    };
  }

  resolveJurisdictionFilter(actor: SafeAdminUser): AdminElectionJurisdictionFilter {
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'NATIONAL_ADMIN') {
      return { mode: 'ALL' };
    }
    if (actor.role === 'STATE_ADMIN') {
      return {
        mode: 'STATE',
        allowedStateIds: getActorStateIds(actor),
      };
    }
    if (actor.role === 'ELECTION_OFFICER') {
      return {
        mode: 'ELECTION',
        allowedElectionIds: actor.assignedElectionIds,
      };
    }
    // READ_ONLY_AUDITOR: respect explicit state/election scopes if assigned, else global read-only
    if (actor.assignedElectionIds.length > 0) {
      return {
        mode: 'ELECTION',
        allowedElectionIds: actor.assignedElectionIds,
      };
    }
    const stateIds = getActorStateIds(actor);
    if (stateIds.length > 0) {
      return {
        mode: 'STATE',
        allowedStateIds: stateIds,
      };
    }
    return { mode: 'ALL' };
  }

  private async assertActorCanAccessElection(
    actor: SafeAdminUser,
    election: ElectionWithRelations,
    ctx: RequestAuditContext
  ): Promise<void> {
    const filter = this.resolveJurisdictionFilter(actor);
    let allowed = false;

    if (filter.mode === 'ALL') {
      allowed = true;
    } else if (filter.mode === 'STATE') {
      allowed =
        election.type === ElectionType.STATE_ASSEMBLY &&
        Boolean(election.stateId) &&
        (filter.allowedStateIds ?? []).includes(election.stateId!);
    } else if (filter.mode === 'ELECTION') {
      allowed = (filter.allowedElectionIds ?? []).includes(election.id);
    }

    if (!allowed) {
      await this.auditService
        .recordSecurityEvent({
          adminUserId: actor.id,
          actorUserId: actor.userId,
          actorIdentifier: actor.officerCode,
          actorRole: actor.role,
          actionType: 'ELECTION_ACCESS_DENIED',
          domain: 'ELECTION_MANAGEMENT',
          targetEntityId: election.id,
          outcome: 'DENIED',
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: {
            electionType: election.type,
            electionStateId: election.stateId,
            actorRole: actor.role,
          },
        })
        .catch(() => {});

      throw new ForbiddenProblemError(
        `Access denied: Election '${election.id}' is outside your assigned jurisdiction scope.`
      );
    }
  }

  async getSummary(actor: SafeAdminUser) {
    const filter = this.resolveJurisdictionFilter(actor);
    return this.repo.getSummaryCounts(filter);
  }

  async listElections(
    actor: SafeAdminUser,
    query: {
      page: number;
      limit: number;
      search?: string;
      type?: ElectionType;
      stateId?: string;
      status?: ElectionStatus;
      sortBy: 'createdAt' | 'updatedAt' | 'pollingStartDate' | 'name' | 'year';
      sortOrder: 'asc' | 'desc';
    }
  ) {
    const filter = this.resolveJurisdictionFilter(actor);
    const result = await this.repo.listElections({
      ...query,
      jurisdictionFilter: filter,
    });
    return {
      items: result.items.map((el) => this.toDto(el)),
      total: result.total,
    };
  }

  async getElectionById(
    actor: SafeAdminUser,
    electionId: string,
    ctx: RequestAuditContext
  ) {
    const election = await this.repo.findElectionById(electionId);
    if (!election) {
      throw new NotFoundProblemError('Election', electionId);
    }
    await this.assertActorCanAccessElection(actor, election, ctx);
    return this.toDto(election);
  }

  async createElection(
    actor: SafeAdminUser,
    input: {
      id: string;
      name: string;
      type: ElectionType;
      year: number;
      stateId?: string | null;
      country: string;
      targetJurisdiction?: string;
      description: string;
      initialStatus: 'DRAFT' | 'UPCOMING';
      pollingStartDate?: string;
      pollingEndDate?: string;
      countingDate?: string;
      resultDate?: string;
      metadataSource: MetadataSource;
    },
    ctx: RequestAuditContext
  ) {
    // 1. Election-type and jurisdiction consistency
    let normalizedStateId: string | null = input.stateId ?? null;
    if (input.type === ElectionType.LOK_SABHA) {
      if (normalizedStateId !== null) {
        throw new ValidationProblemError(
          'Lok Sabha elections are national parliamentary elections and must not specify a single stateId.',
          [{ name: 'stateId', reason: 'Must be null/omitted for LOK_SABHA.' }]
        );
      }
    } else if (input.type === ElectionType.STATE_ASSEMBLY) {
      if (!normalizedStateId) {
        throw new ValidationProblemError(
          'State Legislative Assembly elections must belong to a specific state.',
          [{ name: 'stateId', reason: 'stateId is required for STATE_ASSEMBLY.' }]
        );
      }
    }

    // 2. Actor jurisdiction check for creation
    if (actor.role === 'STATE_ADMIN') {
      if (input.type !== ElectionType.STATE_ASSEMBLY) {
        await this.auditService
          .recordSecurityEvent({
            adminUserId: actor.id,
            actorUserId: actor.userId,
            actorIdentifier: actor.officerCode,
            actorRole: actor.role,
            actionType: 'ELECTION_CREATE_DENIED',
            domain: 'ELECTION_MANAGEMENT',
            targetEntityId: input.id,
            outcome: 'DENIED',
            requestId: ctx.requestId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            details: { reason: 'STATE_ADMIN attempted to create LOK_SABHA election' },
          })
          .catch(() => {});
        throw new ForbiddenProblemError(
          'State Administrators cannot create national Lok Sabha elections.'
        );
      }
      const allowedStates = getActorStateIds(actor);
      if (!normalizedStateId || !allowedStates.includes(normalizedStateId)) {
        throw new ForbiddenProblemError(
          `Jurisdiction denied: State '${normalizedStateId ?? 'NONE'}' is outside your assigned state scope.`
        );
      }
    }

    // 3. Validate referenced state exists
    let resolvedStateName = 'National (All Parliamentary Constituencies)';
    if (normalizedStateId) {
      const state = await this.repo.findStateById(normalizedStateId);
      if (!state) {
        throw new ValidationProblemError(
          `State '${normalizedStateId}' does not exist in the geographic registry.`,
          [{ name: 'stateId', reason: `Unknown state '${normalizedStateId}'.` }]
        );
      }
      resolvedStateName = `${state.name} (${state.id})`;
    }

    // 4. Duplicate identifier check
    const existing = await this.repo.findElectionById(input.id);
    if (existing) {
      throw new ConflictProblemError(
        `An election with identifier '${input.id}' already exists.`
      );
    }

    // 5. Schedule dates validation
    const dates = parseScheduleDates(input.year, input);

    const created = await this.repo.createElectionWithHistory({
      id: input.id,
      name: input.name,
      type: input.type,
      year: input.year,
      stateId: normalizedStateId,
      country: input.country,
      targetJurisdiction: input.targetJurisdiction?.trim() || resolvedStateName,
      description: input.description,
      status: input.initialStatus as ElectionStatus,
      pollingStartDate: dates.pollingStartDate,
      pollingEndDate: dates.pollingEndDate,
      countingDate: dates.countingDate,
      resultDate: dates.resultDate,
      metadataSource: input.metadataSource,
      createdByAdminId: actor.id,
      requestId: ctx.requestId,
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_CREATED',
      domain: 'ELECTION_MANAGEMENT',
      targetEntityId: created.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        type: created.type,
        stateId: created.stateId,
        status: created.status,
        year: created.year,
      },
    });

    return this.toDto(created);
  }

  async updateElectionMetadata(
    actor: SafeAdminUser,
    electionId: string,
    input: {
      name?: string;
      year?: number;
      country?: string;
      targetJurisdiction?: string;
      description?: string;
      pollingStartDate?: string;
      pollingEndDate?: string;
      countingDate?: string;
      resultDate?: string;
      expectedVersion?: number;
    },
    ctx: RequestAuditContext
  ) {
    const existing = await this.repo.findElectionById(electionId);
    if (!existing) {
      throw new NotFoundProblemError('Election', electionId);
    }
    await this.assertActorCanAccessElection(actor, existing, ctx);

    if (!isElectionMetadataEditable(existing.status)) {
      throw new ConflictProblemError(
        `Election '${electionId}' in status '${existing.status}' cannot have its metadata edited directly.`
      );
    }

    if (
      typeof input.expectedVersion === 'number' &&
      input.expectedVersion !== existing.version
    ) {
      throw new ConflictProblemError(
        `Stale election version (${input.expectedVersion} vs current ${existing.version}). Reload before editing.`
      );
    }

    const effectiveYear = input.year ?? existing.year;
    const dates = parseScheduleDates(effectiveYear, input, existing);

    const updated = await this.repo.updateElectionMetadataWithConcurrency({
      electionId,
      expectedVersion: input.expectedVersion ?? existing.version,
      currentStatus: existing.status,
      updatedByAdminId: actor.id,
      requestId: ctx.requestId,
      changes: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.year !== undefined ? { year: input.year } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.targetJurisdiction !== undefined
          ? { targetJurisdiction: input.targetJurisdiction }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        pollingStartDate: dates.pollingStartDate,
        pollingEndDate: dates.pollingEndDate,
        countingDate: dates.countingDate,
        resultDate: dates.resultDate,
      },
      changedFields: {
        updatedKeys: Object.keys(input).filter((k) => k !== 'expectedVersion'),
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_UPDATED',
      domain: 'ELECTION_MANAGEMENT',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        version: updated.version,
        updatedKeys: Object.keys(input).filter((k) => k !== 'expectedVersion'),
      },
    });

    return this.toDto(updated);
  }

  async transitionStatus(
    actor: SafeAdminUser,
    electionId: string,
    input: {
      targetStatus: ElectionStatus;
      note: string;
      expectedVersion?: number;
    },
    ctx: RequestAuditContext
  ) {
    if (
      input.targetStatus === ElectionStatus.CANCELLED ||
      input.targetStatus === ElectionStatus.ARCHIVED
    ) {
      throw new ValidationProblemError(
        `Use the dedicated /cancel or /archive endpoint to move an election to '${input.targetStatus}'.`,
        [{ name: 'targetStatus', reason: 'Explicit endpoint required for terminal actions.' }]
      );
    }

    const existing = await this.repo.findElectionById(electionId);
    if (!existing) {
      throw new NotFoundProblemError('Election', electionId);
    }
    await this.assertActorCanAccessElection(actor, existing, ctx);

    if (existing.status === input.targetStatus) {
      throw new ConflictProblemError(
        `Election '${electionId}' is already in status '${existing.status}'.`
      );
    }

    const rule = findTransitionRule(existing.status, input.targetStatus);
    if (!rule) {
      const allowed = getAllowedNextStatuses(existing.status);
      throw new ConflictProblemError(
        `Invalid election lifecycle transition from '${existing.status}' to '${input.targetStatus}'. Allowed next state(s): ${
          allowed.length > 0 ? allowed.join(', ') : 'None'
        }.`
      );
    }

    if (!roleHasPermission(actor.role, rule.requiredPermission)) {
      throw new ForbiddenProblemError(
        `Missing required permission '${rule.requiredPermission}' for this lifecycle transition.`
      );
    }

    if (
      typeof input.expectedVersion === 'number' &&
      input.expectedVersion !== existing.version
    ) {
      throw new ConflictProblemError(
        `Stale election version (${input.expectedVersion} vs current ${existing.version}).`
      );
    }

    const updated = await this.repo.transitionElectionStatusWithConcurrency({
      electionId,
      expectedVersion: input.expectedVersion ?? existing.version,
      fromStatus: existing.status,
      toStatus: input.targetStatus,
      action: 'STATUS_TRANSITION',
      actorAdminId: actor.id,
      note: input.note || rule.description,
      requestId: ctx.requestId,
      metadata: {
        fromStatus: existing.status,
        toStatus: input.targetStatus,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_STATUS_TRANSITIONED',
      domain: 'ELECTION_LIFECYCLE',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        fromStatus: existing.status,
        toStatus: updated.status,
        version: updated.version,
      },
    });

    return this.toDto(updated);
  }

  async cancelElection(
    actor: SafeAdminUser,
    electionId: string,
    input: { reason: string; expectedVersion?: number },
    ctx: RequestAuditContext
  ) {
    const existing = await this.repo.findElectionById(electionId);
    if (!existing) {
      throw new NotFoundProblemError('Election', electionId);
    }
    await this.assertActorCanAccessElection(actor, existing, ctx);

    if (existing.status === ElectionStatus.CANCELLED) {
      throw new ConflictProblemError(
        `Election '${electionId}' is already cancelled.`
      );
    }

    if (!isElectionCancellable(existing.status)) {
      throw new ConflictProblemError(
        `Election '${electionId}' in status '${existing.status}' cannot be cancelled.`
      );
    }

    if (
      typeof input.expectedVersion === 'number' &&
      input.expectedVersion !== existing.version
    ) {
      throw new ConflictProblemError(
        `Stale election version (${input.expectedVersion} vs current ${existing.version}).`
      );
    }

    const now = new Date();
    const updated = await this.repo.transitionElectionStatusWithConcurrency({
      electionId,
      expectedVersion: input.expectedVersion ?? existing.version,
      fromStatus: existing.status,
      toStatus: ElectionStatus.CANCELLED,
      action: 'ELECTION_CANCELLED',
      actorAdminId: actor.id,
      note: input.reason,
      requestId: ctx.requestId,
      extraData: {
        cancelledAt: now,
        cancelledByAdminId: actor.id,
        cancellationReason: input.reason,
      },
      metadata: {
        fromStatus: existing.status,
        toStatus: ElectionStatus.CANCELLED,
        reason: input.reason,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_CANCELLED',
      domain: 'ELECTION_LIFECYCLE',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        fromStatus: existing.status,
        reason: input.reason,
      },
    });

    return this.toDto(updated);
  }

  async archiveElection(
    actor: SafeAdminUser,
    electionId: string,
    input: { note: string; expectedVersion?: number },
    ctx: RequestAuditContext
  ) {
    const existing = await this.repo.findElectionById(electionId);
    if (!existing) {
      throw new NotFoundProblemError('Election', electionId);
    }
    await this.assertActorCanAccessElection(actor, existing, ctx);

    if (existing.status === ElectionStatus.ARCHIVED) {
      throw new ConflictProblemError(
        `Election '${electionId}' is already archived.`
      );
    }

    if (!isElectionArchivable(existing.status)) {
      throw new ConflictProblemError(
        `Election '${electionId}' in status '${existing.status}' cannot be archived. Only RESULTS_DECLARED or CANCELLED elections can be archived.`
      );
    }

    if (
      typeof input.expectedVersion === 'number' &&
      input.expectedVersion !== existing.version
    ) {
      throw new ConflictProblemError(
        `Stale election version (${input.expectedVersion} vs current ${existing.version}).`
      );
    }

    const now = new Date();
    const updated = await this.repo.transitionElectionStatusWithConcurrency({
      electionId,
      expectedVersion: input.expectedVersion ?? existing.version,
      fromStatus: existing.status,
      toStatus: ElectionStatus.ARCHIVED,
      action: 'ELECTION_ARCHIVED',
      actorAdminId: actor.id,
      note: input.note,
      requestId: ctx.requestId,
      extraData: {
        archivedAt: now,
        archivedByAdminId: actor.id,
        archiveNote: input.note,
      },
      metadata: {
        fromStatus: existing.status,
        toStatus: ElectionStatus.ARCHIVED,
        note: input.note,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_ARCHIVED',
      domain: 'ELECTION_LIFECYCLE',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        fromStatus: existing.status,
        note: input.note,
      },
    });

    return this.toDto(updated);
  }

  async getLifecycleHistory(
    actor: SafeAdminUser,
    electionId: string,
    query: { page: number; limit: number },
    ctx: RequestAuditContext
  ) {
    const existing = await this.repo.findElectionById(electionId);
    if (!existing) {
      throw new NotFoundProblemError('Election', electionId);
    }
    await this.assertActorCanAccessElection(actor, existing, ctx);

    const history = await this.repo.listLifecycleHistory(
      electionId,
      query.page,
      query.limit
    );

    return {
      items: history.items.map((h) => ({
        id: h.id,
        electionId: h.electionId,
        action: h.action,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedByAdmin: h.changedByAdmin,
        changedAt: h.changedAt.toISOString(),
        note: h.note,
        requestId: h.requestId,
        metadata: h.metadata,
      })),
      total: history.total,
    };
  }
}
