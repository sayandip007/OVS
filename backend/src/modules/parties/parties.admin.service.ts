import type {
  MetadataSource,
  PartyStatus,
  PartyType,
  PrismaClient,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
} from '../../common/errors/problemDetails.js';
import type { SafeAdminUser } from '../auth/auth.types.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';

export class AdminPartiesService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly auditService: AdminAuditService = new AdminAuditService()
  ) {}

  private toDto(p: any) {
    return {
      id: p.id,
      name: p.name,
      abbreviation: p.abbreviation,
      partyType: p.partyType,
      symbolName: p.symbolName,
      symbolUrl: p.symbolUrl,
      description: p.description,
      establishedYear: p.establishedYear,
      headquarters: p.headquarters,
      status: p.status,
      metadataSource: p.metadataSource,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      counts: {
        candidates: p._count?.candidates ?? (p.candidates ? p.candidates.length : 0),
        nominations: p._count?.nominations ?? 0,
      },
      ...(p.candidates
        ? {
            candidates: p.candidates.map((c: any) => ({
              id: c.id,
              fullName: c.fullName,
              displayName: c.displayName ?? c.fullName,
              isActive: c.isActive,
            })),
          }
        : {}),
    };
  }

  async listParties(query: {
    page: number;
    limit: number;
    search?: string;
    partyType?: PartyType;
    status?: PartyStatus;
  }) {
    const where: any = {
      ...(query.partyType ? { partyType: query.partyType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { id: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { abbreviation: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.politicalParty.findMany({
        where,
        orderBy: [{ partyType: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          _count: { select: { candidates: true, nominations: true } },
        },
      }),
      this.prisma.politicalParty.count({ where }),
    ]);

    return { items: items.map((p) => this.toDto(p)), total };
  }

  async getPartyById(partyId: string) {
    const party = await this.prisma.politicalParty.findUnique({
      where: { id: partyId },
      include: {
        candidates: {
          orderBy: { fullName: 'asc' },
          select: {
            id: true,
            fullName: true,
            displayName: true,
            isActive: true,
          },
        },
        _count: { select: { candidates: true, nominations: true } },
      },
    });
    if (!party) {
      throw new NotFoundProblemError('PoliticalParty', partyId);
    }
    return this.toDto(party);
  }

  async createParty(
    actor: SafeAdminUser,
    input: {
      id: string;
      name: string;
      abbreviation: string;
      partyType: PartyType;
      symbolName: string;
      symbolUrl: string;
      description: string;
      establishedYear?: number | null;
      headquarters?: string | null;
      status: PartyStatus;
      metadataSource: MetadataSource;
    },
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string }
  ) {
    if (actor.role === 'STATE_ADMIN' && input.partyType === 'NATIONAL') {
      throw new ForbiddenProblemError(
        'State Administrators may only register STATE-level demo parties, not NATIONAL parties.'
      );
    }

    const existing = await this.prisma.politicalParty.findFirst({
      where: {
        OR: [
          { id: input.id },
          { abbreviation: { equals: input.abbreviation, mode: 'insensitive' } },
        ],
      },
    });
    if (existing) {
      throw new ConflictProblemError(
        `A political party with identifier '${input.id}' or abbreviation '${input.abbreviation}' already exists.`
      );
    }

    const created = await this.prisma.politicalParty.create({
      data: {
        id: input.id,
        name: input.name,
        abbreviation: input.abbreviation,
        partyType: input.partyType,
        symbolName: input.symbolName,
        symbolUrl: input.symbolUrl,
        description: input.description,
        establishedYear: input.establishedYear ?? null,
        headquarters: input.headquarters ?? null,
        status: input.status,
        metadataSource: input.metadataSource,
      },
      include: {
        _count: { select: { candidates: true, nominations: true } },
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'PARTY_CREATED',
      domain: 'PARTY_MANAGEMENT',
      targetEntityId: created.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        abbreviation: created.abbreviation,
        partyType: created.partyType,
      },
    });

    return this.toDto(created);
  }

  async updateParty(
    actor: SafeAdminUser,
    partyId: string,
    input: Record<string, any>,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const existing = await this.prisma.politicalParty.findUnique({
      where: { id: partyId },
    });
    if (!existing) {
      throw new NotFoundProblemError('PoliticalParty', partyId);
    }

    if (
      actor.role === 'STATE_ADMIN' &&
      (existing.partyType === 'NATIONAL' || input.partyType === 'NATIONAL')
    ) {
      throw new ForbiddenProblemError(
        'State Administrators cannot modify NATIONAL political parties.'
      );
    }

    if (input.abbreviation && input.abbreviation !== existing.abbreviation) {
      const dupAbbr = await this.prisma.politicalParty.findFirst({
        where: {
          id: { not: partyId },
          abbreviation: { equals: input.abbreviation, mode: 'insensitive' },
        },
      });
      if (dupAbbr) {
        throw new ConflictProblemError(
          `Party abbreviation '${input.abbreviation}' is already used by '${dupAbbr.id}'.`
        );
      }
    }

    // Historical candidate_nominations remain intact via party snapshot columns
    const updated = await this.prisma.politicalParty.update({
      where: { id: partyId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.abbreviation !== undefined ? { abbreviation: input.abbreviation } : {}),
        ...(input.partyType !== undefined ? { partyType: input.partyType } : {}),
        ...(input.symbolName !== undefined ? { symbolName: input.symbolName } : {}),
        ...(input.symbolUrl !== undefined ? { symbolUrl: input.symbolUrl } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.establishedYear !== undefined
          ? { establishedYear: input.establishedYear }
          : {}),
        ...(input.headquarters !== undefined ? { headquarters: input.headquarters } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: {
        _count: { select: { candidates: true, nominations: true } },
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'PARTY_UPDATED',
      domain: 'PARTY_MANAGEMENT',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        previousStatus: existing.status,
        newStatus: updated.status,
        updatedKeys: Object.keys(input),
      },
    });

    return this.toDto(updated);
  }
}
