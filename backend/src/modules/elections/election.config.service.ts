import {
  ConfigurationReviewStatus,
  ConstituencyAssignmentStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
  ScheduleMilestoneStatus,
  ScheduleMilestoneType,
  type PrismaClient,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import type { SafeAdminUser } from '../auth/auth.types.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';
import {
  isValidIanaTimezone,
  validateElectionSchedule,
  type ScheduleMilestoneInput,
} from './election.schedule.validator.js';

const CONFIG_EDITABLE_ELECTION_STATUSES: ReadonlySet<ElectionStatus> = new Set([
  ElectionStatus.DRAFT,
  ElectionStatus.UPCOMING,
  ElectionStatus.NOMINATION_OPEN,
]);

const OPERATIONAL_OR_FINAL_STATUSES: ReadonlySet<ElectionStatus> = new Set([
  ElectionStatus.POLLING_ACTIVE,
  ElectionStatus.POLLING_COMPLETED,
  ElectionStatus.COUNTING,
  ElectionStatus.RESULTS_DECLARED,
  ElectionStatus.CANCELLED,
  ElectionStatus.ARCHIVED,
]);

function getActorStateIds(actor: SafeAdminUser): string[] {
  const ids = new Set<string>(actor.assignedStateIds ?? []);
  if (actor.assignedStateId) ids.add(actor.assignedStateId);
  return Array.from(ids);
}

export interface BulkRowValidationResult {
  constituencyId: string;
  valid: boolean;
  code:
    | 'VALID'
    | 'NOT_FOUND'
    | 'INVALID_TYPE'
    | 'CROSS_STATE_MISMATCH'
    | 'OUT_OF_ADMIN_SCOPE'
    | 'DUPLICATE_IN_BATCH'
    | 'ALREADY_ASSIGNED';
  message: string;
  stateId?: string;
  name?: string;
  constituencyType?: ConstituencyType;
}

export class ElectionConfigService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly auditService: AdminAuditService = new AdminAuditService()
  ) {}

  private async getAuthorizedElection(actor: SafeAdminUser, electionId: string) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: { state: { select: { id: true, name: true } } },
    });
    if (!election) {
      throw new NotFoundProblemError('Election', electionId);
    }

    if (actor.role === 'STATE_ADMIN') {
      const allowedStates = getActorStateIds(actor);
      if (
        election.type === ElectionType.STATE_ASSEMBLY &&
        (!election.stateId || !allowedStates.includes(election.stateId))
      ) {
        throw new ForbiddenProblemError(
          `Access denied: Election '${electionId}' is outside your assigned state scope.`
        );
      }
      // Note: STATE_ADMIN may manage PCs inside their state for LOK_SABHA if granted constituencies.manage,
      // but cannot approve/modify national-level election config unless scoped.
    } else if (actor.role === 'ELECTION_OFFICER') {
      if (!actor.assignedElectionIds.includes(electionId)) {
        throw new ForbiddenProblemError(
          `Access denied: Election '${electionId}' is outside your assigned officer scope.`
        );
      }
    }

    return election;
  }

  private assertConfigMutable(election: {
    id: string;
    status: ElectionStatus;
  }) {
    if (
      OPERATIONAL_OR_FINAL_STATUSES.has(election.status) ||
      !CONFIG_EDITABLE_ELECTION_STATUSES.has(election.status)
    ) {
      throw new ConflictProblemError(
        `Election '${election.id}' in status '${election.status}' does not allow configuration modifications.`
      );
    }
  }

  async listAssignedConstituencies(
    actor: SafeAdminUser,
    electionId: string,
    query: {
      page: number;
      limit: number;
      search?: string;
      stateId?: string;
      districtId?: string;
    }
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);

    const where: any = {
      electionId: election.id,
      status: ConstituencyAssignmentStatus.ACTIVE,
    };

    if (election.type === ElectionType.LOK_SABHA) {
      where.constituencyType = ConstituencyType.PARLIAMENTARY;
      if (query.stateId || query.search) {
        where.parliamentaryConstituency = {
          ...(query.stateId ? { stateId: query.stateId } : {}),
          ...(query.search
            ? {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { id: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };
      }
    } else {
      where.constituencyType = ConstituencyType.ASSEMBLY;
      if (query.stateId || query.districtId || query.search) {
        where.assemblyConstituency = {
          ...(query.stateId ? { stateId: query.stateId } : {}),
          ...(query.districtId ? { districtId: query.districtId } : {}),
          ...(query.search
            ? {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { id: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.electionConstituency.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          parliamentaryConstituency: {
            include: { state: { select: { id: true, name: true } } },
          },
          assemblyConstituency: {
            include: {
              state: { select: { id: true, name: true } },
              district: { select: { id: true, name: true } },
            },
          },
          assignedByAdmin: {
            select: { id: true, officerCode: true, fullName: true },
          },
        },
      }),
      this.prisma.electionConstituency.count({ where }),
    ]);

    return {
      items: items.map((m) => ({
        id: m.id,
        electionId: m.electionId,
        constituencyType: m.constituencyType,
        constituencyId:
          m.constituencyType === ConstituencyType.PARLIAMENTARY
            ? m.parliamentaryConstituencyId
            : m.assemblyConstituencyId,
        constituency:
          m.constituencyType === ConstituencyType.PARLIAMENTARY
            ? m.parliamentaryConstituency
            : m.assemblyConstituency,
        status: m.status,
        assignedByAdmin: m.assignedByAdmin,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
    };
  }

  async listAvailableConstituencies(
    actor: SafeAdminUser,
    electionId: string,
    query: {
      page: number;
      limit: number;
      search?: string;
      stateId?: string;
      districtId?: string;
    }
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);

    const existing = await this.prisma.electionConstituency.findMany({
      where: { electionId: election.id, status: ConstituencyAssignmentStatus.ACTIVE },
      select: {
        parliamentaryConstituencyId: true,
        assemblyConstituencyId: true,
      },
    });

    if (election.type === ElectionType.LOK_SABHA) {
      const assignedPcIds = existing
        .map((e) => e.parliamentaryConstituencyId)
        .filter((v): v is string => Boolean(v));

      const allowedStateIds =
        actor.role === 'STATE_ADMIN' ? getActorStateIds(actor) : null;

      const where: any = {
        ...(assignedPcIds.length > 0 ? { id: { notIn: assignedPcIds } } : {}),
        ...(allowedStateIds
          ? { stateId: { in: allowedStateIds } }
          : query.stateId
            ? { stateId: query.stateId }
            : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { id: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        this.prisma.parliamentaryConstituency.findMany({
          where,
          orderBy: [{ stateId: 'asc' }, { constituencyNumber: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: { state: { select: { id: true, name: true } } },
        }),
        this.prisma.parliamentaryConstituency.count({ where }),
      ]);

      return {
        items: items.map((pc) => ({
          ...pc,
          constituencyType: ConstituencyType.PARLIAMENTARY,
        })),
        total,
      };
    }

    // STATE_ASSEMBLY: strictly restricted to election.stateId
    const assignedAcIds = existing
      .map((e) => e.assemblyConstituencyId)
      .filter((v): v is string => Boolean(v));

    const where: any = {
      stateId: election.stateId!,
      ...(assignedAcIds.length > 0 ? { id: { notIn: assignedAcIds } } : {}),
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { id: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.assemblyConstituency.findMany({
        where,
        orderBy: [{ constituencyNumber: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          state: { select: { id: true, name: true } },
          district: { select: { id: true, name: true } },
        },
      }),
      this.prisma.assemblyConstituency.count({ where }),
    ]);

    return {
      items: items.map((ac) => ({
        ...ac,
        constituencyType: ConstituencyType.ASSEMBLY,
      })),
      total,
    };
  }

  async previewBulkAssignment(
    actor: SafeAdminUser,
    electionId: string,
    constituencyIds: string[]
  ): Promise<{
    electionId: string;
    electionType: ElectionType;
    stateId: string | null;
    allValid: boolean;
    validCount: number;
    invalidCount: number;
    rows: BulkRowValidationResult[];
  }> {
    const election = await this.getAuthorizedElection(actor, electionId);

    const [pcs, acs, existingMappings] = await Promise.all([
      this.prisma.parliamentaryConstituency.findMany({
        where: { id: { in: constituencyIds } },
        select: { id: true, name: true, stateId: true },
      }),
      this.prisma.assemblyConstituency.findMany({
        where: { id: { in: constituencyIds } },
        select: { id: true, name: true, stateId: true },
      }),
      this.prisma.electionConstituency.findMany({
        where: {
          electionId: election.id,
          status: ConstituencyAssignmentStatus.ACTIVE,
        },
        select: {
          parliamentaryConstituencyId: true,
          assemblyConstituencyId: true,
        },
      }),
    ]);

    const pcMap = new Map(pcs.map((p) => [p.id, p]));
    const acMap = new Map(acs.map((a) => [a.id, a]));
    const assignedSet = new Set<string>(
      existingMappings
        .map((m) => m.parliamentaryConstituencyId ?? m.assemblyConstituencyId)
        .filter((v): v is string => Boolean(v))
    );

    const seenInBatch = new Set<string>();
    const actorStateIds =
      actor.role === 'STATE_ADMIN' ? getActorStateIds(actor) : null;

    const rows: BulkRowValidationResult[] = constituencyIds.map((cid) => {
      if (seenInBatch.has(cid)) {
        return {
          constituencyId: cid,
          valid: false,
          code: 'DUPLICATE_IN_BATCH',
          message: `Constituency '${cid}' is duplicated in the submitted batch.`,
        };
      }
      seenInBatch.add(cid);

      if (assignedSet.has(cid)) {
        return {
          constituencyId: cid,
          valid: false,
          code: 'ALREADY_ASSIGNED',
          message: `Constituency '${cid}' is already assigned to election '${election.id}'.`,
        };
      }

      const pc = pcMap.get(cid);
      const ac = acMap.get(cid);

      if (!pc && !ac) {
        return {
          constituencyId: cid,
          valid: false,
          code: 'NOT_FOUND',
          message: `Constituency '${cid}' does not exist in the geographic registry.`,
        };
      }

      if (election.type === ElectionType.LOK_SABHA) {
        if (!pc) {
          return {
            constituencyId: cid,
            valid: false,
            code: 'INVALID_TYPE',
            message: `Assembly Constituency '${cid}' cannot be assigned to Lok Sabha election '${election.id}'.`,
            constituencyType: ConstituencyType.ASSEMBLY,
            stateId: ac?.stateId,
            name: ac?.name,
          };
        }
        if (actorStateIds && !actorStateIds.includes(pc.stateId)) {
          return {
            constituencyId: cid,
            valid: false,
            code: 'OUT_OF_ADMIN_SCOPE',
            message: `Parliamentary Constituency '${cid}' (${pc.stateId}) is outside your assigned state scope.`,
            constituencyType: ConstituencyType.PARLIAMENTARY,
            stateId: pc.stateId,
            name: pc.name,
          };
        }
        return {
          constituencyId: cid,
          valid: true,
          code: 'VALID',
          message: 'Eligible Parliamentary Constituency.',
          constituencyType: ConstituencyType.PARLIAMENTARY,
          stateId: pc.stateId,
          name: pc.name,
        };
      }

      // STATE_ASSEMBLY
      if (!ac) {
        return {
          constituencyId: cid,
          valid: false,
          code: 'INVALID_TYPE',
          message: `Parliamentary Constituency '${cid}' cannot be assigned to State Assembly election '${election.id}'.`,
          constituencyType: ConstituencyType.PARLIAMENTARY,
          stateId: pc?.stateId,
          name: pc?.name,
        };
      }
      if (ac.stateId !== election.stateId) {
        return {
          constituencyId: cid,
          valid: false,
          code: 'CROSS_STATE_MISMATCH',
          message: `Assembly Constituency '${cid}' belongs to '${ac.stateId}', not election state '${election.stateId}'.`,
          constituencyType: ConstituencyType.ASSEMBLY,
          stateId: ac.stateId,
          name: ac.name,
        };
      }
      if (actorStateIds && !actorStateIds.includes(ac.stateId)) {
        return {
          constituencyId: cid,
          valid: false,
          code: 'OUT_OF_ADMIN_SCOPE',
          message: `Assembly Constituency '${cid}' is outside your assigned state scope.`,
          constituencyType: ConstituencyType.ASSEMBLY,
          stateId: ac.stateId,
          name: ac.name,
        };
      }
      return {
        constituencyId: cid,
        valid: true,
        code: 'VALID',
        message: 'Eligible Assembly Constituency.',
        constituencyType: ConstituencyType.ASSEMBLY,
        stateId: ac.stateId,
        name: ac.name,
      };
    });

    const validCount = rows.filter((r) => r.valid).length;
    return {
      electionId: election.id,
      electionType: election.type,
      stateId: election.stateId,
      allValid: validCount === rows.length,
      validCount,
      invalidCount: rows.length - validCount,
      rows,
    };
  }

  async bulkAssignConstituencies(
    actor: SafeAdminUser,
    electionId: string,
    input: {
      constituencyIds: string[];
      note: string;
      expectedVersion?: number;
    },
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);
    this.assertConfigMutable(election);

    if (
      typeof input.expectedVersion === 'number' &&
      input.expectedVersion !== election.version
    ) {
      throw new ConflictProblemError(
        `Concurrent election modification detected (expected v${input.expectedVersion}, current v${election.version}).`
      );
    }

    const preview = await this.previewBulkAssignment(
      actor,
      electionId,
      input.constituencyIds
    );
    if (!preview.allValid) {
      const invalidRows = preview.rows.filter((r) => !r.valid);
      const hasScopeErr = invalidRows.some(
        (r) => r.code === 'OUT_OF_ADMIN_SCOPE'
      );
      const hasDupErr = invalidRows.some(
        (r) => r.code === 'ALREADY_ASSIGNED' || r.code === 'DUPLICATE_IN_BATCH'
      );

      if (hasScopeErr) {
        throw new ForbiddenProblemError(invalidRows[0]!.message);
      }
      if (hasDupErr && invalidRows.length === 1) {
        throw new ConflictProblemError(invalidRows[0]!.message);
      }
      throw new ValidationProblemError(
        `Bulk assignment failed validation for ${invalidRows.length} constituency row(s).`,
        invalidRows.map((r) => ({
          name: r.constituencyId,
          reason: `${r.code}: ${r.message}`,
        }))
      );
    }

    const targetType =
      election.type === ElectionType.LOK_SABHA
        ? ConstituencyType.PARLIAMENTARY
        : ConstituencyType.ASSEMBLY;

    await this.prisma.$transaction(async (tx) => {
      const verRes = await tx.election.updateMany({
        where: { id: election.id, version: input.expectedVersion ?? election.version },
        data: {
          version: { increment: 1 },
          updatedByAdminId: actor.id,
          ...(election.configReviewStatus === ConfigurationReviewStatus.APPROVED
            ? { configReviewStatus: ConfigurationReviewStatus.DRAFT }
            : {}),
        },
      });
      if (verRes.count === 0) {
        throw new ConflictProblemError(
          `Concurrent election update detected for '${election.id}'.`
        );
      }

      for (const row of preview.rows) {
        await tx.electionConstituency.create({
          data: {
            electionId: election.id,
            constituencyType: targetType,
            parliamentaryConstituencyId:
              targetType === ConstituencyType.PARLIAMENTARY
                ? row.constituencyId
                : null,
            assemblyConstituencyId:
              targetType === ConstituencyType.ASSEMBLY ? row.constituencyId : null,
            status: ConstituencyAssignmentStatus.ACTIVE,
            assignedByAdminId: actor.id,
            metadata: { note: input.note },
          },
        });

        await tx.electionConstituencyHistory.create({
          data: {
            electionId: election.id,
            action: 'CONSTITUENCY_ASSIGNED',
            constituencyType: targetType,
            constituencyId: row.constituencyId,
            changedByAdminId: actor.id,
            note: input.note || `Assigned ${row.constituencyId} to ${election.id}.`,
            requestId: ctx.requestId ?? null,
            metadata: { stateId: row.stateId ?? null },
          },
        });
      }
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_CONSTITUENCIES_ASSIGNED',
      domain: 'ELECTION_CONFIGURATION',
      targetEntityId: election.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        count: preview.validCount,
        constituencyIds: input.constituencyIds,
      },
    });

    return {
      electionId: election.id,
      assignedCount: preview.validCount,
      constituencyIds: input.constituencyIds,
    };
  }

  async removeConstituency(
    actor: SafeAdminUser,
    electionId: string,
    constituencyId: string,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);
    this.assertConfigMutable(election);

    const mapping = await this.prisma.electionConstituency.findFirst({
      where: {
        electionId: election.id,
        status: ConstituencyAssignmentStatus.ACTIVE,
        OR: [
          { parliamentaryConstituencyId: constituencyId },
          { assemblyConstituencyId: constituencyId },
        ],
      },
      include: {
        parliamentaryConstituency: { select: { stateId: true } },
        assemblyConstituency: { select: { stateId: true } },
      },
    });

    if (!mapping) {
      throw new NotFoundProblemError('ElectionConstituency', constituencyId);
    }

    if (actor.role === 'STATE_ADMIN') {
      const targetState =
        mapping.parliamentaryConstituency?.stateId ??
        mapping.assemblyConstituency?.stateId;
      if (!targetState || !getActorStateIds(actor).includes(targetState)) {
        throw new ForbiddenProblemError(
          `Jurisdiction denied: Constituency '${constituencyId}' is outside your assigned state.`
        );
      }
    }

    const refNomCount = await this.prisma.candidateNomination.count({
      where: {
        electionId: election.id,
        OR: [
          { parliamentaryConstituencyId: constituencyId },
          { assemblyConstituencyId: constituencyId },
        ],
      },
    });

    if (refNomCount > 0) {
      throw new ConflictProblemError(
        `Cannot remove constituency '${constituencyId}' from '${election.id}' because ${refNomCount} candidate nomination(s) reference it.`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.electionConstituency.delete({ where: { id: mapping.id } });
      await tx.electionConstituencyHistory.create({
        data: {
          electionId: election.id,
          action: 'CONSTITUENCY_REMOVED',
          constituencyType: mapping.constituencyType,
          constituencyId,
          changedByAdminId: actor.id,
          note: `Removed unreferenced constituency '${constituencyId}'.`,
          requestId: ctx.requestId ?? null,
        },
      });
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_CONSTITUENCY_REMOVED',
      domain: 'ELECTION_CONFIGURATION',
      targetEntityId: election.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { constituencyId },
    });

    return { electionId: election.id, removedConstituencyId: constituencyId };
  }

  async listConstituencyHistory(
    actor: SafeAdminUser,
    electionId: string,
    query: { page: number; limit: number }
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);
    const where = { electionId: election.id };
    const [items, total] = await Promise.all([
      this.prisma.electionConstituencyHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          changedByAdmin: {
            select: { id: true, officerCode: true, fullName: true, role: true },
          },
        },
      }),
      this.prisma.electionConstituencyHistory.count({ where }),
    ]);

    return {
      items: items.map((h) => ({
        ...h,
        changedAt: h.changedAt.toISOString(),
      })),
      total,
    };
  }

  // =========================================================================
  // Schedule Management
  // =========================================================================

  async getSchedule(actor: SafeAdminUser, electionId: string) {
    const election = await this.getAuthorizedElection(actor, electionId);
    const milestones = await this.prisma.electionScheduleMilestone.findMany({
      where: { electionId: election.id },
      orderBy: { createdAt: 'asc' },
    });
    const validation = validateElectionSchedule(milestones, election.scheduleTimezone, {
      requireMandatory: election.status !== ElectionStatus.DRAFT,
    });

    return {
      electionId: election.id,
      timezone: election.scheduleTimezone,
      scheduleVersion: election.scheduleVersion,
      configReviewStatus: election.configReviewStatus,
      milestones: milestones.map((m) => ({
        id: m.id,
        milestoneType: m.milestoneType,
        startAt: m.startAt ? m.startAt.toISOString() : null,
        endAt: m.endAt ? m.endAt.toISOString() : null,
        timezone: m.timezone,
        status: m.status,
        note: m.note,
        updatedAt: m.updatedAt.toISOString(),
      })),
      validation,
    };
  }

  async upsertSchedule(
    actor: SafeAdminUser,
    electionId: string,
    input: {
      timezone: string;
      milestones: ScheduleMilestoneInput[];
      note: string;
      expectedScheduleVersion?: number;
    },
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);
    this.assertConfigMutable(election);

    if (
      typeof input.expectedScheduleVersion === 'number' &&
      input.expectedScheduleVersion !== election.scheduleVersion
    ) {
      throw new ConflictProblemError(
        `Stale scheduleVersion (${input.expectedScheduleVersion} vs current ${election.scheduleVersion}).`
      );
    }

    const validation = validateElectionSchedule(input.milestones, input.timezone, {
      requireMandatory: election.status !== ElectionStatus.DRAFT,
    });
    if (!validation.valid) {
      throw new ValidationProblemError(
        validation.issues[0]!.message,
        validation.issues.map((i) => ({
          name: i.milestoneType ?? i.code,
          reason: i.message,
        }))
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const ver = await tx.election.updateMany({
        where: {
          id: election.id,
          scheduleVersion: input.expectedScheduleVersion ?? election.scheduleVersion,
        },
        data: {
          scheduleTimezone: input.timezone,
          scheduleVersion: { increment: 1 },
          updatedByAdminId: actor.id,
          ...(election.configReviewStatus === ConfigurationReviewStatus.APPROVED
            ? { configReviewStatus: ConfigurationReviewStatus.DRAFT }
            : {}),
        },
      });
      if (ver.count === 0) {
        throw new ConflictProblemError(
          `Concurrent schedule modification detected for '${election.id}'.`
        );
      }

      for (const m of input.milestones) {
        const startAt = m.startAt ? new Date(m.startAt) : null;
        const endAt = m.endAt ? new Date(m.endAt) : null;
        await tx.electionScheduleMilestone.upsert({
          where: {
            electionId_milestoneType: {
              electionId: election.id,
              milestoneType: m.milestoneType,
            },
          },
          update: {
            startAt,
            endAt,
            timezone: m.timezone ?? input.timezone,
            status: (m as any).status ?? ScheduleMilestoneStatus.CONFIGURED,
            note: (m as any).note ?? '',
            updatedByAdminId: actor.id,
          },
          create: {
            electionId: election.id,
            milestoneType: m.milestoneType,
            startAt,
            endAt,
            timezone: m.timezone ?? input.timezone,
            status: (m as any).status ?? ScheduleMilestoneStatus.CONFIGURED,
            note: (m as any).note ?? '',
            createdByAdminId: actor.id,
            updatedByAdminId: actor.id,
          },
        });
      }

      await tx.electionScheduleHistory.create({
        data: {
          electionId: election.id,
          action: 'SCHEDULE_UPDATED',
          changedByAdminId: actor.id,
          note: input.note || `Updated ${input.milestones.length} schedule milestone(s).`,
          requestId: ctx.requestId ?? null,
          metadata: { timezone: input.timezone, count: input.milestones.length },
        },
      });
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_SCHEDULE_UPDATED',
      domain: 'ELECTION_CONFIGURATION',
      targetEntityId: election.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { timezone: input.timezone, milestoneCount: input.milestones.length },
    });

    return this.getSchedule(actor, electionId);
  }

  async updateMilestone(
    actor: SafeAdminUser,
    electionId: string,
    milestoneType: ScheduleMilestoneType,
    input: {
      startAt?: string | null;
      endAt?: string | null;
      timezone?: string;
      status?: ScheduleMilestoneStatus;
      note?: string;
      expectedScheduleVersion?: number;
    },
    ctx: RequestAuditCtx
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);
    this.assertConfigMutable(election);

    if (
      typeof input.expectedScheduleVersion === 'number' &&
      input.expectedScheduleVersion !== election.scheduleVersion
    ) {
      throw new ConflictProblemError(
        `Stale scheduleVersion (${input.expectedScheduleVersion} vs current ${election.scheduleVersion}).`
      );
    }

    const existing = await this.prisma.electionScheduleMilestone.findMany({
      where: { electionId: election.id },
    });
    const merged = existing.filter((m) => m.milestoneType !== milestoneType);
    const current = existing.find((m) => m.milestoneType === milestoneType);

    const candidateMilestone: ScheduleMilestoneInput = {
      milestoneType,
      startAt:
        input.startAt !== undefined ? input.startAt : current?.startAt ?? null,
      endAt: input.endAt !== undefined ? input.endAt : current?.endAt ?? null,
      timezone: input.timezone ?? current?.timezone ?? election.scheduleTimezone,
    };
    merged.push(candidateMilestone as any);

    const validation = validateElectionSchedule(merged, election.scheduleTimezone, {
      requireMandatory: false,
    });
    if (!validation.valid) {
      throw new ValidationProblemError(
        validation.issues[0]!.message,
        validation.issues.map((i) => ({
          name: i.milestoneType ?? i.code,
          reason: i.message,
        }))
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const ver = await tx.election.updateMany({
        where: {
          id: election.id,
          scheduleVersion:
            input.expectedScheduleVersion ?? election.scheduleVersion,
        },
        data: { scheduleVersion: { increment: 1 }, updatedByAdminId: actor.id },
      });
      if (ver.count === 0) {
        throw new ConflictProblemError('Concurrent schedule update detected.');
      }

      await tx.electionScheduleMilestone.upsert({
        where: {
          electionId_milestoneType: { electionId: election.id, milestoneType },
        },
        update: {
          ...(input.startAt !== undefined
            ? { startAt: input.startAt ? new Date(input.startAt) : null }
            : {}),
          ...(input.endAt !== undefined
            ? { endAt: input.endAt ? new Date(input.endAt) : null }
            : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          updatedByAdminId: actor.id,
        },
        create: {
          electionId: election.id,
          milestoneType,
          startAt: input.startAt ? new Date(input.startAt) : null,
          endAt: input.endAt ? new Date(input.endAt) : null,
          timezone: input.timezone ?? election.scheduleTimezone,
          status: input.status ?? ScheduleMilestoneStatus.CONFIGURED,
          note: input.note ?? '',
          createdByAdminId: actor.id,
          updatedByAdminId: actor.id,
        },
      });

      await tx.electionScheduleHistory.create({
        data: {
          electionId: election.id,
          action: 'MILESTONE_UPDATED',
          changedByAdminId: actor.id,
          note: `Updated milestone '${milestoneType}'.`,
          requestId: ctx.requestId ?? null,
        },
      });
    });

    return this.getSchedule(actor, electionId);
  }

  async validateSchedule(actor: SafeAdminUser, electionId: string) {
    const election = await this.getAuthorizedElection(actor, electionId);
    const milestones = await this.prisma.electionScheduleMilestone.findMany({
      where: { electionId: election.id },
    });
    return validateElectionSchedule(milestones, election.scheduleTimezone, {
      requireMandatory: true,
    });
  }

  async getScheduleHistory(
    actor: SafeAdminUser,
    electionId: string,
    query: { page: number; limit: number }
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);
    const where = { electionId: election.id };
    const [items, total] = await Promise.all([
      this.prisma.electionScheduleHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          changedByAdmin: {
            select: { id: true, officerCode: true, fullName: true, role: true },
          },
        },
      }),
      this.prisma.electionScheduleHistory.count({ where }),
    ]);

    return {
      items: items.map((h) => ({ ...h, changedAt: h.changedAt.toISOString() })),
      total,
    };
  }

  // =========================================================================
  // Configuration Readiness & Review Workflow
  // =========================================================================

  async validateConfigurationReadiness(actor: SafeAdminUser, electionId: string) {
    const election = await this.getAuthorizedElection(actor, electionId);

    const [mappings, milestones, nominations] = await Promise.all([
      this.prisma.electionConstituency.findMany({
        where: { electionId: election.id, status: ConstituencyAssignmentStatus.ACTIVE },
        include: {
          parliamentaryConstituency: { select: { id: true, stateId: true } },
          assemblyConstituency: { select: { id: true, stateId: true } },
        },
      }),
      this.prisma.electionScheduleMilestone.findMany({
        where: { electionId: election.id },
      }),
      this.prisma.candidateNomination.findMany({
        where: { electionId: election.id },
        select: {
          id: true,
          constituencyType: true,
          parliamentaryConstituencyId: true,
          assemblyConstituencyId: true,
        },
      }),
    ]);

    const issues: Array<{
      category: 'ELECTION' | 'CONSTITUENCIES' | 'SCHEDULE' | 'NOMINATIONS';
      code: string;
      message: string;
      affectedRecord?: string;
      suggestedAction: string;
    }> = [];

    if (
      election.type === ElectionType.STATE_ASSEMBLY &&
      !election.stateId
    ) {
      issues.push({
        category: 'ELECTION',
        code: 'MISSING_STATE_ASSOCIATION',
        message: 'State Assembly election must be associated with a stateId.',
        affectedRecord: election.id,
        suggestedAction: 'Associate the election with a valid State/UT.',
      });
    }

    if (mappings.length === 0) {
      issues.push({
        category: 'CONSTITUENCIES',
        code: 'NO_CONSTITUENCIES_ASSIGNED',
        message: `Election '${election.id}' has zero assigned constituencies.`,
        affectedRecord: election.id,
        suggestedAction: 'Assign at least one compatible constituency.',
      });
    }

    const assignedSet = new Set<string>();
    for (const m of mappings) {
      const cid = m.parliamentaryConstituencyId ?? m.assemblyConstituencyId;
      if (election.type === ElectionType.LOK_SABHA && m.constituencyType !== ConstituencyType.PARLIAMENTARY) {
        issues.push({
          category: 'CONSTITUENCIES',
          code: 'INVALID_CONSTITUENCY_TYPE',
          message: `Lok Sabha election contains non-parliamentary constituency '${cid}'.`,
          affectedRecord: cid ?? undefined,
          suggestedAction: 'Remove invalid constituency mapping.',
        });
      }
      if (election.type === ElectionType.STATE_ASSEMBLY) {
        if (m.constituencyType !== ConstituencyType.ASSEMBLY) {
          issues.push({
            category: 'CONSTITUENCIES',
            code: 'INVALID_CONSTITUENCY_TYPE',
            message: `State Assembly election contains non-assembly constituency '${cid}'.`,
            affectedRecord: cid ?? undefined,
            suggestedAction: 'Remove invalid constituency mapping.',
          });
        } else if (m.assemblyConstituency?.stateId !== election.stateId) {
          issues.push({
            category: 'CONSTITUENCIES',
            code: 'CROSS_STATE_CONSTITUENCY',
            message: `Constituency '${cid}' belongs to '${m.assemblyConstituency?.stateId}', not '${election.stateId}'.`,
            affectedRecord: cid ?? undefined,
            suggestedAction: 'Remove cross-state constituency.',
          });
        }
      }
      if (cid) assignedSet.add(cid);
    }

    if (!isValidIanaTimezone(election.scheduleTimezone)) {
      issues.push({
        category: 'SCHEDULE',
        code: 'INVALID_TIMEZONE',
        message: `Timezone '${election.scheduleTimezone}' is invalid.`,
        suggestedAction: "Set timezone to 'Asia/Kolkata'.",
      });
    }

    const schedVal = validateElectionSchedule(milestones, election.scheduleTimezone, {
      requireMandatory: true,
    });
    for (const sErr of schedVal.issues) {
      issues.push({
        category: 'SCHEDULE',
        code: sErr.code,
        message: sErr.message,
        affectedRecord: sErr.milestoneType,
        suggestedAction: sErr.suggestedAction,
      });
    }

    for (const nom of nominations) {
      const nCid = nom.parliamentaryConstituencyId ?? nom.assemblyConstituencyId;
      if (!nCid || !assignedSet.has(nCid)) {
        issues.push({
          category: 'NOMINATIONS',
          code: 'ORPHANED_NOMINATION_CONSTITUENCY',
          message: `Nomination '${nom.id}' references constituency '${nCid}' which is not actively assigned.`,
          affectedRecord: nom.id,
          suggestedAction: 'Assign the referenced constituency or resolve the nomination.',
        });
      }
    }

    return {
      electionId: election.id,
      configReviewStatus: election.configReviewStatus,
      ready: issues.length === 0,
      assignedConstituenciesCount: mappings.length,
      configuredMilestonesCount: milestones.length,
      issues,
    };
  }

  async submitConfigurationForReview(
    actor: SafeAdminUser,
    electionId: string,
    note: string,
    ctx: RequestAuditCtx
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);
    this.assertConfigMutable(election);

    const validation = await this.validateConfigurationReadiness(actor, electionId);
    if (!validation.ready) {
      throw new ConflictProblemError(
        `Configuration for '${electionId}' is not ready for review: ${validation.issues[0]!.message}`
      );
    }

    const updated = await this.prisma.election.update({
      where: { id: election.id },
      data: {
        configReviewStatus: ConfigurationReviewStatus.SUBMITTED_FOR_REVIEW,
        configSubmittedAt: new Date(),
        configSubmittedByAdminId: actor.id,
        configReviewNote: note || 'Submitted for configuration review.',
        updatedByAdminId: actor.id,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_CONFIG_SUBMITTED',
      domain: 'ELECTION_CONFIGURATION',
      targetEntityId: election.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { note },
    });

    return {
      electionId: updated.id,
      configReviewStatus: updated.configReviewStatus,
      configSubmittedAt: updated.configSubmittedAt?.toISOString() ?? null,
    };
  }

  async reviewConfiguration(
    actor: SafeAdminUser,
    electionId: string,
    note: string,
    ctx: RequestAuditCtx
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);
    if (
      election.configReviewStatus !== ConfigurationReviewStatus.SUBMITTED_FOR_REVIEW
    ) {
      throw new ConflictProblemError(
        `Configuration must be SUBMITTED_FOR_REVIEW before starting review (current: ${election.configReviewStatus}).`
      );
    }

    const updated = await this.prisma.election.update({
      where: { id: election.id },
      data: {
        configReviewStatus: ConfigurationReviewStatus.UNDER_REVIEW,
        configReviewedAt: new Date(),
        configReviewedByAdminId: actor.id,
        configReviewNote: note || 'Configuration under review.',
        updatedByAdminId: actor.id,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_CONFIG_REVIEWED',
      domain: 'ELECTION_CONFIGURATION',
      targetEntityId: election.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { note },
    });

    return {
      electionId: updated.id,
      configReviewStatus: updated.configReviewStatus,
    };
  }

  async approveConfiguration(
    actor: SafeAdminUser,
    electionId: string,
    note: string,
    ctx: RequestAuditCtx
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);

    if (
      election.configReviewStatus !== ConfigurationReviewStatus.SUBMITTED_FOR_REVIEW &&
      election.configReviewStatus !== ConfigurationReviewStatus.UNDER_REVIEW
    ) {
      throw new ConflictProblemError(
        `Configuration in state '${election.configReviewStatus}' cannot be approved.`
      );
    }

    if (
      election.configSubmittedByAdminId &&
      election.configSubmittedByAdminId === actor.id
    ) {
      throw new ForbiddenProblemError(
        'Separation-of-duties policy: An administrator cannot approve a configuration they submitted.'
      );
    }

    const updated = await this.prisma.election.update({
      where: { id: election.id },
      data: {
        configReviewStatus: ConfigurationReviewStatus.APPROVED,
        configApprovedAt: new Date(),
        configApprovedByAdminId: actor.id,
        configReviewNote: note || 'Configuration approved.',
        updatedByAdminId: actor.id,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_CONFIG_APPROVED',
      domain: 'ELECTION_CONFIGURATION',
      targetEntityId: election.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { note },
    });

    return {
      electionId: updated.id,
      configReviewStatus: updated.configReviewStatus,
      configApprovedAt: updated.configApprovedAt?.toISOString() ?? null,
    };
  }

  async returnConfigurationForCorrection(
    actor: SafeAdminUser,
    electionId: string,
    reason: string,
    ctx: RequestAuditCtx
  ) {
    const election = await this.getAuthorizedElection(actor, electionId);
    if (
      election.configReviewStatus !== ConfigurationReviewStatus.SUBMITTED_FOR_REVIEW &&
      election.configReviewStatus !== ConfigurationReviewStatus.UNDER_REVIEW
    ) {
      throw new ConflictProblemError(
        `Configuration in state '${election.configReviewStatus}' cannot be returned for correction.`
      );
    }

    const updated = await this.prisma.election.update({
      where: { id: election.id },
      data: {
        configReviewStatus: ConfigurationReviewStatus.CHANGES_REQUESTED,
        configReviewedAt: new Date(),
        configReviewedByAdminId: actor.id,
        configReviewNote: reason,
        updatedByAdminId: actor.id,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'ELECTION_CONFIG_RETURNED',
      domain: 'ELECTION_CONFIGURATION',
      targetEntityId: election.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { reason },
    });

    return {
      electionId: updated.id,
      configReviewStatus: updated.configReviewStatus,
      configReviewNote: updated.configReviewNote,
    };
  }
}

interface RequestAuditCtx {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}
