import {
  CandidateNominationStatus,
  ConstituencyType,
  ElectionType,
  PartyType,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import { ConflictProblemError } from '../../common/errors/problemDetails.js';

export interface AdminNominationJurisdictionFilter {
  mode: 'ALL' | 'STATE' | 'ELECTION';
  allowedStateIds?: string[];
  allowedElectionIds?: string[];
  allowedPcIds?: string[];
  allowedAcIds?: string[];
}

const ADMIN_SELECT = {
  select: { id: true, officerCode: true, fullName: true, role: true },
} as const;

const NOMINATION_INCLUDE = {
  candidate: {
    select: {
      id: true,
      fullName: true,
      displayName: true,
      partyId: true,
      isActive: true,
    },
  },
  party: {
    select: {
      id: true,
      name: true,
      abbreviation: true,
      partyType: true,
      status: true,
    },
  },
  election: {
    select: {
      id: true,
      name: true,
      type: true,
      year: true,
      stateId: true,
      status: true,
    },
  },
  parliamentaryConstituency: {
    select: { id: true, stateId: true, name: true, constituencyNumber: true },
  },
  assemblyConstituency: {
    select: { id: true, stateId: true, name: true, constituencyNumber: true },
  },
  createdByAdmin: ADMIN_SELECT,
  submittedByAdmin: ADMIN_SELECT,
  scrutinizedByAdmin: ADMIN_SELECT,
  withdrawnByAdmin: ADMIN_SELECT,
  _count: { select: { lifecycleHistory: true } },
} as const;

function buildNominationScopeWhere(
  filter: AdminNominationJurisdictionFilter
): Prisma.CandidateNominationWhereInput {
  if (filter.mode === 'ALL') return {};
  if (filter.mode === 'STATE') {
    const ids = filter.allowedStateIds ?? [];
    if (ids.length === 0) return { id: '00000000-0000-0000-0000-000000000000' };
    return {
      OR: [
        { election: { stateId: { in: ids } } },
        { parliamentaryConstituency: { stateId: { in: ids } } },
        { assemblyConstituency: { stateId: { in: ids } } },
      ],
    };
  }
  const electionIds = filter.allowedElectionIds ?? [];
  if (electionIds.length === 0) {
    return { id: '00000000-0000-0000-0000-000000000000' };
  }
  return { electionId: { in: electionIds } };
}

export class NominationsRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findNominationById(nominationId: string) {
    return this.prisma.candidateNomination.findUnique({
      where: { id: nominationId },
      include: NOMINATION_INCLUDE,
    });
  }

  async findElection(electionId: string) {
    return this.prisma.election.findUnique({
      where: { id: electionId },
      select: { id: true, name: true, type: true, stateId: true, status: true },
    });
  }

  async findCandidate(candidateId: string) {
    return this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true, fullName: true, isActive: true, partyId: true },
    });
  }

  async findParty(partyId: string) {
    return this.prisma.politicalParty.findUnique({
      where: { id: partyId },
      select: { id: true, name: true, abbreviation: true, partyType: true, status: true },
    });
  }

  async findElectionConstituencyMapping(input: {
    electionId: string;
    constituencyType: ConstituencyType;
    constituencyId: string;
  }) {
    return this.prisma.electionConstituency.findFirst({
      where: {
        electionId: input.electionId,
        constituencyType: input.constituencyType,
        ...(input.constituencyType === ConstituencyType.PARLIAMENTARY
          ? { parliamentaryConstituencyId: input.constituencyId }
          : { assemblyConstituencyId: input.constituencyId }),
      },
      include: {
        parliamentaryConstituency: { select: { id: true, stateId: true } },
        assemblyConstituency: { select: { id: true, stateId: true } },
      },
    });
  }

  async findDuplicateNomination(input: {
    electionId: string;
    candidateId: string;
    constituencyType: ConstituencyType;
    constituencyId: string;
  }) {
    return this.prisma.candidateNomination.findFirst({
      where: {
        electionId: input.electionId,
        candidateId: input.candidateId,
        constituencyType: input.constituencyType,
        ...(input.constituencyType === ConstituencyType.PARLIAMENTARY
          ? { parliamentaryConstituencyId: input.constituencyId }
          : { assemblyConstituencyId: input.constituencyId }),
      },
    });
  }

  async listNominations(params: {
    page: number;
    limit: number;
    electionId?: string;
    electionType?: ElectionType;
    stateId?: string;
    constituencyId?: string;
    candidateId?: string;
    partyId?: string;
    status?: CandidateNominationStatus;
    isIndependent?: boolean;
    jurisdictionFilter: AdminNominationJurisdictionFilter;
  }) {
    const where: Prisma.CandidateNominationWhereInput = {
      ...buildNominationScopeWhere(params.jurisdictionFilter),
      ...(params.electionId ? { electionId: params.electionId } : {}),
      ...(params.electionType ? { election: { type: params.electionType } } : {}),
      ...(params.candidateId ? { candidateId: params.candidateId } : {}),
      ...(params.partyId ? { partyId: params.partyId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.isIndependent === 'boolean'
        ? { isIndependent: params.isIndependent }
        : {}),
      ...(params.stateId
        ? {
            OR: [
              { election: { stateId: params.stateId } },
              { parliamentaryConstituency: { stateId: params.stateId } },
              { assemblyConstituency: { stateId: params.stateId } },
            ],
          }
        : {}),
      ...(params.constituencyId
        ? {
            OR: [
              { parliamentaryConstituencyId: params.constituencyId },
              { assemblyConstituencyId: params.constituencyId },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.candidateNomination.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: NOMINATION_INCLUDE,
      }),
      this.prisma.candidateNomination.count({ where }),
    ]);

    return { items, total };
  }

  async createNominationWithHistory(input: {
    electionId: string;
    candidateId: string;
    constituencyType: ConstituencyType;
    parliamentaryConstituencyId: string | null;
    assemblyConstituencyId: string | null;
    isIndependent: boolean;
    partyId: string | null;
    partyNameSnapshot: string | null;
    partyAbbreviationSnapshot: string | null;
    partyTypeSnapshot: PartyType | null;
    scrutinyNote: string;
    createdByAdminId: string;
    requestId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.candidateNomination.create({
        data: {
          electionId: input.electionId,
          candidateId: input.candidateId,
          constituencyType: input.constituencyType,
          parliamentaryConstituencyId: input.parliamentaryConstituencyId,
          assemblyConstituencyId: input.assemblyConstituencyId,
          isIndependent: input.isIndependent,
          partyId: input.partyId,
          partyNameSnapshot: input.partyNameSnapshot,
          partyAbbreviationSnapshot: input.partyAbbreviationSnapshot,
          partyTypeSnapshot: input.partyTypeSnapshot,
          status: CandidateNominationStatus.DRAFT,
          version: 1,
          scrutinyNote: input.scrutinyNote,
          createdByAdminId: input.createdByAdminId,
        },
      });

      await tx.nominationLifecycleHistory.create({
        data: {
          nominationId: created.id,
          action: 'NOMINATION_CREATED',
          fromStatus: CandidateNominationStatus.DRAFT,
          toStatus: CandidateNominationStatus.DRAFT,
          changedByAdminId: input.createdByAdminId,
          note: 'Draft nomination created.',
          requestId: input.requestId ?? null,
          metadata: {
            electionId: input.electionId,
            candidateId: input.candidateId,
            isIndependent: input.isIndependent,
            partyId: input.partyId,
          },
        },
      });

      return tx.candidateNomination.findUniqueOrThrow({
        where: { id: created.id },
        include: NOMINATION_INCLUDE,
      });
    });
  }

  async updateDraftWithConcurrency(input: {
    nominationId: string;
    expectedVersion: number;
    actorAdminId: string;
    requestId?: string;
    data: Prisma.CandidateNominationUncheckedUpdateManyInput;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.candidateNomination.updateMany({
        where: {
          id: input.nominationId,
          status: CandidateNominationStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: {
          ...input.data,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new ConflictProblemError(
          `Concurrent update or status change detected for nomination '${input.nominationId}'.`
        );
      }

      await tx.nominationLifecycleHistory.create({
        data: {
          nominationId: input.nominationId,
          action: 'NOMINATION_DRAFT_UPDATED',
          fromStatus: CandidateNominationStatus.DRAFT,
          toStatus: CandidateNominationStatus.DRAFT,
          changedByAdminId: input.actorAdminId,
          note: 'Draft nomination updated.',
          requestId: input.requestId ?? null,
        },
      });

      return tx.candidateNomination.findUniqueOrThrow({
        where: { id: input.nominationId },
        include: NOMINATION_INCLUDE,
      });
    });
  }

  async transitionNominationWithConcurrency(input: {
    nominationId: string;
    expectedVersion: number;
    fromStatus: CandidateNominationStatus;
    toStatus: CandidateNominationStatus;
    action: string;
    actorAdminId: string;
    note: string;
    requestId?: string;
    extraData?: Prisma.CandidateNominationUncheckedUpdateManyInput;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.candidateNomination.updateMany({
        where: {
          id: input.nominationId,
          status: input.fromStatus,
          version: input.expectedVersion,
        },
        data: {
          status: input.toStatus,
          version: { increment: 1 },
          ...(input.extraData ?? {}),
        },
      });

      if (updated.count === 0) {
        throw new ConflictProblemError(
          `Nomination '${input.nominationId}' was concurrently updated by another reviewer. Refresh and retry.`
        );
      }

      await tx.nominationLifecycleHistory.create({
        data: {
          nominationId: input.nominationId,
          action: input.action,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          changedByAdminId: input.actorAdminId,
          note: input.note,
          requestId: input.requestId ?? null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      return tx.candidateNomination.findUniqueOrThrow({
        where: { id: input.nominationId },
        include: NOMINATION_INCLUDE,
      });
    });
  }

  async listLifecycleHistory(nominationId: string, page: number, limit: number) {
    const where = { nominationId };
    const [items, total] = await Promise.all([
      this.prisma.nominationLifecycleHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { changedByAdmin: ADMIN_SELECT },
      }),
      this.prisma.nominationLifecycleHistory.count({ where }),
    ]);
    return { items, total };
  }
}
