import {
  CandidateNominationStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
  PrismaClient,
} from '@prisma/client';
import { PUBLIC_HIDDEN_STATUSES } from './election.lifecycle.js';

export class ElectionsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listElections(filters: {
    type?: ElectionType;
    status?: ElectionStatus;
    stateId?: string;
    year?: number;
    page: number;
    limit: number;
  }) {
    if (filters.status && PUBLIC_HIDDEN_STATUSES.includes(filters.status)) {
      return { items: [], total: 0 };
    }

    const where = {
      status: filters.status
        ? filters.status
        : { notIn: [...PUBLIC_HIDDEN_STATUSES] },
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.stateId ? { stateId: filters.stateId } : {}),
      ...(filters.year ? { year: filters.year } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.election.findMany({
        where,
        orderBy: [{ pollingStartDate: 'asc' }, { id: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          state: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          _count: {
            select: {
              constituencyMappings: true,
              candidateNominations: true,
              countingSessions: true,
            },
          },
        },
      }),
      this.prisma.election.count({ where }),
    ]);

    return { items, total };
  }

  async findElectionById(electionId: string) {
    return this.prisma.election.findUnique({
      where: { id: electionId },
      include: {
        state: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            constituencyMappings: true,
            candidateNominations: true,
            countingSessions: true,
          },
        },
      },
    });
  }

  async listElectionConstituencies(
    electionId: string,
    filters: {
      constituencyType?: ConstituencyType;
      stateId?: string;
      page: number;
      limit: number;
    }
  ) {
    const where = {
      electionId,
      ...(filters.constituencyType ? { constituencyType: filters.constituencyType } : {}),
      ...(filters.stateId
        ? {
            OR: [
              { parliamentaryConstituency: { stateId: filters.stateId } },
              { assemblyConstituency: { stateId: filters.stateId } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.electionConstituency.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          parliamentaryConstituency: {
            include: {
              state: {
                select: { id: true, name: true, type: true },
              },
            },
          },
          assemblyConstituency: {
            include: {
              state: {
                select: { id: true, name: true, type: true },
              },
              district: {
                select: { id: true, name: true, headquarters: true },
              },
              parentParliamentary: {
                select: { id: true, constituencyNumber: true, name: true },
              },
            },
          },
        },
      }),
      this.prisma.electionConstituency.count({ where }),
    ]);

    return { items, total };
  }

  async listElectionCandidateNominations(
    electionId: string,
    filters: {
      constituencyId?: string;
      partyId?: string;
      status?: CandidateNominationStatus;
      page: number;
      limit: number;
    }
  ) {
    const where = {
      electionId,
      ...(filters.partyId ? { partyId: filters.partyId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.constituencyId
        ? {
            OR: [
              { parliamentaryConstituencyId: filters.constituencyId },
              { assemblyConstituencyId: filters.constituencyId },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.candidateNomination.findMany({
        where,
        orderBy: [{ nominationDate: 'asc' }, { candidateId: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          candidate: {
            include: {
              party: {
                select: {
                  id: true,
                  name: true,
                  abbreviation: true,
                  partyType: true,
                  symbolName: true,
                  symbolUrl: true,
                },
              },
            },
          },
          party: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
              partyType: true,
              symbolName: true,
              symbolUrl: true,
            },
          },
          parliamentaryConstituency: {
            select: {
              id: true,
              stateId: true,
              constituencyNumber: true,
              name: true,
              reservationType: true,
            },
          },
          assemblyConstituency: {
            select: {
              id: true,
              stateId: true,
              districtId: true,
              parentParliamentaryConstituencyId: true,
              constituencyNumber: true,
              name: true,
              reservationType: true,
            },
          },
        },
      }),
      this.prisma.candidateNomination.count({ where }),
    ]);

    return { items, total };
  }

  async listElectionScheduleMilestones(electionId: string) {
    return this.prisma.electionScheduleMilestone.findMany({
      where: { electionId },
      orderBy: [{ startAt: 'asc' }, { milestoneType: 'asc' }],
      select: {
        id: true,
        milestoneType: true,
        startAt: true,
        endAt: true,
        timezone: true,
        status: true,
      },
    });
  }
}
