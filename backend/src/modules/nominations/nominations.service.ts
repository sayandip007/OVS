import {
  CandidateNominationStatus,
  ConstituencyType,
  ElectionType,
} from '@prisma/client';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import type { SafeAdminUser } from '../auth/auth.types.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';
import {
  findNominationTransitionRule,
  isElectionOpenForNominations,
  isNominationEditable,
} from './nomination.lifecycle.js';
import {
  NominationsRepository,
  type AdminNominationJurisdictionFilter,
} from './nominations.repository.js';

export interface RequestAuditCtx {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

function getActorStateIds(actor: SafeAdminUser): string[] {
  const ids = new Set<string>(actor.assignedStateIds ?? []);
  if (actor.assignedStateId) ids.add(actor.assignedStateId);
  return Array.from(ids);
}

export class NominationsService {
  constructor(
    private readonly repo: NominationsRepository = new NominationsRepository(),
    private readonly auditService: AdminAuditService = new AdminAuditService()
  ) {}

  toDto(nom: any) {
    const constituency =
      nom.constituencyType === ConstituencyType.PARLIAMENTARY
        ? nom.parliamentaryConstituency
        : nom.assemblyConstituency;

    return {
      id: nom.id,
      electionId: nom.electionId,
      election: nom.election ?? null,
      candidateId: nom.candidateId,
      candidate: nom.candidate ?? null,
      constituencyType: nom.constituencyType,
      parliamentaryConstituencyId: nom.parliamentaryConstituencyId,
      assemblyConstituencyId: nom.assemblyConstituencyId,
      constituency: constituency ?? null,
      isIndependent: nom.isIndependent,
      partyId: nom.partyId,
      party: nom.party ?? null,
      partySnapshot: nom.isIndependent
        ? null
        : {
            name: nom.partyNameSnapshot,
            abbreviation: nom.partyAbbreviationSnapshot,
            partyType: nom.partyTypeSnapshot,
          },
      status: nom.status,
      version: nom.version,
      nominationDate: nom.nominationDate.toISOString(),
      submittedAt: nom.submittedAt ? nom.submittedAt.toISOString() : null,
      submittedByAdmin: nom.submittedByAdmin ?? null,
      scrutinyNote: nom.scrutinyNote,
      scrutinyDate: nom.scrutinyDate ? nom.scrutinyDate.toISOString() : null,
      scrutinizedByAdmin: nom.scrutinizedByAdmin ?? null,
      decisionAt: nom.decisionAt ? nom.decisionAt.toISOString() : null,
      decisionReason: nom.decisionReason,
      withdrawnAt: nom.withdrawnAt ? nom.withdrawnAt.toISOString() : null,
      withdrawnByAdmin: nom.withdrawnByAdmin ?? null,
      withdrawalReason: nom.withdrawalReason,
      createdByAdmin: nom.createdByAdmin ?? null,
      createdAt: nom.createdAt.toISOString(),
      updatedAt: nom.updatedAt.toISOString(),
      historyCount: nom._count?.lifecycleHistory ?? 0,
    };
  }

  resolveJurisdictionFilter(
    actor: SafeAdminUser
  ): AdminNominationJurisdictionFilter {
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'NATIONAL_ADMIN') {
      return { mode: 'ALL' };
    }
    if (actor.role === 'STATE_ADMIN') {
      return { mode: 'STATE', allowedStateIds: getActorStateIds(actor) };
    }
    if (actor.role === 'ELECTION_OFFICER') {
      return {
        mode: 'ELECTION',
        allowedElectionIds: actor.assignedElectionIds,
      };
    }
    if (actor.assignedElectionIds.length > 0) {
      return { mode: 'ELECTION', allowedElectionIds: actor.assignedElectionIds };
    }
    const stateIds = getActorStateIds(actor);
    if (stateIds.length > 0) {
      return { mode: 'STATE', allowedStateIds: stateIds };
    }
    return { mode: 'ALL' };
  }

  private async assertCanAccessNomination(
    actor: SafeAdminUser,
    nom: any,
    ctx: RequestAuditCtx
  ) {
    const filter = this.resolveJurisdictionFilter(actor);
    let allowed = false;

    const nomStateId =
      nom.election?.stateId ??
      nom.parliamentaryConstituency?.stateId ??
      nom.assemblyConstituency?.stateId ??
      null;

    if (filter.mode === 'ALL') {
      allowed = true;
    } else if (filter.mode === 'STATE') {
      allowed = Boolean(
        nomStateId && (filter.allowedStateIds ?? []).includes(nomStateId)
      );
    } else if (filter.mode === 'ELECTION') {
      allowed = (filter.allowedElectionIds ?? []).includes(nom.electionId);
    }

    if (!allowed) {
      await this.auditService
        .recordSecurityEvent({
          adminUserId: actor.id,
          actorUserId: actor.userId,
          actorIdentifier: actor.officerCode,
          actorRole: actor.role,
          actionType: 'NOMINATION_ACCESS_DENIED',
          domain: 'NOMINATION_MANAGEMENT',
          targetEntityId: nom.id,
          outcome: 'DENIED',
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: { electionId: nom.electionId, stateId: nomStateId },
        })
        .catch(() => {});

      throw new ForbiddenProblemError(
        `Access denied: Nomination '${nom.id}' is outside your assigned jurisdiction scope.`
      );
    }
  }

  async listNominations(actor: SafeAdminUser, query: any) {
    const filter = this.resolveJurisdictionFilter(actor);
    const result = await this.repo.listNominations({
      ...query,
      jurisdictionFilter: filter,
    });
    return {
      items: result.items.map((n) => this.toDto(n)),
      total: result.total,
    };
  }

  async getNominationById(
    actor: SafeAdminUser,
    nominationId: string,
    ctx: RequestAuditCtx
  ) {
    const nom = await this.repo.findNominationById(nominationId);
    if (!nom) {
      throw new NotFoundProblemError('CandidateNomination', nominationId);
    }
    await this.assertCanAccessNomination(actor, nom, ctx);
    return this.toDto(nom);
  }

  async createNomination(
    actor: SafeAdminUser,
    input: {
      electionId: string;
      candidateId: string;
      constituencyType: ConstituencyType;
      parliamentaryConstituencyId?: string | null;
      assemblyConstituencyId?: string | null;
      isIndependent: boolean;
      partyId?: string | null;
      scrutinyNote: string;
    },
    ctx: RequestAuditCtx
  ) {
    // 1. Validate election exists & accepts nominations
    const election = await this.repo.findElection(input.electionId);
    if (!election) {
      throw new NotFoundProblemError('Election', input.electionId);
    }
    if (!isElectionOpenForNominations(election.status)) {
      throw new ConflictProblemError(
        `Election '${election.id}' in status '${election.status}' does not accept new nominations.`
      );
    }

    // 2. Election type <-> Constituency type compatibility
    const expectedType =
      election.type === ElectionType.LOK_SABHA
        ? ConstituencyType.PARLIAMENTARY
        : ConstituencyType.ASSEMBLY;
    if (input.constituencyType !== expectedType) {
      throw new ValidationProblemError(
        `Election '${election.id}' (${election.type}) requires '${expectedType}' constituency type.`,
        [{ name: 'constituencyType', reason: `Expected ${expectedType}.` }]
      );
    }

    const constituencyId =
      input.constituencyType === ConstituencyType.PARLIAMENTARY
        ? input.parliamentaryConstituencyId
        : input.assemblyConstituencyId;

    if (
      !constituencyId ||
      (input.constituencyType === ConstituencyType.PARLIAMENTARY &&
        input.assemblyConstituencyId) ||
      (input.constituencyType === ConstituencyType.ASSEMBLY &&
        input.parliamentaryConstituencyId)
    ) {
      throw new ValidationProblemError(
        'Provide exactly one constituency ID matching constituencyType.',
        [{ name: 'constituencyType', reason: 'Invalid polymorphic constituency target.' }]
      );
    }

    // 3. Verify constituency is mapped to election via election_constituencies
    const mapping = await this.repo.findElectionConstituencyMapping({
      electionId: election.id,
      constituencyType: input.constituencyType,
      constituencyId,
    });
    if (!mapping) {
      throw new ValidationProblemError(
        `Constituency '${constituencyId}' is not mapped to election '${election.id}'.`,
        [{ name: 'constituencyId', reason: 'Constituency is not assigned to this election.' }]
      );
    }

    const mappedStateId =
      mapping.parliamentaryConstituency?.stateId ??
      mapping.assemblyConstituency?.stateId ??
      election.stateId;

    // 4. Actor jurisdiction check
    if (actor.role === 'STATE_ADMIN') {
      const allowedStates = getActorStateIds(actor);
      if (
        election.type !== ElectionType.STATE_ASSEMBLY ||
        !mappedStateId ||
        !allowedStates.includes(mappedStateId)
      ) {
        throw new ForbiddenProblemError(
          `Jurisdiction denied: State Administrators cannot create nominations for election '${election.id}'.`
        );
      }
    } else if (actor.role === 'ELECTION_OFFICER') {
      if (!actor.assignedElectionIds.includes(election.id)) {
        throw new ForbiddenProblemError(
          `Jurisdiction denied: Election '${election.id}' is not in your assigned officer scope.`
        );
      }
    }

    // 5. Validate active candidate
    const candidate = await this.repo.findCandidate(input.candidateId);
    if (!candidate) {
      throw new NotFoundProblemError('Candidate', input.candidateId);
    }
    if (!candidate.isActive) {
      throw new ConflictProblemError(
        `Candidate '${candidate.id}' is inactive and cannot be nominated.`
      );
    }

    // 6. Validate independent vs party XOR & capture party snapshot
    let partyId: string | null = null;
    let partyNameSnapshot: string | null = null;
    let partyAbbreviationSnapshot: string | null = null;
    let partyTypeSnapshot: any = null;

    if (input.isIndependent) {
      if (input.partyId) {
        throw new ValidationProblemError(
          'An independent nomination cannot simultaneously specify a partyId.',
          [{ name: 'partyId', reason: 'Must be null/omitted when isIndependent=true.' }]
        );
      }
    } else {
      if (!input.partyId) {
        throw new ValidationProblemError(
          'A party-affiliated nomination must specify a valid partyId.',
          [{ name: 'partyId', reason: 'Required when isIndependent=false.' }]
        );
      }
      const party = await this.repo.findParty(input.partyId);
      if (!party) {
        throw new NotFoundProblemError('PoliticalParty', input.partyId);
      }
      if (party.status !== 'ACTIVE') {
        throw new ConflictProblemError(
          `Party '${party.id}' is '${party.status}' and cannot sponsor a new nomination.`
        );
      }
      partyId = party.id;
      partyNameSnapshot = party.name;
      partyAbbreviationSnapshot = party.abbreviation;
      partyTypeSnapshot = party.partyType;
    }

    // 7. Duplicate nomination guard (same election + candidate + constituency)
    const duplicate = await this.repo.findDuplicateNomination({
      electionId: election.id,
      candidateId: candidate.id,
      constituencyType: input.constituencyType,
      constituencyId,
    });
    if (duplicate) {
      throw new ConflictProblemError(
        `Candidate '${candidate.id}' already has a nomination in '${constituencyId}' for election '${election.id}'.`
      );
    }

    const created = await this.repo.createNominationWithHistory({
      electionId: election.id,
      candidateId: candidate.id,
      constituencyType: input.constituencyType,
      parliamentaryConstituencyId:
        input.constituencyType === ConstituencyType.PARLIAMENTARY
          ? constituencyId
          : null,
      assemblyConstituencyId:
        input.constituencyType === ConstituencyType.ASSEMBLY
          ? constituencyId
          : null,
      isIndependent: input.isIndependent,
      partyId,
      partyNameSnapshot,
      partyAbbreviationSnapshot,
      partyTypeSnapshot,
      scrutinyNote: input.scrutinyNote,
      createdByAdminId: actor.id,
      requestId: ctx.requestId,
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'NOMINATION_CREATED',
      domain: 'NOMINATION_MANAGEMENT',
      targetEntityId: created.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        electionId: created.electionId,
        candidateId: created.candidateId,
        isIndependent: created.isIndependent,
        partyId: created.partyId,
      },
    });

    return this.toDto(created);
  }

  async updateDraft(
    actor: SafeAdminUser,
    nominationId: string,
    input: {
      isIndependent?: boolean;
      partyId?: string | null;
      scrutinyNote?: string;
      expectedVersion?: number;
    },
    ctx: RequestAuditCtx
  ) {
    const existing = await this.repo.findNominationById(nominationId);
    if (!existing) {
      throw new NotFoundProblemError('CandidateNomination', nominationId);
    }
    await this.assertCanAccessNomination(actor, existing, ctx);

    if (!isNominationEditable(existing.status)) {
      throw new ConflictProblemError(
        `Nomination '${nominationId}' in status '${existing.status}' cannot be edited.`
      );
    }
    if (
      typeof input.expectedVersion === 'number' &&
      input.expectedVersion !== existing.version
    ) {
      throw new ConflictProblemError(
        `Stale nomination version (${input.expectedVersion} vs ${existing.version}).`
      );
    }

    const nextIsIndependent = input.isIndependent ?? existing.isIndependent;
    let nextPartyId =
      input.partyId !== undefined ? input.partyId : existing.partyId;
    let snapshotData: Record<string, any> = {};

    if (nextIsIndependent) {
      nextPartyId = null;
      snapshotData = {
        partyNameSnapshot: null,
        partyAbbreviationSnapshot: null,
        partyTypeSnapshot: null,
      };
    } else {
      if (!nextPartyId) {
        throw new ValidationProblemError(
          'partyId is required for party-affiliated nominations.',
          [{ name: 'partyId', reason: 'Required when isIndependent=false.' }]
        );
      }
      const party = await this.repo.findParty(nextPartyId);
      if (!party || party.status !== 'ACTIVE') {
        throw new ConflictProblemError(
          `Party '${nextPartyId}' does not exist or is not ACTIVE.`
        );
      }
      snapshotData = {
        partyNameSnapshot: party.name,
        partyAbbreviationSnapshot: party.abbreviation,
        partyTypeSnapshot: party.partyType,
      };
    }

    const updated = await this.repo.updateDraftWithConcurrency({
      nominationId,
      expectedVersion: input.expectedVersion ?? existing.version,
      actorAdminId: actor.id,
      requestId: ctx.requestId,
      data: {
        isIndependent: nextIsIndependent,
        partyId: nextPartyId,
        ...snapshotData,
        ...(input.scrutinyNote !== undefined
          ? { scrutinyNote: input.scrutinyNote }
          : {}),
      },
    });

    return this.toDto(updated);
  }

  private async executeTransition(
    actor: SafeAdminUser,
    nominationId: string,
    targetStatus: CandidateNominationStatus,
    action: string,
    opts: { note?: string; reason?: string; expectedVersion?: number },
    ctx: RequestAuditCtx
  ) {
    const existing = await this.repo.findNominationById(nominationId);
    if (!existing) {
      throw new NotFoundProblemError('CandidateNomination', nominationId);
    }
    await this.assertCanAccessNomination(actor, existing, ctx);

    const rule = findNominationTransitionRule(existing.status, targetStatus);
    if (!rule) {
      throw new ConflictProblemError(
        `Invalid nomination transition from '${existing.status}' to '${targetStatus}'.`
      );
    }

    if (
      typeof opts.expectedVersion === 'number' &&
      opts.expectedVersion !== existing.version
    ) {
      throw new ConflictProblemError(
        `Stale nomination version (${opts.expectedVersion} vs current ${existing.version}).`
      );
    }

    // Re-verify active candidate and party on submit/approve
    if (
      targetStatus === CandidateNominationStatus.SUBMITTED ||
      targetStatus === CandidateNominationStatus.APPROVED
    ) {
      if (!existing.candidate.isActive) {
        throw new ConflictProblemError(
          `Candidate '${existing.candidateId}' is inactive.`
        );
      }
      if (!existing.isIndependent && existing.party?.status !== 'ACTIVE') {
        throw new ConflictProblemError(
          `Party '${existing.partyId}' is no longer ACTIVE.`
        );
      }
    }

    // Separation of duties: submitter cannot approve their own submitted nomination
    if (
      targetStatus === CandidateNominationStatus.APPROVED &&
      existing.submittedByAdminId &&
      existing.submittedByAdminId === actor.id
    ) {
      throw new ForbiddenProblemError(
        'Separation-of-duties policy: An administrator cannot approve a nomination they submitted.'
      );
    }

    const now = new Date();
    const extraData: Record<string, any> = {};
    if (targetStatus === CandidateNominationStatus.SUBMITTED) {
      extraData.submittedAt = now;
      extraData.submittedByAdminId = actor.id;
    } else if (targetStatus === CandidateNominationStatus.UNDER_REVIEW) {
      extraData.scrutinyDate = now;
      extraData.scrutinizedByAdminId = actor.id;
      if (opts.note) extraData.scrutinyNote = opts.note;
    } else if (
      targetStatus === CandidateNominationStatus.APPROVED ||
      targetStatus === CandidateNominationStatus.REJECTED
    ) {
      extraData.scrutinyDate = now;
      extraData.scrutinizedByAdminId = actor.id;
      extraData.decisionAt = now;
      extraData.decisionReason = opts.reason ?? opts.note ?? null;
      if (opts.reason || opts.note) {
        extraData.scrutinyNote = opts.reason ?? opts.note;
      }
    } else if (targetStatus === CandidateNominationStatus.WITHDRAWN) {
      extraData.withdrawnAt = now;
      extraData.withdrawnByAdminId = actor.id;
      extraData.withdrawalReason = opts.reason ?? '';
    }

    const updated = await this.repo.transitionNominationWithConcurrency({
      nominationId,
      expectedVersion: opts.expectedVersion ?? existing.version,
      fromStatus: existing.status,
      toStatus: targetStatus,
      action,
      actorAdminId: actor.id,
      note: opts.reason ?? opts.note ?? rule.description,
      requestId: ctx.requestId,
      extraData,
      metadata: {
        electionId: existing.electionId,
        fromStatus: existing.status,
        toStatus: targetStatus,
        reason: opts.reason ?? null,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: action,
      domain: 'NOMINATION_LIFECYCLE',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        electionId: updated.electionId,
        fromStatus: existing.status,
        toStatus: updated.status,
        reason: opts.reason ?? undefined,
      },
    });

    return this.toDto(updated);
  }

  submitNomination(
    actor: SafeAdminUser,
    nominationId: string,
    body: { note?: string; expectedVersion?: number },
    ctx: RequestAuditCtx
  ) {
    return this.executeTransition(
      actor,
      nominationId,
      CandidateNominationStatus.SUBMITTED,
      'NOMINATION_SUBMITTED',
      body,
      ctx
    );
  }

  reviewNomination(
    actor: SafeAdminUser,
    nominationId: string,
    body: { note?: string; expectedVersion?: number },
    ctx: RequestAuditCtx
  ) {
    return this.executeTransition(
      actor,
      nominationId,
      CandidateNominationStatus.UNDER_REVIEW,
      'NOMINATION_REVIEW_STARTED',
      body,
      ctx
    );
  }

  approveNomination(
    actor: SafeAdminUser,
    nominationId: string,
    body: { note?: string; expectedVersion?: number },
    ctx: RequestAuditCtx
  ) {
    return this.executeTransition(
      actor,
      nominationId,
      CandidateNominationStatus.APPROVED,
      'NOMINATION_APPROVED',
      body,
      ctx
    );
  }

  rejectNomination(
    actor: SafeAdminUser,
    nominationId: string,
    body: { reason: string; expectedVersion?: number },
    ctx: RequestAuditCtx
  ) {
    return this.executeTransition(
      actor,
      nominationId,
      CandidateNominationStatus.REJECTED,
      'NOMINATION_REJECTED',
      body,
      ctx
    );
  }

  withdrawNomination(
    actor: SafeAdminUser,
    nominationId: string,
    body: { reason: string; expectedVersion?: number },
    ctx: RequestAuditCtx
  ) {
    return this.executeTransition(
      actor,
      nominationId,
      CandidateNominationStatus.WITHDRAWN,
      'NOMINATION_WITHDRAWN',
      body,
      ctx
    );
  }

  async getHistory(
    actor: SafeAdminUser,
    nominationId: string,
    query: { page: number; limit: number },
    ctx: RequestAuditCtx
  ) {
    const existing = await this.repo.findNominationById(nominationId);
    if (!existing) {
      throw new NotFoundProblemError('CandidateNomination', nominationId);
    }
    await this.assertCanAccessNomination(actor, existing, ctx);

    const history = await this.repo.listLifecycleHistory(
      nominationId,
      query.page,
      query.limit
    );
    return {
      items: history.items.map((h) => ({
        id: h.id,
        nominationId: h.nominationId,
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
