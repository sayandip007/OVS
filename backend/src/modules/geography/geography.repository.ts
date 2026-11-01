import {
  JurisdictionType,
  PrismaClient,
  ReservationType,
} from '@prisma/client';

export class GeographyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listStates(filters: {
    type?: JurisdictionType;
    search?: string;
    page: number;
    limit: number;
  }) {
    const where = {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { id: { contains: filters.search, mode: 'insensitive' as const } },
              { capital: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.state.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          _count: {
            select: {
              districts: true,
              parliamentarySeats: true,
              assemblySeats: true,
            },
          },
        },
      }),
      this.prisma.state.count({ where }),
    ]);

    return { items, total };
  }

  async findStateById(stateId: string) {
    return this.prisma.state.findUnique({
      where: { id: stateId },
      include: {
        _count: {
          select: {
            districts: true,
            parliamentarySeats: true,
            assemblySeats: true,
          },
        },
      },
    });
  }

  async listDistrictsByStateId(
    stateId: string,
    filters: { search?: string; page: number; limit: number }
  ) {
    const where = {
      stateId,
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { id: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.district.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          _count: {
            select: {
              assemblySeats: true,
            },
          },
        },
      }),
      this.prisma.district.count({ where }),
    ]);

    return { items, total };
  }

  async listParliamentaryConstituenciesByStateId(
    stateId: string,
    filters: {
      reservationType?: ReservationType;
      search?: string;
      page: number;
      limit: number;
    }
  ) {
    const where = {
      stateId,
      ...(filters.reservationType ? { reservationType: filters.reservationType } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { id: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.parliamentaryConstituency.findMany({
        where,
        orderBy: { constituencyNumber: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          _count: {
            select: {
              childAssemblySeats: true,
            },
          },
        },
      }),
      this.prisma.parliamentaryConstituency.count({ where }),
    ]);

    return {
      items: items.map((pc) => ({
        constituencyType: 'PARLIAMENTARY' as const,
        ...pc,
      })),
      total,
    };
  }

  async listAssemblyConstituenciesByStateId(
    stateId: string,
    filters: {
      districtId?: string;
      parentParliamentaryConstituencyId?: string;
      reservationType?: ReservationType;
      search?: string;
      page: number;
      limit: number;
    }
  ) {
    const where = {
      stateId,
      ...(filters.districtId ? { districtId: filters.districtId } : {}),
      ...(filters.parentParliamentaryConstituencyId
        ? {
            parentParliamentaryConstituencyId:
              filters.parentParliamentaryConstituencyId,
          }
        : {}),
      ...(filters.reservationType ? { reservationType: filters.reservationType } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { id: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.assemblyConstituency.findMany({
        where,
        orderBy: { constituencyNumber: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          district: {
            select: {
              id: true,
              name: true,
              headquarters: true,
            },
          },
          parentParliamentary: {
            select: {
              id: true,
              constituencyNumber: true,
              name: true,
              reservationType: true,
            },
          },
        },
      }),
      this.prisma.assemblyConstituency.count({ where }),
    ]);

    return {
      items: items.map((ac) => ({
        constituencyType: 'ASSEMBLY' as const,
        ...ac,
      })),
      total,
    };
  }

  async findConstituencyById(constituencyId: string) {
    const pc = await this.prisma.parliamentaryConstituency.findUnique({
      where: { id: constituencyId },
      include: {
        state: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        childAssemblySeats: {
          orderBy: { constituencyNumber: 'asc' },
          select: {
            id: true,
            constituencyNumber: true,
            name: true,
            reservationType: true,
            districtId: true,
            totalVoters: true,
          },
        },
      },
    });

    if (pc) {
      return {
        constituencyType: 'PARLIAMENTARY' as const,
        ...pc,
      };
    }

    const ac = await this.prisma.assemblyConstituency.findUnique({
      where: { id: constituencyId },
      include: {
        state: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        district: {
          select: {
            id: true,
            name: true,
            headquarters: true,
          },
        },
        parentParliamentary: {
          select: {
            id: true,
            constituencyNumber: true,
            name: true,
            reservationType: true,
          },
        },
      },
    });

    if (ac) {
      return {
        constituencyType: 'ASSEMBLY' as const,
        ...ac,
      };
    }

    return null;
  }
}
