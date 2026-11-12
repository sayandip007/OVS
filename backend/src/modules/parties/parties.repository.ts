import { PartyStatus, PartyType, PrismaClient } from '@prisma/client';

export class PartiesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listParties(filters: {
    partyType?: PartyType;
    status?: PartyStatus;
    search?: string;
    page: number;
    limit: number;
  }) {
    const where = {
      ...(filters.partyType ? { partyType: filters.partyType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { abbreviation: { contains: filters.search, mode: 'insensitive' as const } },
              { id: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.politicalParty.findMany({
        where,
        orderBy: [{ partyType: 'asc' }, { name: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          _count: {
            select: {
              candidates: true,
              nominations: true,
            },
          },
        },
      }),
      this.prisma.politicalParty.count({ where }),
    ]);

    return { items, total };
  }

  async findPartyById(partyId: string) {
    return this.prisma.politicalParty.findFirst({
      where: {
        OR: [
          { id: { equals: partyId, mode: 'insensitive' } },
          { abbreviation: { equals: partyId, mode: 'insensitive' } },
        ],
      },
      include: {
        candidates: {
          orderBy: { fullName: 'asc' },
          select: {
            id: true,
            fullName: true,
            age: true,
            gender: true,
            education: true,
            profession: true,
          },
        },
        _count: {
          select: {
            candidates: true,
            nominations: true,
          },
        },
      },
    });
  }

  async listPublicCandidates(filters: {
    partyId?: string;
    search?: string;
    page: number;
    limit: number;
  }) {
    const where = {
      isActive: true,
      ...(filters.partyId ? { partyId: filters.partyId } : {}),
      ...(filters.search
        ? {
            OR: [
              { fullName: { contains: filters.search, mode: 'insensitive' as const } },
              { displayName: { contains: filters.search, mode: 'insensitive' as const } },
              { id: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
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
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return { items, total };
  }

  async findCandidateById(candidateId: string) {
    return this.prisma.candidate.findUnique({
      where: { id: candidateId },
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
        nominations: {
          orderBy: { nominationDate: 'desc' },
          include: {
            election: {
              select: {
                id: true,
                name: true,
                type: true,
                year: true,
                status: true,
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
        },
      },
    });
  }
}
