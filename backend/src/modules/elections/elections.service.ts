import type {
  CandidateNominationStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
} from '@prisma/client';
import { NotFoundProblemError } from '../../common/errors/problemDetails.js';
import { PUBLIC_HIDDEN_STATUSES } from './election.lifecycle.js';
import type { ElectionsRepository } from './elections.repository.js';

function toPublicElectionDto(election: any) {
  return {
    id: election.id,
    name: election.name,
    type: election.type,
    year: election.year,
    stateId: election.stateId,
    status: election.status,
    country: election.country,
    targetJurisdiction: election.targetJurisdiction,
    registrationDeadline: election.registrationDeadline,
    nominationStartDate: election.nominationStartDate,
    nominationEndDate: election.nominationEndDate,
    scrutinyDate: election.scrutinyDate,
    withdrawalDeadline: election.withdrawalDeadline,
    campaignStartDate: election.campaignStartDate,
    campaignEndDate: election.campaignEndDate,
    pollingStartDate: election.pollingStartDate,
    pollingEndDate: election.pollingEndDate,
    countingDate: election.countingDate,
    resultDate: election.resultDate,
    description: election.description,
    metadataSource: election.metadataSource,
    state: election.state,
    _count: election._count,
  };
}

export class ElectionsService {
  constructor(private readonly repo: ElectionsRepository) {}

  async listElections(filters: {
    type?: ElectionType;
    status?: ElectionStatus;
    stateId?: string;
    year?: number;
    page: number;
    limit: number;
  }) {
    const result = await this.repo.listElections(filters);
    return {
      items: result.items.map(toPublicElectionDto),
      total: result.total,
    };
  }

  async getElectionById(electionId: string) {
    const election = await this.repo.findElectionById(electionId);
    if (!election || PUBLIC_HIDDEN_STATUSES.includes(election.status)) {
      throw new NotFoundProblemError('Election', electionId);
    }
    return toPublicElectionDto(election);
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
    const election = await this.getElectionById(electionId);
    const result = await this.repo.listElectionConstituencies(election.id, filters);

    const items = result.items.map((mapping) => ({
      id: mapping.id,
      electionId: mapping.electionId,
      constituencyType: mapping.constituencyType,
      parliamentaryConstituencyId: mapping.parliamentaryConstituencyId,
      assemblyConstituencyId: mapping.assemblyConstituencyId,
      constituency:
        mapping.constituencyType === 'PARLIAMENTARY'
          ? mapping.parliamentaryConstituency
          : mapping.assemblyConstituency,
    }));

    return {
      election: {
        id: election.id,
        name: election.name,
        type: election.type,
        status: election.status,
      },
      items,
      total: result.total,
    };
  }

  async listElectionCandidates(
    electionId: string,
    filters: {
      constituencyId?: string;
      partyId?: string;
      status?: CandidateNominationStatus;
      page: number;
      limit: number;
    }
  ) {
    const election = await this.getElectionById(electionId);
    const result = await this.repo.listElectionCandidateNominations(
      election.id,
      filters
    );

    const items = result.items.map((nom) => ({
      nominationId: nom.id,
      electionId: nom.electionId,
      constituencyType: nom.constituencyType,
      parliamentaryConstituencyId: nom.parliamentaryConstituencyId,
      assemblyConstituencyId: nom.assemblyConstituencyId,
      status: nom.status,
      nominationDate: nom.nominationDate,
      nominationPartyId: nom.partyId,
      nominationParty: nom.party,
      isIndependent: nom.partyId === null,
      candidate: {
        id: nom.candidate.id,
        fullName: nom.candidate.fullName,
        age: nom.candidate.age,
        gender: nom.candidate.gender,
        education: nom.candidate.education,
        profession: nom.candidate.profession,
        criminalCases: nom.candidate.criminalCases,
        assetsDeclared: nom.candidate.assetsDeclared,
        liabilitiesDeclared: nom.candidate.liabilitiesDeclared,
        photoUrl: nom.candidate.photoUrl,
        bio: nom.candidate.bio,
        currentRegisteredPartyId: nom.candidate.partyId,
        currentRegisteredParty: nom.candidate.party,
      },
      constituency:
        nom.constituencyType === 'PARLIAMENTARY'
          ? nom.parliamentaryConstituency
          : nom.assemblyConstituency,
    }));

    return {
      election: {
        id: election.id,
        name: election.name,
        type: election.type,
        status: election.status,
      },
      items,
      total: result.total,
    };
  }
}
