import {
  UserType,
  type PrismaClient,
  type Prisma,
  type User,
  type AdminUser,
  type AdminStateScope,
  type AdminElectionScope,
  type AdminConstituencyScope,
  type AdminRole,
  type AdminStatus,
  type ConstituencyType,
  type UserSession,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import { buildPaginationMeta, type PaginationMeta } from '../../common/utils/response.js';

export interface AdminFullRecord extends AdminUser {
  user: User;
  assignedStateScopes: AdminStateScope[];
  assignedElectionScopes: AdminElectionScope[];
  assignedConstituencyScopes: AdminConstituencyScope[];
}

export interface ConstituencyScopeInput {
  electionId?: string | null;
  constituencyType: ConstituencyType;
  parliamentaryConstituencyId?: string | null;
  assemblyConstituencyId?: string | null;
}

export interface CreateAdminUserRepoInput {
  officerCode: string;
  email: string;
  fullName: string;
  designation: string;
  role: AdminRole;
  passwordHash: string;
  assignedStateId: string | null;
  stateIds: string[];
  electionIds: string[];
  constituencyScopes: ConstituencyScopeInput[];
  createdByAdminId: string | null;
}

export interface UpdateAdminUserRepoInput {
  fullName?: string;
  designation?: string;
  email?: string;
  role?: AdminRole;
  passwordHash?: string;
  assignedStateId?: string | null;
  stateIds?: string[];
  electionIds?: string[];
  constituencyScopes?: ConstituencyScopeInput[];
  assignedByAdminId: string;
}

export interface ListAdminUsersRepoFilter {
  page: number;
  limit: number;
  role?: AdminRole;
  status?: AdminStatus;
  stateId?: string;
  search?: string;
  allowedStateIds?: string[] | null;
}

const ADMIN_FULL_INCLUDE = {
  user: true,
  assignedStateScopes: true,
  assignedElectionScopes: true,
  assignedConstituencyScopes: true,
} as const;

export class AdminRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Finds an admin account by normalized email or normalized officerCode.
   * Rejects non-ADMIN user types implicitly by querying adminUser relations.
   */
  async findAdminByLoginIdentifier(
    identifier: string
  ): Promise<AdminFullRecord | null> {
    const trimmed = identifier.trim();
    const lowerEmail = trimmed.toLowerCase();
    const upperCode = trimmed.toUpperCase();

    return this.prisma.adminUser.findFirst({
      where: {
        user: { userType: 'ADMIN' },
        OR: [{ email: lowerEmail }, { officerCode: upperCode }],
      },
      include: ADMIN_FULL_INCLUDE,
    });
  }

  async findAdminById(adminId: string): Promise<AdminFullRecord | null> {
    return this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: ADMIN_FULL_INCLUDE,
    });
  }

  async findAdminByUserId(userId: string): Promise<AdminFullRecord | null> {
    return this.prisma.adminUser.findUnique({
      where: { userId },
      include: ADMIN_FULL_INCLUDE,
    });
  }

  async findAdminByEmail(email: string): Promise<AdminUser | null> {
    return this.prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findAdminByOfficerCode(officerCode: string): Promise<AdminUser | null> {
    return this.prisma.adminUser.findUnique({
      where: { officerCode: officerCode.trim().toUpperCase() },
    });
  }

  async findUserByIdentifier(identifier: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { identifier: identifier.trim().toUpperCase() },
    });
  }

  /**
   * Validates that all referenced State, Election, and Constituency IDs exist in PostgreSQL.
   */
  async validateScopeReferences(input: {
    stateIds?: string[];
    electionIds?: string[];
    constituencyScopes?: ConstituencyScopeInput[];
  }): Promise<{ valid: boolean; reason?: string; pcStateMap?: Map<string, string>; acStateMap?: Map<string, string> }> {
    const stateIds = Array.from(new Set(input.stateIds ?? []));
    if (stateIds.length > 0) {
      const states = await this.prisma.state.findMany({
        where: { id: { in: stateIds } },
        select: { id: true },
      });
      const foundSet = new Set(states.map((s) => s.id));
      for (const sId of stateIds) {
        if (!foundSet.has(sId)) {
          return { valid: false, reason: `State '${sId}' does not exist.` };
        }
      }
    }

    const electionIds = Array.from(new Set(input.electionIds ?? []));
    const scopeElectionIds = (input.constituencyScopes ?? [])
      .map((c) => c.electionId)
      .filter((e): e is string => Boolean(e));
    const allElectionIds = Array.from(new Set([...electionIds, ...scopeElectionIds]));

    if (allElectionIds.length > 0) {
      const elections = await this.prisma.election.findMany({
        where: { id: { in: allElectionIds } },
        select: { id: true, stateId: true },
      });
      const foundSet = new Set(elections.map((e) => e.id));
      for (const eId of allElectionIds) {
        if (!foundSet.has(eId)) {
          return { valid: false, reason: `Election '${eId}' does not exist.` };
        }
      }
    }

    const pcStateMap = new Map<string, string>();
    const acStateMap = new Map<string, string>();

    const pcIds = Array.from(
      new Set(
        (input.constituencyScopes ?? [])
          .filter((c) => c.constituencyType === 'PARLIAMENTARY' && c.parliamentaryConstituencyId)
          .map((c) => c.parliamentaryConstituencyId!)
      )
    );
    if (pcIds.length > 0) {
      const pcs = await this.prisma.parliamentaryConstituency.findMany({
        where: { id: { in: pcIds } },
        select: { id: true, stateId: true },
      });
      for (const pc of pcs) pcStateMap.set(pc.id, pc.stateId);
      for (const id of pcIds) {
        if (!pcStateMap.has(id)) {
          return { valid: false, reason: `Parliamentary constituency '${id}' does not exist.` };
        }
      }
    }

    const acIds = Array.from(
      new Set(
        (input.constituencyScopes ?? [])
          .filter((c) => c.constituencyType === 'ASSEMBLY' && c.assemblyConstituencyId)
          .map((c) => c.assemblyConstituencyId!)
      )
    );
    if (acIds.length > 0) {
      const acs = await this.prisma.assemblyConstituency.findMany({
        where: { id: { in: acIds } },
        select: { id: true, stateId: true },
      });
      for (const ac of acs) acStateMap.set(ac.id, ac.stateId);
      for (const id of acIds) {
        if (!acStateMap.has(id)) {
          return { valid: false, reason: `Assembly constituency '${id}' does not exist.` };
        }
      }
    }

    return { valid: true, pcStateMap, acStateMap };
  }

  /**
   * Fetches stateIds for a set of elections to support delegation boundary enforcement.
   */
  async getElectionStateIds(electionIds: string[]): Promise<Array<{ id: string; stateId: string | null }>> {
    if (electionIds.length === 0) return [];
    return this.prisma.election.findMany({
      where: { id: { in: electionIds } },
      select: { id: true, stateId: true },
    });
  }

  /**
   * Atomically provisions User + AdminUser + normalized scope tables.
   */
  async createAdminUser(input: CreateAdminUserRepoInput): Promise<AdminFullRecord> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          userType: UserType.ADMIN,
          identifier: input.officerCode.toUpperCase(),
          passwordHash: input.passwordHash,
          isActive: true,
        },
      });

      const created = await tx.adminUser.create({
        data: {
          userId: user.id,
          officerCode: input.officerCode.toUpperCase(),
          email: input.email.toLowerCase(),
          fullName: input.fullName.trim(),
          designation: input.designation.trim(),
          role: input.role,
          status: 'ACTIVE',
          isActive: true,
          assignedStateId: input.assignedStateId,
          createdByAdminId: input.createdByAdminId,
          passwordUpdatedAt: new Date(),
          ...(input.stateIds.length > 0
            ? {
                assignedStateScopes: {
                  createMany: {
                    data: input.stateIds.map((stateId) => ({
                      stateId,
                      assignedByAdminId: input.createdByAdminId,
                    })),
                  },
                },
              }
            : {}),
          ...(input.electionIds.length > 0
            ? {
                assignedElectionScopes: {
                  createMany: {
                    data: input.electionIds.map((electionId) => ({
                      electionId,
                      assignedByAdminId: input.createdByAdminId,
                    })),
                  },
                },
              }
            : {}),
          ...(input.constituencyScopes.length > 0
            ? {
                assignedConstituencyScopes: {
                  createMany: {
                    data: input.constituencyScopes.map((cs) => ({
                      electionId: cs.electionId ?? null,
                      constituencyType: cs.constituencyType,
                      parliamentaryConstituencyId:
                        cs.constituencyType === 'PARLIAMENTARY'
                          ? cs.parliamentaryConstituencyId ?? null
                          : null,
                      assemblyConstituencyId:
                        cs.constituencyType === 'ASSEMBLY'
                          ? cs.assemblyConstituencyId ?? null
                          : null,
                      assignedByAdminId: input.createdByAdminId,
                    })),
                  },
                },
              }
            : {}),
        },
        include: ADMIN_FULL_INCLUDE,
      });

      return created as AdminFullRecord;
    });
  }

  /**
   * Atomically updates AdminUser attributes and optionally replaces assigned scopes.
   */
  async updateAdminUser(
    adminId: string,
    userId: string,
    input: UpdateAdminUserRepoInput
  ): Promise<AdminFullRecord> {
    return this.prisma.$transaction(async (tx) => {
      if (input.passwordHash) {
        await tx.user.update({
          where: { id: userId },
          data: { passwordHash: input.passwordHash },
        });
      }

      if (input.stateIds !== undefined) {
        await tx.adminStateScope.deleteMany({ where: { adminUserId: adminId } });
        if (input.stateIds.length > 0) {
          await tx.adminStateScope.createMany({
            data: input.stateIds.map((stateId) => ({
              adminUserId: adminId,
              stateId,
              assignedByAdminId: input.assignedByAdminId,
            })),
          });
        }
      }

      if (input.electionIds !== undefined) {
        await tx.adminElectionScope.deleteMany({ where: { adminUserId: adminId } });
        if (input.electionIds.length > 0) {
          await tx.adminElectionScope.createMany({
            data: input.electionIds.map((electionId) => ({
              adminUserId: adminId,
              electionId,
              assignedByAdminId: input.assignedByAdminId,
            })),
          });
        }
      }

      if (input.constituencyScopes !== undefined) {
        await tx.adminConstituencyScope.deleteMany({ where: { adminUserId: adminId } });
        if (input.constituencyScopes.length > 0) {
          await tx.adminConstituencyScope.createMany({
            data: input.constituencyScopes.map((cs) => ({
              adminUserId: adminId,
              electionId: cs.electionId ?? null,
              constituencyType: cs.constituencyType,
              parliamentaryConstituencyId:
                cs.constituencyType === 'PARLIAMENTARY'
                  ? cs.parliamentaryConstituencyId ?? null
                  : null,
              assemblyConstituencyId:
                cs.constituencyType === 'ASSEMBLY'
                  ? cs.assemblyConstituencyId ?? null
                  : null,
              assignedByAdminId: input.assignedByAdminId,
            })),
          });
        }
      }

      const data: Prisma.AdminUserUpdateInput = {};
      if (input.fullName !== undefined) data.fullName = input.fullName.trim();
      if (input.designation !== undefined) data.designation = input.designation.trim();
      if (input.email !== undefined) data.email = input.email.toLowerCase();
      if (input.role !== undefined) data.role = input.role;
      if (input.passwordHash !== undefined) data.passwordUpdatedAt = new Date();
      if (input.assignedStateId !== undefined) {
        if (input.assignedStateId === null) {
          data.assignedState = { disconnect: true };
        } else {
          data.assignedState = { connect: { id: input.assignedStateId } };
        }
      }

      return tx.adminUser.update({
        where: { id: adminId },
        data,
        include: ADMIN_FULL_INCLUDE,
      });
    });
  }

  async updateAdminSelfProfile(
    adminId: string,
    input: { fullName?: string; designation?: string }
  ): Promise<AdminFullRecord> {
    return this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
        ...(input.designation !== undefined
          ? { designation: input.designation.trim() }
          : {}),
      },
      include: ADMIN_FULL_INCLUDE,
    });
  }

  /**
   * Atomically updates admin lifecycle status (SUSPENDED/DEACTIVATED/ACTIVE)
   * and immediately revokes all active UserSessions on suspension/deactivation.
   */
  async updateAdminStatus(
    adminId: string,
    userId: string,
    options: {
      status: AdminStatus;
      reason?: string | null;
    }
  ): Promise<AdminFullRecord> {
    const isActive = options.status === 'ACTIVE';

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          isActive,
          ...(isActive
            ? {
                failedLoginAttempts: 0,
                lockoutUntil: null,
              }
            : {}),
        },
      });

      if (!isActive) {
        await tx.userSession.deleteMany({
          where: { userId },
        });
      }

      return tx.adminUser.update({
        where: { id: adminId },
        data: {
          status: options.status,
          isActive,
          ...(options.status === 'SUSPENDED'
            ? {
                suspendedAt: new Date(),
                suspendedReason: options.reason ?? null,
              }
            : {}),
          ...(options.status === 'DEACTIVATED'
            ? {
                deactivatedAt: new Date(),
                suspendedReason: options.reason ?? null,
              }
            : {}),
          ...(options.status === 'ACTIVE'
            ? {
                suspendedAt: null,
                deactivatedAt: null,
                suspendedReason: null,
              }
            : {}),
        },
        include: ADMIN_FULL_INCLUDE,
      });
    });
  }

  async recordLoginFailure(
    userId: string,
    maxAttempts: number,
    lockoutDurationMs: number
  ): Promise<{ failedLoginAttempts: number; lockoutUntil: Date | null }> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true },
    });

    const nextAttempts = (current?.failedLoginAttempts ?? 0) + 1;
    const lockoutUntil =
      nextAttempts >= maxAttempts ? new Date(Date.now() + lockoutDurationMs) : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: nextAttempts,
        lockoutUntil,
      },
    });

    return { failedLoginAttempts: nextAttempts, lockoutUntil };
  }

  async recordLoginSuccess(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }

  async listAdminUsers(filter: ListAdminUsersRepoFilter): Promise<{
    items: AdminFullRecord[];
    pagination: PaginationMeta;
  }> {
    const andConditions: Prisma.AdminUserWhereInput[] = [];

    if (filter.role) andConditions.push({ role: filter.role });
    if (filter.status) andConditions.push({ status: filter.status });

    if (filter.stateId) {
      andConditions.push({
        OR: [
          { assignedStateId: filter.stateId },
          { assignedStateScopes: { some: { stateId: filter.stateId } } },
        ],
      });
    }

    if (filter.allowedStateIds && filter.allowedStateIds.length > 0) {
      andConditions.push({
        OR: [
          { assignedStateId: { in: filter.allowedStateIds } },
          {
            assignedStateScopes: {
              some: { stateId: { in: filter.allowedStateIds } },
            },
          },
        ],
      });
    }

    if (filter.search) {
      const q = filter.search.trim();
      andConditions.push({
        OR: [
          { officerCode: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
          { designation: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.AdminUserWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const skip = (filter.page - 1) * filter.limit;

    const [total, items] = await Promise.all([
      this.prisma.adminUser.count({ where }),
      this.prisma.adminUser.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        include: ADMIN_FULL_INCLUDE,
      }),
    ]);

    return {
      items,
      pagination: buildPaginationMeta(filter.page, filter.limit, total),
    };
  }

  async createSession(data: {
    sessionHash: string;
    userId: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<UserSession> {
    return this.prisma.userSession.create({
      data: {
        id: data.sessionHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
        lastActivityAt: new Date(),
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
      },
    });
  }

  async deleteSessionByHash(sessionHash: string): Promise<void> {
    await this.prisma.userSession
      .delete({ where: { id: sessionHash } })
      .catch(() => {});
  }

  async deleteAllUserSessions(userId: string): Promise<number> {
    const res = await this.prisma.userSession.deleteMany({ where: { userId } });
    return res.count;
  }

  async deleteUserSession(userId: string, sessionId: string): Promise<boolean> {
    const res = await this.prisma.userSession.deleteMany({
      where: { id: sessionId, userId },
    });
    return res.count > 0;
  }

  async listActiveSessions(userId: string): Promise<UserSession[]> {
    return this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
