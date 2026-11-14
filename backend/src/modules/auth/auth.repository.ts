import type {
  PrismaClient,
  User,
  VoterProfile,
  AdminUser,
  AdminStateScope,
  AdminElectionScope,
  AdminConstituencyScope,
  UserSession,
  AuthChallenge,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import type { RegisterVoterInput } from './auth.types.js';

export interface AdminUserWithScopes extends AdminUser {
  assignedStateScopes?: AdminStateScope[];
  assignedElectionScopes?: AdminElectionScope[];
  assignedConstituencyScopes?: AdminConstituencyScope[];
}

export interface UserWithRelations extends User {
  voterProfile: VoterProfile | null;
  adminUser: AdminUserWithScopes | null;
}

const ADMIN_USER_INCLUDE = {
  include: {
    assignedStateScopes: true,
    assignedElectionScopes: true,
    assignedConstituencyScopes: true,
  },
} as const;

export interface SessionWithUser extends UserSession {
  user: UserWithRelations;
}

export interface GeographicHierarchyCheck {
  valid: boolean;
  reason?: string;
}

export class AuthRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Finds a User record by primary login identifier (EPIC number or Officer Code).
   */
  async findUserByIdentifier(identifier: string): Promise<UserWithRelations | null> {
    return this.prisma.user.findUnique({
      where: { identifier: identifier.trim().toUpperCase() },
      include: {
        voterProfile: true,
        adminUser: ADMIN_USER_INCLUDE,
      },
    });
  }

  /**
   * Finds a User record by associated voter mobile number.
   */
  async findUserByMobile(mobile: string): Promise<UserWithRelations | null> {
    const profile = await this.prisma.voterProfile.findFirst({
      where: { mobile: mobile.trim() },
      include: {
        user: {
          include: {
            voterProfile: true,
            adminUser: ADMIN_USER_INCLUDE,
          },
        },
      },
    });

    return profile?.user ?? null;
  }

  /**
   * Finds a User record by ID.
   */
  async findUserById(userId: string): Promise<UserWithRelations | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        voterProfile: true,
        adminUser: ADMIN_USER_INCLUDE,
      },
    });
  }

  /**
   * Checks if an EPIC number is already registered in the voter profiles table.
   */
  async findVoterProfileByEpic(epicNumber: string): Promise<VoterProfile | null> {
    return this.prisma.voterProfile.findUnique({
      where: { epicNumber: epicNumber.trim().toUpperCase() },
    });
  }

  /**
   * Checks if an email is already registered in voter profiles.
   */
  async findVoterProfileByEmail(email: string): Promise<VoterProfile | null> {
    return this.prisma.voterProfile.findFirst({
      where: { email: email.trim().toLowerCase() },
    });
  }

  /**
   * Verifies geographic hierarchy integrity:
   * 1. State exists
   * 2. District exists within that State
   * 3. Parliamentary Constituency exists within that State
   * 4. Assembly Constituency exists within that Parliamentary Constituency
   */
  async verifyGeographicHierarchy(
    stateId: string,
    districtId: string,
    parliamentaryConstituencyId: string,
    assemblyConstituencyId: string
  ): Promise<GeographicHierarchyCheck> {
    const state = await this.prisma.state.findUnique({
      where: { id: stateId },
    });
    if (!state) {
      return { valid: false, reason: `State '${stateId}' does not exist.` };
    }

    const district = await this.prisma.district.findUnique({
      where: {
        id_stateId: {
          id: districtId,
          stateId,
        },
      },
    });
    if (!district) {
      return {
        valid: false,
        reason: `District '${districtId}' does not belong to state '${stateId}'.`,
      };
    }

    const pc = await this.prisma.parliamentaryConstituency.findUnique({
      where: {
        id_stateId: {
          id: parliamentaryConstituencyId,
          stateId,
        },
      },
    });
    if (!pc) {
      return {
        valid: false,
        reason: `Parliamentary Constituency '${parliamentaryConstituencyId}' does not belong to state '${stateId}'.`,
      };
    }

    const ac = await this.prisma.assemblyConstituency.findUnique({
      where: {
        id_parentParliamentaryConstituencyId: {
          id: assemblyConstituencyId,
          parentParliamentaryConstituencyId: parliamentaryConstituencyId,
        },
      },
    });
    if (!ac) {
      return {
        valid: false,
        reason: `Assembly Constituency '${assemblyConstituencyId}' is not mapped to parent Parliamentary Constituency '${parliamentaryConstituencyId}'.`,
      };
    }

    return { valid: true };
  }

  /**
   * Atomically creates a User record with userType = VOTER and associated VoterProfile in a single transaction.
   */
  async createVoterUser(
    input: RegisterVoterInput,
    passwordHashPlaceholder: string
  ): Promise<UserWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          userType: 'VOTER',
          identifier: input.epicNumber.toUpperCase(),
          passwordHash: passwordHashPlaceholder,
          isActive: true,
          voterProfile: {
            create: {
              epicNumber: input.epicNumber.toUpperCase(),
              fullName: input.fullName.trim(),
              dateOfBirth: new Date(input.dateOfBirth),
              gender: input.gender,
              mobile: input.mobile.trim(),
              email: input.email.trim().toLowerCase(),
              address: input.address.trim(),
              pinCode: input.pinCode.trim(),
              stateId: input.stateId.toUpperCase(),
              districtId: input.districtId.toUpperCase(),
              parliamentaryConstituencyId: input.parliamentaryConstituencyId.toUpperCase(),
              assemblyConstituencyId: input.assemblyConstituencyId.toUpperCase(),
              isVerified: false,
              metadataSource: 'DEMO_SAMPLE',
            },
          },
        },
        include: {
          voterProfile: true,
          adminUser: true,
        },
      });

      return user;
    });
  }

  /**
   * Creates an active OTP authentication challenge.
   */
  async createAuthChallenge(data: {
    identifier: string;
    otpHash: string;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<AuthChallenge> {
    return this.prisma.authChallenge.create({
      data: {
        identifier: data.identifier.toUpperCase(),
        otpHash: data.otpHash,
        attempts: 0,
        maxAttempts: data.maxAttempts,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * Finds an active challenge by ID.
   */
  async findChallengeById(challengeId: string): Promise<AuthChallenge | null> {
    return this.prisma.authChallenge.findUnique({
      where: { id: challengeId },
    });
  }

  /**
   * Atomically increments challenge verification attempt count.
   */
  async incrementChallengeAttempts(challengeId: string): Promise<AuthChallenge> {
    return this.prisma.authChallenge.update({
      where: { id: challengeId },
      data: { attempts: { increment: 1 } },
    });
  }

  /**
   * Atomically marks a challenge as consumed (prevents concurrent replay).
   * Returns true if successfully marked consumed, false if already consumed.
   */
  async markChallengeConsumed(challengeId: string): Promise<boolean> {
    const result = await this.prisma.authChallenge.updateMany({
      where: {
        id: challengeId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
    return result.count > 0;
  }

  /**
   * Invalidates any existing unconsumed challenges for this identifier.
   */
  async invalidateActiveChallenges(identifier: string): Promise<void> {
    await this.prisma.authChallenge.updateMany({
      where: {
        identifier: identifier.toUpperCase(),
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  /**
   * Creates an authenticated user session using the token hash.
   */
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
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
      },
    });
  }

  /**
   * Finds an active session by its hashed token.
   */
  async findSessionByHash(sessionHash: string): Promise<SessionWithUser | null> {
    return this.prisma.userSession.findUnique({
      where: { id: sessionHash },
      include: {
        user: {
          include: {
            voterProfile: true,
            adminUser: ADMIN_USER_INCLUDE,
          },
        },
      },
    });
  }

  /**
   * Updates lastActivityAt timestamp on an active session.
   */
  async touchSessionActivity(sessionHash: string): Promise<void> {
    await this.prisma.userSession
      .update({
        where: { id: sessionHash },
        data: { lastActivityAt: new Date() },
      })
      .catch(() => {
        // Ignore if concurrently deleted
      });
  }

  /**
   * Deletes a session by its hash (used during logout).
   */
  async deleteSessionByHash(sessionHash: string): Promise<void> {
    await this.prisma.userSession
      .delete({
        where: { id: sessionHash },
      })
      .catch(() => {
        // Ignore if already deleted
      });
  }

  /**
   * Deletes a specific session belonging to a user (IDOR protected).
   */
  async deleteUserSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
    return result.count > 0;
  }

  /**
   * Revokes all active sessions for a user (Logout from all devices).
   */
  async deleteAllUserSessions(userId: string): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  /**
   * Lists all active sessions for a user.
   */
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

