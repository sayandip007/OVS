import type { JurisdictionType, ReservationType } from '@prisma/client';
import { NotFoundProblemError } from '../../common/errors/problemDetails.js';
import type { GeographyRepository } from './geography.repository.js';

export class GeographyService {
  constructor(private readonly repo: GeographyRepository) {}

  async listStates(filters: {
    type?: JurisdictionType;
    search?: string;
    page: number;
    limit: number;
  }) {
    return this.repo.listStates(filters);
  }

  async getStateById(stateId: string) {
    const state = await this.repo.findStateById(stateId);
    if (!state) {
      throw new NotFoundProblemError('State', stateId);
    }
    return state;
  }

  async listDistrictsForState(
    stateId: string,
    filters: { search?: string; page: number; limit: number }
  ) {
    const state = await this.getStateById(stateId);
    const result = await this.repo.listDistrictsByStateId(state.id, filters);
    return {
      state: {
        id: state.id,
        name: state.name,
        type: state.type,
      },
      ...result,
    };
  }

  async listParliamentaryConstituenciesForState(
    stateId: string,
    filters: {
      reservationType?: ReservationType;
      search?: string;
      page: number;
      limit: number;
    }
  ) {
    const state = await this.getStateById(stateId);
    const result = await this.repo.listParliamentaryConstituenciesByStateId(
      state.id,
      filters
    );
    return {
      state: {
        id: state.id,
        name: state.name,
        type: state.type,
      },
      ...result,
    };
  }

  async listAssemblyConstituenciesForState(
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
    const state = await this.getStateById(stateId);
    const result = await this.repo.listAssemblyConstituenciesByStateId(
      state.id,
      filters
    );
    return {
      state: {
        id: state.id,
        name: state.name,
        type: state.type,
      },
      ...result,
    };
  }

  async getConstituencyById(constituencyId: string) {
    const constituency = await this.repo.findConstituencyById(constituencyId);
    if (!constituency) {
      throw new NotFoundProblemError('Constituency', constituencyId);
    }
    return constituency;
  }
}
