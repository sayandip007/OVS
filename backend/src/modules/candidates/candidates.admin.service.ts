import type { MetadataSource, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import type { SafeAdminUser } from '../auth/auth.types.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';

function getActorStateIds(actor: SafeAdminUser): string[] {
  const ids = new Set<string>(actor.assignedStateIds ?? []);
  if (actor.assignedStateId) ids.add(actor.assignedStateId);
  return Array.from(ids);
}

export class AdminCandidatesService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly auditService: AdminAuditService = new AdminAuditService()
  ) {}

  private toDto(c: any) {
    return {
      id: c.id,
      partyId: c.partyId,
      party: c.party ?? null,
      displayName: c.displayName ?? c.fullName,
      fullName: c.fullName,
      age: c.age,
      gender: c.gender,
      education: c.education,
      profession: c.profession,
      criminalCases: c.criminalCases,
      assetsDeclared: c.assetsDeclared?.toString?.() ?? String(c.assetsDeclared ?? 0),
      liabilitiesDeclared:
        c.liabilitiesDeclared?.toString?.() ?? String(c.liabilitiesDeclared ?? 0),
      photoUrl: c.photoUrl,
      bio: c.bio,
      isActive: c.isActive,
      deactivatedAt: c.deactivatedAt ? c.deactivatedAt.toISOString() : null,
      metadataSource: c.metadataSource,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      nominationsCount: c._count?.nominations ?? (c.nominations ? c.nominations.length : 0),
      ...(c.nominations
        ? {
            nominations: c.nominations.map((n: any) => ({
              id: n.id,
              electionId: n.electionId,
              election: n.election ?? null,
              constituencyType: n.constituencyType,
              parliamentaryConstituencyId: n.parliamentaryConstituencyId,
              assemblyConstituencyId: n.assemblyConstituencyId,
              partyId: n.partyId,
              isIndependent: n.isIndependent,
              partyNameSnapshot: n.partyNameSnapshot,
              partyAbbreviationSnapshot: n.partyAbbreviationSnapshot,
              status: n.status,
              nominationDate: n.nominationDate.toISOString(),
            })),
          }
        : {}),
    };
  }

  private assertCanAccessCandidate(actor: SafeAdminUser, candidate: any) {
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'NATIONAL_ADMIN') {
      return;
    }
    const nominations = candidate.nominations ?? [];
    if (nominations.length === 0) {
      // Unassigned/newly created candidate profile readable within state/officer workflows
      return;
    }

    if (actor.role === 'STATE_ADMIN') {
      const allowedStates = getActorStateIds(actor);
      const hasInScope = nominations.some((n: any) => {
        const st =
          n.election?.stateId ??
          n.parliamentaryConstituency?.stateId ??
          n.assemblyConstituency?.stateId;
        return st && allowedStates.includes(st);
      });
      if (!hasInScope) {
        throw new ForbiddenProblemError(
          `Candidate '${candidate.id}' has no nominations within your assigned state scope.`
        );
      }
    } else if (actor.role === 'ELECTION_OFFICER') {
      const hasInElection = nominations.some((n: any) =>
        actor.assignedElectionIds.includes(n.electionId)
      );
      if (!hasInElection) {
        throw new ForbiddenProblemError(
          `Candidate '${candidate.id}' is not associated with your assigned elections.`
        );
      }
    }
  }

  async listCandidates(
    actor: SafeAdminUser,
    query: {
      page: number;
      limit: number;
      search?: string;
      partyId?: string;
      isActive?: boolean;
    }
  ) {
    const scopeFilter: any = {};
    if (actor.role === 'STATE_ADMIN') {
      const stateIds = getActorStateIds(actor);
      scopeFilter.OR = [
        { nominations: { none: {} } },
        { nominations: { some: { election: { stateId: { in: stateIds } } } } },
        {
          nominations: {
            some: { parliamentaryConstituency: { stateId: { in: stateIds } } },
          },
        },
        {
          nominations: {
            some: { assemblyConstituency: { stateId: { in: stateIds } } },
          },
        },
      ];
    } else if (actor.role === 'ELECTION_OFFICER') {
      scopeFilter.OR = [
        { nominations: { none: {} } },
        {
          nominations: {
            some: { electionId: { in: actor.assignedElectionIds } },
          },
        },
      ];
    }

    const where: any = {
      ...scopeFilter,
      ...(query.partyId ? { partyId: query.partyId } : {}),
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { fullName: { contains: query.search, mode: 'insensitive' } },
                  { displayName: { contains: query.search, mode: 'insensitive' } },
                  { id: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          party: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
              partyType: true,
              status: true,
            },
          },
          _count: { select: { nominations: true } },
        },
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return { items: items.map((c) => this.toDto(c)), total };
  }

  async getCandidateById(actor: SafeAdminUser, candidateId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        party: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
            partyType: true,
            status: true,
          },
        },
        nominations: {
          orderBy: { nominationDate: 'desc' },
          include: {
            election: {
              select: { id: true, name: true, type: true, year: true, stateId: true, status: true },
            },
            parliamentaryConstituency: { select: { id: true, stateId: true, name: true } },
            assemblyConstituency: { select: { id: true, stateId: true, name: true } },
          },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundProblemError('Candidate', candidateId);
    }

    this.assertCanAccessCandidate(actor, candidate);
    return this.toDto(candidate);
  }

  async createCandidate(
    actor: SafeAdminUser,
    input: {
      id: string;
      partyId: string;
      displayName?: string;
      fullName: string;
      age: number;
      gender: string;
      education: string;
      profession: string;
      criminalCases: number;
      assetsDeclared: number;
      liabilitiesDeclared: number;
      photoUrl?: string | null;
      bio: string;
      metadataSource: MetadataSource;
    },
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const existing = await this.prisma.candidate.findUnique({
      where: { id: input.id },
    });
    if (existing) {
      throw new ConflictProblemError(`Candidate '${input.id}' already exists.`);
    }

    const party = await this.prisma.politicalParty.findUnique({
      where: { id: input.partyId },
    });
    if (!party) {
      throw new ValidationProblemError(`Political party '${input.partyId}' does not exist.`, [
        { name: 'partyId', reason: 'Referenced party was not found.' },
      ]);
    }
    if (party.status !== 'ACTIVE') {
      throw new ConflictProblemError(
        `Cannot associate new candidate with inactive/archived party '${party.id}'.`
      );
    }

    const created = await this.prisma.candidate.create({
      data: {
        id: input.id,
        partyId: party.id,
        displayName: input.displayName ?? input.fullName,
        fullName: input.fullName,
        age: input.age,
        gender: input.gender,
        education: input.education,
        profession: input.profession,
        criminalCases: input.criminalCases,
        assetsDeclared: BigInt(input.assetsDeclared),
        liabilitiesDeclared: BigInt(input.liabilitiesDeclared),
        photoUrl: input.photoUrl ?? null,
        bio: input.bio,
        isActive: true,
        metadataSource: input.metadataSource,
      },
      include: {
        party: {
          select: { id: true, name: true, abbreviation: true, partyType: true, status: true },
        },
        _count: { select: { nominations: true } },
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'CANDIDATE_CREATED',
      domain: 'CANDIDATE_MANAGEMENT',
      targetEntityId: created.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { partyId: created.partyId, fullName: created.fullName },
    });

    return this.toDto(created);
  }

  async updateCandidate(
    actor: SafeAdminUser,
    candidateId: string,
    input: Record<string, any>,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const existing = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        nominations: {
          include: {
            election: { select: { stateId: true } },
            parliamentaryConstituency: { select: { stateId: true } },
            assemblyConstituency: { select: { stateId: true } },
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundProblemError('Candidate', candidateId);
    }
    this.assertCanAccessCandidate(actor, existing);

    if (input.partyId) {
      const party = await this.prisma.politicalParty.findUnique({
        where: { id: input.partyId },
      });
      if (!party || party.status !== 'ACTIVE') {
        throw new ValidationProblemError(
          `Target party '${input.partyId}' does not exist or is not ACTIVE.`,
          [{ name: 'partyId', reason: 'Invalid or inactive party.' }]
        );
      }
    }

    // IMPORTANT: Updating candidate.partyId NEVER modifies historical candidate_nominations!
    const updated = await this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        ...(input.partyId !== undefined ? { partyId: input.partyId } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.age !== undefined ? { age: input.age } : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.education !== undefined ? { education: input.education } : {}),
        ...(input.profession !== undefined ? { profession: input.profession } : {}),
        ...(input.criminalCases !== undefined
          ? { criminalCases: input.criminalCases }
          : {}),
        ...(input.assetsDeclared !== undefined
          ? { assetsDeclared: BigInt(input.assetsDeclared) }
          : {}),
        ...(input.liabilitiesDeclared !== undefined
          ? { liabilitiesDeclared: BigInt(input.liabilitiesDeclared) }
          : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
      },
      include: {
        party: {
          select: { id: true, name: true, abbreviation: true, partyType: true, status: true },
        },
        _count: { select: { nominations: true } },
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType:
        input.partyId && input.partyId !== existing.partyId
          ? 'CANDIDATE_PARTY_UPDATED'
          : 'CANDIDATE_UPDATED',
      domain: 'CANDIDATE_MANAGEMENT',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: {
        previousPartyId: existing.partyId,
        newPartyId: updated.partyId,
        updatedKeys: Object.keys(input),
      },
    });

    return this.toDto(updated);
  }

  async deactivateCandidate(
    actor: SafeAdminUser,
    candidateId: string,
    reason: string,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string }
  ) {
    const existing = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        nominations: {
          include: {
            election: { select: { stateId: true } },
            parliamentaryConstituency: { select: { stateId: true } },
            assemblyConstituency: { select: { stateId: true } },
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundProblemError('Candidate', candidateId);
    }
    this.assertCanAccessCandidate(actor, existing);

    if (!existing.isActive) {
      throw new ConflictProblemError(`Candidate '${candidateId}' is already inactive.`);
    }

    const updated = await this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
      include: {
        party: {
          select: { id: true, name: true, abbreviation: true, partyType: true, status: true },
        },
        _count: { select: { nominations: true } },
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'CANDIDATE_DEACTIVATED',
      domain: 'CANDIDATE_MANAGEMENT',
      targetEntityId: updated.id,
      outcome: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      details: { reason },
    });

    return this.toDto(updated);
  }
}
