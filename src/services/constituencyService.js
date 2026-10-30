import { CONSTITUENCY_TYPES, METADATA_SOURCES } from '../utils/constants';
import { validateConstituencyInput } from '../utils/validation';

export function createConstituencyRecord(
  input,
  states = [],
  districts = [],
  existingConstituencies = []
) {
  const normalized = {
    name: input.name ? input.name.trim() : '',
    type: input.type || CONSTITUENCY_TYPES.PARLIAMENTARY,
    stateId: input.stateId || '',
    districtIds:
      input.type === CONSTITUENCY_TYPES.PARLIAMENTARY
        ? Array.isArray(input.districtIds)
          ? input.districtIds
          : input.districtId
          ? [input.districtId]
          : []
        : undefined,
    districtId:
      input.type === CONSTITUENCY_TYPES.ASSEMBLY ? input.districtId || '' : undefined,
    parentParliamentaryConstituencyId:
      input.type === CONSTITUENCY_TYPES.ASSEMBLY
        ? input.parentParliamentaryConstituencyId || ''
        : undefined,
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  };

  const validation = validateConstituencyInput(
    normalized,
    states,
    districts,
    existingConstituencies
  );
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors };
  }

  const slug = normalized.name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const prefix =
    normalized.type === CONSTITUENCY_TYPES.PARLIAMENTARY
      ? `${normalized.stateId}-PC`
      : `${normalized.stateId}-AC`;
  let id = input.id && input.id.trim() ? input.id.trim().toUpperCase() : `${prefix}-${slug}`;
  let counter = 2;
  while (existingConstituencies.some((c) => c.id === id)) {
    id = `${prefix}-${slug}-${counter}`;
    counter += 1;
  }

  return {
    ok: true,
    constituency: {
      id,
      ...normalized,
    },
  };
}

export function updateConstituencyRecord(
  constituencyId,
  updates,
  states = [],
  districts = [],
  existingConstituencies = []
) {
  const target = existingConstituencies.find((c) => c.id === constituencyId);
  if (!target) {
    return { ok: false, errors: { id: 'Constituency not found.' } };
  }

  const merged = {
    ...target,
    ...updates,
  };

  const validation = validateConstituencyInput(
    merged,
    states,
    districts,
    existingConstituencies
  );
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors };
  }

  return { ok: true, constituency: merged };
}
