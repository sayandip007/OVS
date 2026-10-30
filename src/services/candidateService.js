import { defaultAvatar } from '../assets';
import { METADATA_SOURCES } from '../utils/constants';
import { validateCandidateInput } from '../utils/validation';

export function createCandidateRecord(
  input,
  elections = [],
  constituencies = [],
  parties = [],
  existingCandidates = []
) {
  const election = elections.find((e) => e.id === input.electionId);
  const normalized = {
    name: input.name ? input.name.trim() : '',
    partyId: input.partyId || '',
    electionId: input.electionId || '',
    constituencyId: input.constituencyId || '',
    electionType: input.electionType || (election ? election.type : ''),
    photograph: input.photograph || defaultAvatar,
    biography: input.biography ? input.biography.trim() : 'Candidate profile registered in demonstration portal.',
    education: input.education ? input.education.trim() : 'Graduate',
    manifesto: input.manifesto ? input.manifesto.trim() : 'Constituency infrastructure, public health, and youth employment.',
    status: input.status || 'APPROVED',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  };

  const validation = validateCandidateInput(
    normalized,
    elections,
    constituencies,
    parties
  );
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors };
  }

  const baseId = `CAND-${existingCandidates.length + 101}`;
  let id = input.id && input.id.trim() ? input.id.trim() : baseId;
  let counter = 2;
  while (existingCandidates.some((c) => c.id === id)) {
    id = `${baseId}-${counter}`;
    counter += 1;
  }

  return {
    ok: true,
    candidate: {
      id,
      ...normalized,
    },
  };
}

export function updateCandidateRecord(
  candidateId,
  updates,
  elections = [],
  constituencies = [],
  parties = [],
  existingCandidates = []
) {
  const target = existingCandidates.find((c) => c.id === candidateId);
  if (!target) {
    return { ok: false, errors: { id: 'Candidate not found.' } };
  }

  const election = elections.find(
    (e) => e.id === (updates.electionId || target.electionId)
  );
  const merged = {
    ...target,
    ...updates,
    electionType:
      updates.electionType || (election ? election.type : target.electionType),
  };

  const validation = validateCandidateInput(
    merged,
    elections,
    constituencies,
    parties
  );
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors };
  }

  return { ok: true, candidate: merged };
}
