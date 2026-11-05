import type {
  PrismaClient,
  VoterProfile,
  State,
  District,
  ParliamentaryConstituency,
  AssemblyConstituency,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';

export interface VoterProfileWithGeography extends VoterProfile {
  state: State;
  district: District;
  parliamentaryConstituency: ParliamentaryConstituency;
  assemblyConstituency: AssemblyConstituency;
}

export class VotersRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Finds a VoterProfile by the owning User ID, including full geographic relations.
   */
  async findProfileByUserId(userId: string): Promise<VoterProfileWithGeography | null> {
    return this.prisma.voterProfile.findUnique({
      where: { userId },
      include: {
        state: true,
        district: true,
        parliamentaryConstituency: true,
        assemblyConstituency: true,
      },
    });
  }

  /**
   * Updates permitted voter profile fields.
   */
  async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      email?: string;
      mobile?: string;
      address?: string;
      pinCode?: string;
      dateOfBirth?: Date;
      gender?: string;
      stateId?: string;
      districtId?: string;
      parliamentaryConstituencyId?: string;
      assemblyConstituencyId?: string;
    }
  ): Promise<VoterProfileWithGeography> {
    return this.prisma.voterProfile.update({
      where: { userId },
      data,
      include: {
        state: true,
        district: true,
        parliamentaryConstituency: true,
        assemblyConstituency: true,
      },
    });
  }

  /**
   * Verifies that the geographic tuple (state, district, PC, AC) adheres to database foreign keys.
   */
  async verifyGeographicConsistency(
    stateId: string,
    districtId: string,
    parliamentaryConstituencyId: string,
    assemblyConstituencyId: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const state = await this.prisma.state.findUnique({ where: { id: stateId } });
    if (!state) {
      return { valid: false, reason: `State '${stateId}' does not exist.` };
    }

    const district = await this.prisma.district.findUnique({
      where: { id_stateId: { id: districtId, stateId } },
    });
    if (!district) {
      return {
        valid: false,
        reason: `District '${districtId}' does not belong to state '${stateId}'.`,
      };
    }

    const pc = await this.prisma.parliamentaryConstituency.findUnique({
      where: { id_stateId: { id: parliamentaryConstituencyId, stateId } },
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
}

