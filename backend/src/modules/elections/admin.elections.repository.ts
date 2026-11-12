import {
  ElectionStatus,
  ElectionType,
  MetadataSource,
  type Election,
  type ElectionLifecycleHistory,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import { ConflictProblemError } from '../../common/errors/problemDetails.js';

export type ElectionWithRelations = Election & {
  state: { id: string; name: string; type: string } | null;
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
  cancelledByAdmin: {
    id: string;
    officerCode: string;
    fullName: string;
    role: string;
  } | null;
  archivedByAdmin: {
    id: string;
    officerCode: string;
    fullName: string;
    role: string;
  } | null;
  _count: {
    constituencyMappings: number;
    candidateNominations: number;
    countingSessions: number;
    lifecycleHistory: number;
  };
};

export interface AdminElectionJurisdictionFilter {
  mode: 'ALL' | 'STATE' | 'ELECTION';
  allowedStateIds?: string[];
  allowedElectionIds?: string[];
}

export interface ListAdminElectionsRepoParams {
  page: number;
  limit: number;
  search?: string;
  type?: ElectionType;
  stateId?: string;
  status?: ElectionStatus;
  sortBy: 'createdAt' | 'updatedAt' | 'pollingStartDate' | 'name' | 'year';
  sortOrder: 'asc' | 'desc';
  jurisdictionFilter: AdminElectionJurisdictionFilter;
}

const ADMIN_SELECT = {
  select: {
    id: true,
    officerCode: true,
    fullName: true,
    role: true,
  },
} as const;

const ELECTION_INCLUDE = {
  state: { select: { id: true, name: true, type: true } },
  createdByAdmin: ADMIN_SELECT,
  updatedByAdmin: ADMIN_SELECT,
  cancelledByAdmin: ADMIN_SELECT,
  archivedByAdmin: ADMIN_SELECT,
  _count: {
    select: {
      constituencyMappings: true,
      candidateNominations: true,
      countingSessions: true,
      lifecycleHistory: true,
    },
  },
} as const;

function buildJurisdictionWhere(
  filter: AdminElectionJurisdictionFilter
): Prisma.ElectionWhereInput {
  if (filter.mode === 'ALL') {
    return {};
  }
  if (filter.mode === 'STATE') {
    const ids = filter.allowedStateIds ?? [];
    if (ids.length === 0) {
      return { id: '__NONE__' };
    }
    return {
      type: ElectionType.STATE_ASSEMBLY,
      stateId: { in: ids },
    };
  }
  const electionIds = filter.allowedElectionIds ?? [];
  if (electionIds.length === 0) {
    return { id: '__NONE__' };
  }
  return { id: { in: electionIds } };
}

export class AdminElectionsRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findStateById(stateId: string) {
    return this.prisma.state.findUnique({
      where: { id: stateId },
      select: { id: true, name: true, type: true },
    });
  }

  async findElectionById(electionId: string): Promise<ElectionWithRelations | null> {
    return this.prisma.election.findUnique({
      where: { id: electionId },
      include: ELECTION_INCLUDE,
    });
  }

  async listElections(params: ListAdminElectionsRepoParams): Promise<{
    items: ElectionWithRelations[];
    total: number;
  }> {
    const where: Prisma.ElectionWhereInput = {
      ...buildJurisdictionWhere(params.jurisdictionFilter),
      ...(params.type ? { type: params.type } : {}),
      ...(params.stateId ? { stateId: params.stateId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { id: { contains: params.search, mode: 'insensitive' } },
              { name: { contains: params.search, mode: 'insensitive' } },
              {
                targetJurisdiction: {
                  contains: params.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.election.findMany({
        where,
        orderBy: [{ [params.sortBy]: params.sortOrder }, { id: 'asc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: ELECTION_INCLUDE,
      }),
      this.prisma.election.count({ where }),
    ]);

    return { items, total };
  }

  async getSummaryCounts(jurisdictionFilter: AdminElectionJurisdictionFilter) {
    const scopeWhere = buildJurisdictionWhere(jurisdictionFilter);
    const elections = await this.prisma.election.findMany({
      where: scopeWhere,
      select: { type: true, status: true },
    });

    const summary = {
      total: elections.length,
      lokSabha: 0,
      stateAssembly: 0,
      draft: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      archived: 0,
      byStatus: {} as Record<string, number>,
    };

    for (const el of elections) {
      if (el.type === ElectionType.LOK_SABHA) summary.lokSabha++;
      if (el.type === ElectionType.STATE_ASSEMBLY) summary.stateAssembly++;
      if (el.status === ElectionStatus.DRAFT) summary.draft++;
      if (
        el.status === ElectionStatus.POLLING_ACTIVE ||
        el.status === ElectionStatus.UPCOMING ||
        el.status === ElectionStatus.NOMINATION_OPEN ||
        el.status === ElectionStatus.NOMINATION_CLOSED ||
        el.status === ElectionStatus.READY
      ) {
        summary.active++;
      }
      if (
        el.status === ElectionStatus.POLLING_COMPLETED ||
        el.status === ElectionStatus.COUNTING ||
        el.status === ElectionStatus.RESULTS_DECLARED
      ) {
        summary.completed++;
      }
      if (el.status === ElectionStatus.CANCELLED) summary.cancelled++;
      if (el.status === ElectionStatus.ARCHIVED) summary.archived++;

      summary.byStatus[el.status] = (summary.byStatus[el.status] ?? 0) + 1;
    }

    return summary;
  }

  async createElectionWithHistory(input: {
    id: string;
    name: string;
    type: ElectionType;
    year: number;
    stateId: string | null;
    country: string;
    targetJurisdiction: string;
    description: string;
    status: ElectionStatus;
    pollingStartDate: Date;
    pollingEndDate: Date;
    countingDate: Date;
    resultDate: Date;
    metadataSource: MetadataSource;
    createdByAdminId: string;
    requestId?: string;
  }): Promise<ElectionWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.election.create({
        data: {
          id: input.id,
          name: input.name,
          type: input.type,
          year: input.year,
          stateId: input.stateId,
          country: input.country,
          targetJurisdiction: input.targetJurisdiction,
          description: input.description,
          status: input.status,
          version: 1,
          pollingStartDate: input.pollingStartDate,
          pollingEndDate: input.pollingEndDate,
          countingDate: input.countingDate,
          resultDate: input.resultDate,
          metadataSource: input.metadataSource,
          createdByAdminId: input.createdByAdminId,
          updatedByAdminId: input.createdByAdminId,
        },
      });

      await tx.electionLifecycleHistory.create({
        data: {
          electionId: created.id,
          action: 'ELECTION_CREATED',
          fromStatus: input.status,
          toStatus: input.status,
          changedByAdminId: input.createdByAdminId,
          note: `Election created in ${input.status} state.`,
          requestId: input.requestId ?? null,
          metadata: {
            type: input.type,
            stateId: input.stateId,
            year: input.year,
            targetJurisdiction: input.targetJurisdiction,
          },
        },
      });

      return tx.election.findUniqueOrThrow({
        where: { id: created.id },
        include: ELECTION_INCLUDE,
      });
    });
  }

  async updateElectionMetadataWithConcurrency(input: {
    electionId: string;
    expectedVersion: number;
    currentStatus: ElectionStatus;
    updatedByAdminId: string;
    requestId?: string;
    changes: Prisma.ElectionUncheckedUpdateManyInput;
    changedFields: Record<string, unknown>;
  }): Promise<ElectionWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.election.updateMany({
        where: {
          id: input.electionId,
          version: input.expectedVersion,
        },
        data: {
          ...input.changes,
          updatedByAdminId: input.updatedByAdminId,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new ConflictProblemError(
          `Concurrent modification detected for election '${input.electionId}'. Reload the latest version and try again.`
        );
      }

      await tx.electionLifecycleHistory.create({
        data: {
          electionId: input.electionId,
          action: 'METADATA_UPDATED',
          fromStatus: input.currentStatus,
          toStatus: input.currentStatus,
          changedByAdminId: input.updatedByAdminId,
          note: 'Election metadata updated.',
          requestId: input.requestId ?? null,
          metadata: input.changedFields as Prisma.InputJsonValue,
        },
      });

      return tx.election.findUniqueOrThrow({
        where: { id: input.electionId },
        include: ELECTION_INCLUDE,
      });
    });
  }

  async transitionElectionStatusWithConcurrency(input: {
    electionId: string;
    expectedVersion: number;
    fromStatus: ElectionStatus;
    toStatus: ElectionStatus;
    action: string;
    actorAdminId: string;
    note: string;
    requestId?: string;
    extraData?: Prisma.ElectionUncheckedUpdateManyInput;
    metadata?: Record<string, unknown>;
  }): Promise<ElectionWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.election.updateMany({
        where: {
          id: input.electionId,
          status: input.fromStatus,
          version: input.expectedVersion,
        },
        data: {
          status: input.toStatus,
          updatedByAdminId: input.actorAdminId,
          version: { increment: 1 },
          ...(input.extraData ?? {}),
        },
      });

      if (result.count === 0) {
        throw new ConflictProblemError(
          `Election '${input.electionId}' state or version changed concurrently. Refresh and try again.`
        );
      }

      await tx.electionLifecycleHistory.create({
        data: {
          electionId: input.electionId,
          action: input.action,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          changedByAdminId: input.actorAdminId,
          note: input.note,
          requestId: input.requestId ?? null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      return tx.election.findUniqueOrThrow({
        where: { id: input.electionId },
        include: ELECTION_INCLUDE,
      });
    });
  }

  async listLifecycleHistory(
    electionId: string,
    page: number,
    limit: number
  ): Promise<{
    items: (ElectionLifecycleHistory & {
      changedByAdmin: {
        id: string;
        officerCode: string;
        fullName: string;
        role: string;
      } | null;
    })[];
    total: number;
  }> {
    const where = { electionId };
    const [items, total] = await Promise.all([
      this.prisma.electionLifecycleHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          changedByAdmin: ADMIN_SELECT,
        },
      }),
      this.prisma.electionLifecycleHistory.count({ where }),
    ]);

    return { items, total };
  }
}
