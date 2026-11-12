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

  async listPublicCandidates(filters: {
    partyId?: string;
    search?: string;
    page: number;
    limit: number;
  }) {
    const result = await this.repo.listPublicCandidates(filters);
    return {
      items: result.items.map((c) => ({
        id: c.id,
        displayName: c.displayName ?? c.fullName,
        fullName: c.fullName,
        age: c.age,
        gender: c.gender,
        education: c.education,
        profession: c.profession,
        photoUrl: c.photoUrl,
        bio: c.bio,
        metadataSource: c.metadataSource,
        currentRegisteredPartyId: c.partyId,
        currentRegisteredParty: c.party,
      })),
      total: result.total,
    };
  }

  async getCandidateById(candidateId: string) {
    const candidate = await this.repo.findCandidateById(candidateId);
    if (!candidate || !candidate.isActive) {
      throw new NotFoundProblemError('Candidate', candidateId);
    }

    const approvedNominations = candidate.nominations.filter(
      (nom) => nom.status === 'APPROVED'
    );

    return {
      id: candidate.id,
      displayName: candidate.displayName ?? candidate.fullName,
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
      nominations: approvedNominations.map((nom) => ({
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
        nominationPartyId: nom.partyId,
        nominationParty: nom.party,
        partyNameSnapshot: nom.partyNameSnapshot,
        partyAbbreviationSnapshot: nom.partyAbbreviationSnapshot,
        isIndependent: nom.isIndependent || nom.partyId === null,
      })),
    };
  }
}
