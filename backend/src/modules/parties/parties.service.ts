import type { PartyStatus, PartyType } from '@prisma/client';
import { NotFoundProblemError } from '../../common/errors/problemDetails.js';
import type { PartiesRepository } from './parties.repository.js';

export class PartiesService {
  constructor(private readonly repo: PartiesRepository) {}

  async listParties(filters: {
    partyType?: PartyType;
    status?: PartyStatus;
    search?: string;
    page: number;
    limit: number;
  }) {
    return this.repo.listParties(filters);
  }

  async getPartyById(partyId: string) {
    const party = await this.repo.findPartyById(partyId);
    if (!party) {
      throw new NotFoundProblemError('PoliticalParty', partyId);
    }
    return party;
  }

  async getCandidateById(candidateId: string) {
    const candidate = await this.repo.findCandidateById(candidateId);
    if (!candidate) {
      throw new NotFoundProblemError('Candidate', candidateId);
    }

    return {
      id: candidate.id,
      fullName: candidate.fullName,
      age: candidate.age,
      gender: candidate.gender,
      education: candidate.education,
      profession: candidate.profession,
      criminalCases: candidate.criminalCases,
      assetsDeclared: candidate.assetsDeclared,
      liabilitiesDeclared: candidate.liabilitiesDeclared,
      photoUrl: candidate.photoUrl,
      bio: candidate.bio,
      metadataSource: candidate.metadataSource,
      currentRegisteredPartyId: candidate.partyId,
      currentRegisteredParty: candidate.party,
      nominations: candidate.nominations.map((nom) => ({
        nominationId: nom.id,
        electionId: nom.electionId,
        election: nom.election,
        constituencyType: nom.constituencyType,
        parliamentaryConstituencyId: nom.parliamentaryConstituencyId,
        assemblyConstituencyId: nom.assemblyConstituencyId,
        constituency:
          nom.constituencyType === 'PARLIAMENTARY'
            ? nom.parliamentaryConstituency
            : nom.assemblyConstituency,
        status: nom.status,
        nominationDate: nom.nominationDate,
        scrutinyNote: nom.scrutinyNote,
        nominationPartyId: nom.partyId,
        nominationParty: nom.party,
        isIndependent: nom.partyId === null,
      })),
    };
  }
}
