import {
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import { VotersRepository, type VoterProfileWithGeography } from './voters.repository.js';
import type { SafeVoterProfile } from '../auth/auth.types.js';

export interface UpdateVoterProfileInput {
  fullName?: string;
  email?: string;
  mobile?: string;
  address?: string;
  pinCode?: string;
  dateOfBirth?: string;
  gender?: string;
  stateId?: string;
  districtId?: string;
  parliamentaryConstituencyId?: string;
  assemblyConstituencyId?: string;
}

export interface VoterConstituencyDetails {
  state: {
    id: string;
    name: string;
    type: string;
    totalLokSabhaSeats: number;
    totalAssemblySeats: number;
  };
  district: {
    id: string;
    name: string;
  };
  parliamentaryConstituency: {
    id: string;
    name: string;
    seatNumber: number;
    reservation: string;
  };
  assemblyConstituency: {
    id: string;
    name: string;
    seatNumber: number;
    reservation: string;
    parentParliamentaryConstituencyId: string;
  };
}

export class VotersService {
  constructor(private readonly repository: VotersRepository = new VotersRepository()) {}

  /**
   * Transforms raw VoterProfileWithGeography to safe client payload.
   */
  toSafeProfile(profile: VoterProfileWithGeography): SafeVoterProfile {
    return {
      id: profile.id,
      epicNumber: profile.epicNumber,
      fullName: profile.fullName,
      dateOfBirth: profile.dateOfBirth.toISOString().split('T')[0]!,
      gender: profile.gender,
      mobile: profile.mobile,
      email: profile.email,
      address: profile.address,
      pinCode: profile.pinCode,
      stateId: profile.stateId,
      districtId: profile.districtId,
      parliamentaryConstituencyId: profile.parliamentaryConstituencyId,
      assemblyConstituencyId: profile.assemblyConstituencyId,
      registrationDate: profile.registrationDate.toISOString(),
      isVerified: profile.isVerified,
      metadataSource: profile.metadataSource,
    };
  }

  /**
   * Retrieves profile for an authenticated voter.
   */
  async getProfile(userId: string): Promise<SafeVoterProfile> {
    const profile = await this.repository.findProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundProblemError('Voter Profile for user', userId);
    }
    return this.toSafeProfile(profile);
  }

  /**
   * Updates allowed profile attributes while strictly enforcing geographic integrity.
   */
  async updateProfile(
    userId: string,
    input: UpdateVoterProfileInput
  ): Promise<SafeVoterProfile> {
    const existing = await this.repository.findProfileByUserId(userId);
    if (!existing) {
      throw new NotFoundProblemError('Voter Profile for user', userId);
    }

    // Check if any geographic field is being changed
    const targetStateId = input.stateId ?? existing.stateId;
    const targetDistrictId = input.districtId ?? existing.districtId;
    const targetPcId = input.parliamentaryConstituencyId ?? existing.parliamentaryConstituencyId;
    const targetAcId = input.assemblyConstituencyId ?? existing.assemblyConstituencyId;

    const geoChanged =
      targetStateId !== existing.stateId ||
      targetDistrictId !== existing.districtId ||
      targetPcId !== existing.parliamentaryConstituencyId ||
      targetAcId !== existing.assemblyConstituencyId;

    if (geoChanged) {
      const geoCheck = await this.repository.verifyGeographicConsistency(
        targetStateId,
        targetDistrictId,
        targetPcId,
        targetAcId
      );

      if (!geoCheck.valid) {
        throw new ValidationProblemError(
          geoCheck.reason || 'Updated geographic constituency hierarchy is invalid.',
          [
            {
              name: 'assemblyConstituencyId',
              reason: geoCheck.reason || 'Geographic validation failed.',
            },
          ]
        );
      }
    }

    const updated = await this.repository.updateProfile(userId, {
      fullName: input.fullName?.trim(),
      email: input.email?.trim().toLowerCase(),
      mobile: input.mobile?.trim(),
      address: input.address?.trim(),
      pinCode: input.pinCode?.trim(),
      gender: input.gender,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      stateId: input.stateId?.toUpperCase(),
      districtId: input.districtId?.toUpperCase(),
      parliamentaryConstituencyId: input.parliamentaryConstituencyId?.toUpperCase(),
      assemblyConstituencyId: input.assemblyConstituencyId?.toUpperCase(),
    });

    return this.toSafeProfile(updated);
  }

  /**
   * Resolves the full geographic hierarchy for the voter's assigned constituencies.
   */
  async getConstituencies(userId: string): Promise<VoterConstituencyDetails> {
    const profile = await this.repository.findProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundProblemError('Voter Profile for user', userId);
    }

    return {
      state: {
        id: profile.state.id,
        name: profile.state.name,
        type: profile.state.type,
        totalLokSabhaSeats: profile.state.totalLokSabhaSeats,
        totalAssemblySeats: profile.state.totalAssemblySeats,
      },
      district: {
        id: profile.district.id,
        name: profile.district.name,
      },
      parliamentaryConstituency: {
        id: profile.parliamentaryConstituency.id,
        name: profile.parliamentaryConstituency.name,
        seatNumber: profile.parliamentaryConstituency.constituencyNumber,
        reservation: profile.parliamentaryConstituency.reservationType,
      },
      assemblyConstituency: {
        id: profile.assemblyConstituency.id,
        name: profile.assemblyConstituency.name,
        seatNumber: profile.assemblyConstituency.constituencyNumber,
        reservation: profile.assemblyConstituency.reservationType,
        parentParliamentaryConstituencyId:
          profile.assemblyConstituency.parentParliamentaryConstituencyId,
      },
    };
  }
}
