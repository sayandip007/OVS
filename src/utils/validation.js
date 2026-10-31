import { ELECTION_TYPES, CONSTITUENCY_TYPES, ELECTION_STATUSES } from './constants';

export function calculateAgeFromDob(dobString) {
  if (!dobString) return -1;
  const birthDate = new Date(dobString);
  if (Number.isNaN(birthDate.getTime())) return -1;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export function validateElectionInput(
  election,
  constituencies = [],
  existingElections = []
) {
  const errors = {};

  if (!election.name || !election.name.trim()) {
    errors.name = 'Election name is required.';
  }

  if (election.id && Array.isArray(existingElections) && existingElections.length > 0) {
    const cleanId = String(election.id).trim().toUpperCase();
    const isDuplicate = existingElections.some(
      (e) =>
        !election.isUpdate &&
        String(e.id || e.electionId || '').toUpperCase() === cleanId
    );
    if (isDuplicate) {
      errors.id = `An election with ID "${cleanId}" already exists.`;
    }
  }

  if (
    !election.type ||
    ![ELECTION_TYPES.LOK_SABHA, ELECTION_TYPES.STATE_ASSEMBLY].includes(election.type)
  ) {
    errors.type = 'Valid election type (LOK_SABHA or STATE_ASSEMBLY) is required.';
  }

  const yearNum = Number(election.year);
  if (!yearNum || yearNum < 1951 || yearNum > 2100) {
    errors.year = 'Please enter a valid election year between 1951 and 2100.';
  }

  if (election.type === ELECTION_TYPES.STATE_ASSEMBLY) {
    if (!election.stateId || !String(election.stateId).trim()) {
      errors.stateId = 'State selection is mandatory for a State Assembly election.';
    }
  } else if (election.type === ELECTION_TYPES.LOK_SABHA) {
    if (
      election.stateId !== null &&
      election.stateId !== undefined &&
      election.stateId !== ''
    ) {
      errors.stateId =
        'Lok Sabha election is nationwide and must not be restricted to a single stateId.';
    }
  }

  if (election.status && !ELECTION_STATUSES.includes(election.status)) {
    errors.status = 'Invalid election status.';
  }

  if (election.nominationStartDate && election.nominationEndDate) {
    if (new Date(election.nominationEndDate) < new Date(election.nominationStartDate)) {
      errors.nominationEndDate =
        'Nomination end date cannot be earlier than nomination start date.';
    }
  }

  if (election.nominationEndDate && election.pollingStartDate) {
    if (new Date(election.pollingStartDate) < new Date(election.nominationEndDate)) {
      errors.pollingStartDate =
        'Polling start date cannot be earlier than nomination end date.';
    }
  }

  if (election.pollingStartDate && election.pollingEndDate) {
    if (new Date(election.pollingEndDate) < new Date(election.pollingStartDate)) {
      errors.pollingEndDate =
        'Polling end date cannot be earlier than polling start date.';
    }
  }

  if (election.pollingEndDate && election.countingDate) {
    if (new Date(election.countingDate) < new Date(election.pollingEndDate)) {
      errors.countingDate =
        'Counting date cannot be earlier than polling end date.';
    }
  }

  if (election.countingDate && election.resultDate) {
    if (new Date(election.resultDate) < new Date(election.countingDate)) {
      errors.resultDate =
        'Result declaration date cannot be earlier than counting date.';
    }
  }

  if (election.pollingEndDate && election.resultDate) {
    if (new Date(election.resultDate) < new Date(election.pollingEndDate)) {
      errors.resultDate =
        'Result declaration date cannot be earlier than polling end date.';
    }
  }

  if (
    Array.isArray(election.constituencyIds) &&
    election.constituencyIds.length > 0 &&
    constituencies.length > 0
  ) {
    const constituencyMap = new Map(
      constituencies.map((c) => [c.id || c.constituencyId, c])
    );
    for (const cId of election.constituencyIds) {
      const c = constituencyMap.get(cId);
      if (!c) {
        errors.constituencyIds = `Constituency ${cId} does not exist.`;
        break;
      }
      const cType = c.type || c.constituencyType;
      if (
        election.type === ELECTION_TYPES.LOK_SABHA &&
        cType !== CONSTITUENCY_TYPES.PARLIAMENTARY
      ) {
        errors.constituencyIds = `Lok Sabha elections can only associate Parliamentary constituencies (found ${c.name}).`;
        break;
      }
      if (election.type === ELECTION_TYPES.STATE_ASSEMBLY) {
        if (cType !== CONSTITUENCY_TYPES.ASSEMBLY) {
          errors.constituencyIds = `State Assembly elections can only associate Assembly constituencies (found ${c.name}).`;
          break;
        }
        if (election.stateId && c.stateId !== election.stateId) {
          errors.constituencyIds = `Constituency ${c.name} does not belong to state ${election.stateId}.`;
          break;
        }
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    valid: Object.keys(errors).length === 0,
    errors,
    fieldErrors: errors,
  };
}

export function validateConstituencyInput(
  constituency,
  states = [],
  districts = [],
  constituencies = []
) {
  const errors = {};

  if (!constituency.name || !constituency.name.trim()) {
    errors.name = 'Constituency name is required.';
  }

  const cType = constituency.type || constituency.constituencyType;
  if (
    !cType ||
    ![CONSTITUENCY_TYPES.PARLIAMENTARY, CONSTITUENCY_TYPES.ASSEMBLY].includes(cType)
  ) {
    errors.type = 'Constituency type must be PARLIAMENTARY or ASSEMBLY.';
  }

  if (!constituency.stateId) {
    errors.stateId = 'State / Union Territory is required.';
  } else if (
    states.length > 0 &&
    !states.some((s) => (s.id || s.stateId) === constituency.stateId)
  ) {
    errors.stateId = 'Selected State / Union Territory is invalid.';
  }

  if (cType === CONSTITUENCY_TYPES.ASSEMBLY) {
    if (!constituency.districtId) {
      errors.districtId = 'District is required for an Assembly constituency.';
    } else if (districts.length > 0) {
      const dist = districts.find(
        (d) => (d.id || d.districtId) === constituency.districtId
      );
      if (!dist || dist.stateId !== constituency.stateId) {
        errors.districtId =
          'Selected district does not belong to the selected state.';
      }
    }

    if (
      constituency.parentParliamentaryConstituencyId &&
      constituencies.length > 0
    ) {
      const parentPc = constituencies.find(
        (c) =>
          (c.id || c.constituencyId) ===
          constituency.parentParliamentaryConstituencyId
      );
      if (
        !parentPc ||
        (parentPc.type || parentPc.constituencyType) !==
          CONSTITUENCY_TYPES.PARLIAMENTARY ||
        parentPc.stateId !== constituency.stateId
      ) {
        errors.parentParliamentaryConstituencyId =
          'Parent Parliamentary Constituency must be a valid Parliamentary constituency in the same state.';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    valid: Object.keys(errors).length === 0,
    errors,
    fieldErrors: errors,
  };
}

export function validateCandidateInput(
  candidate,
  elections = [],
  constituencies = [],
  parties = []
) {
  const errors = {};

  if (!candidate.name || !candidate.name.trim()) {
    errors.name = 'Candidate name is required.';
  }

  if (!candidate.partyId) {
    errors.partyId = 'Political party affiliation is required.';
  } else if (
    parties.length > 0 &&
    !parties.some((p) => (p.id || p.partyId) === candidate.partyId)
  ) {
    errors.partyId = 'Selected political party does not exist.';
  }

  if (!candidate.electionId) {
    errors.electionId = 'Election selection is required.';
  }

  if (!candidate.constituencyId) {
    errors.constituencyId = 'Constituency selection is required.';
  }

  if (candidate.electionId && elections.length > 0) {
    const election = elections.find(
      (e) => (e.id || e.electionId) === candidate.electionId
    );
    if (!election) {
      errors.electionId = 'Selected election was not found.';
    } else {
      const elType = election.type || election.electionType;
      if (candidate.electionType && candidate.electionType !== elType) {
        errors.electionType =
          'Candidate electionType must match the selected election type.';
      } else if (candidate.constituencyId && constituencies.length > 0) {
        const constituency = constituencies.find(
          (c) => (c.id || c.constituencyId) === candidate.constituencyId
        );
        if (!constituency) {
          errors.constituencyId = 'Selected constituency was not found.';
        } else {
          const cType = constituency.type || constituency.constituencyType;
          if (
            elType === ELECTION_TYPES.LOK_SABHA &&
            cType !== CONSTITUENCY_TYPES.PARLIAMENTARY
          ) {
            errors.constituencyId =
              'Lok Sabha candidate must be assigned to a Parliamentary constituency.';
          }
          if (elType === ELECTION_TYPES.STATE_ASSEMBLY) {
            if (cType !== CONSTITUENCY_TYPES.ASSEMBLY) {
              errors.constituencyId =
                'State Assembly candidate must be assigned to an Assembly constituency.';
            } else if (
              election.stateId &&
              constituency.stateId !== election.stateId
            ) {
              errors.constituencyId =
                'Candidate constituency must belong to the same state as the Assembly election.';
            }
          }
        }
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    valid: Object.keys(errors).length === 0,
    errors,
    fieldErrors: errors,
  };
}

export function validateVoterInput(
  voter,
  states = [],
  districts = [],
  constituencies = [],
  existingVoters = []
) {
  const errors = {};

  if (!voter || !voter.fullName || !voter.fullName.trim()) {
    errors.fullName = 'Full name is required.';
  }

  const dobValue = voter?.dateOfBirth || voter?.dob;
  if (!dobValue) {
    errors.dob = 'Date of birth is required.';
  } else {
    const age = calculateAgeFromDob(dobValue);
    if (age < 0) {
      errors.dob = 'Please enter a valid date of birth.';
    } else if (age < 18) {
      errors.dob = 'Voter must be at least 18 years old for demo eligibility.';
    }
  }

  const epicVal = voter?.epicReference || voter?.epicRef || voter?.voterRef;
  if (!epicVal || !String(epicVal).trim()) {
    errors.epicRef = 'Demo EPIC / Voter ID reference is required.';
    errors.voterRef = 'Demo EPIC / Voter ID reference is required.';
  } else if (Array.isArray(existingVoters) && existingVoters.length > 0) {
    const normalizedEpic = String(epicVal).trim().toUpperCase();
    const isDuplicate = existingVoters.some((v) => {
      if (voter?.id && (v.id || v.voterId) === voter.id) return false;
      const existingEpic = (
        v.epicRef ||
        v.epicReference ||
        v.voterRef ||
        ''
      )
        .trim()
        .toUpperCase();
      return existingEpic === normalizedEpic;
    });
    if (isDuplicate) {
      errors.epicRef =
        'A demo voter with this EPIC / Voter ID reference already exists.';
      errors.voterRef =
        'A demo voter with this EPIC / Voter ID reference already exists.';
    }
  }

  if (!voter?.email || !String(voter.email).trim()) {
    errors.email = 'Email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(voter.email).trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!voter?.mobile || !/^[6-9]\d{9}$/.test(String(voter.mobile).trim())) {
    errors.mobile =
      'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
  }

  if (voter?.pinCode !== undefined && voter?.pinCode !== '') {
    if (!/^[1-9]\d{5}$/.test(String(voter.pinCode).trim())) {
      errors.pinCode = 'Please enter a valid 6-digit PIN code.';
    }
  }

  if (!voter?.stateId) {
    errors.stateId = 'State / Union Territory is required.';
  } else if (
    states.length > 0 &&
    !states.some((s) => (s.id || s.stateId) === voter.stateId)
  ) {
    errors.stateId = 'Selected State / Union Territory ID is invalid.';
  }

  if (!voter?.districtId) {
    errors.districtId = 'District is required.';
  } else if (districts.length > 0 && voter.stateId) {
    const dist = districts.find(
      (d) => (d.id || d.districtId) === voter.districtId
    );
    if (!dist || dist.stateId !== voter.stateId) {
      errors.districtId =
        'Selected district does not belong to the chosen state.';
    }
  }

  if (!voter?.parliamentaryConstituencyId) {
    errors.parliamentaryConstituencyId =
      'Parliamentary constituency is required.';
  } else if (constituencies.length > 0 && voter.stateId) {
    const pc = constituencies.find(
      (c) => (c.id || c.constituencyId) === voter.parliamentaryConstituencyId
    );
    const pcType = pc?.type || pc?.constituencyType;
    if (
      !pc ||
      pcType !== CONSTITUENCY_TYPES.PARLIAMENTARY ||
      pc.stateId !== voter.stateId
    ) {
      errors.parliamentaryConstituencyId =
        'Selected Parliamentary constituency is invalid for this state.';
    } else if (
      voter.districtId &&
      Array.isArray(pc.districtIds) &&
      pc.districtIds.length > 0 &&
      !pc.districtIds.includes(voter.districtId)
    ) {
      errors.parliamentaryConstituencyId =
        'Selected Parliamentary constituency does not cover the selected district.';
    }
  }

  if (!voter?.assemblyConstituencyId) {
    errors.assemblyConstituencyId = 'Assembly constituency is required.';
  } else if (constituencies.length > 0 && voter.stateId) {
    const ac = constituencies.find(
      (c) => (c.id || c.constituencyId) === voter.assemblyConstituencyId
    );
    const acType = ac?.type || ac?.constituencyType;
    if (
      !ac ||
      acType !== CONSTITUENCY_TYPES.ASSEMBLY ||
      ac.stateId !== voter.stateId
    ) {
      errors.assemblyConstituencyId =
        'Selected Assembly constituency is invalid for this state.';
    } else if (
      voter.districtId &&
      ac.districtId &&
      ac.districtId !== voter.districtId
    ) {
      errors.assemblyConstituencyId =
        'Selected Assembly constituency does not belong to the selected district.';
    } else if (
      voter.parliamentaryConstituencyId &&
      ac.parentParliamentaryConstituencyId &&
      ac.parentParliamentaryConstituencyId !== voter.parliamentaryConstituencyId
    ) {
      errors.assemblyConstituencyId =
        'Selected Assembly constituency does not map to the selected Parliamentary constituency.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    valid: Object.keys(errors).length === 0,
    errors,
    fieldErrors: errors,
  };
}

export function validateProfileUpdateInput(updates) {
  const errors = {};

  if (!updates.fullName || String(updates.fullName).trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  }

  const dobValue = updates.dateOfBirth || updates.dob;
  if (!dobValue) {
    errors.dob = 'Date of birth is required.';
  } else {
    const age = calculateAgeFromDob(dobValue);
    if (age < 18) {
      errors.dob = 'Voter must be at least 18 years old.';
    }
  }

  if (
    !updates.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(updates.email).trim())
  ) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!updates.mobile || !/^[6-9]\d{9}$/.test(String(updates.mobile).trim())) {
    errors.mobile = 'Please enter a valid 10-digit Indian mobile number.';
  }

  if (
    updates.address !== undefined &&
    String(updates.address).trim().length < 5
  ) {
    errors.address = 'Please enter a complete residential address.';
  }

  if (updates.pinCode && !/^[1-9]\d{5}$/.test(String(updates.pinCode).trim())) {
    errors.pinCode = 'Please enter a valid 6-digit PIN code.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    valid: Object.keys(errors).length === 0,
    errors,
    fieldErrors: errors,
  };
}

/**
 * Phase 7 Section 9: Frontend Security Protections
 * Sanitizes plain text input by stripping angle brackets / script tags and enforcing max length.
 */
export function sanitizeTextInput(input, maxLength = 1000) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates that an image URL uses a safe scheme (http, https, data:image/*, blob:, or relative path)
 * and rejects javascript:, vbscript:, or data:text/html payloads.
 */
export function isSafeImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/')
  ) {
    return false;
  }
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('blob:') ||
    /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

/**
 * Validates uploaded image files for type and size limits (default max 2 MB).
 */
export function validateImageFile(
  file,
  { maxSizeBytes = 2 * 1024 * 1024 } = {}
) {
  if (!file || typeof file !== 'object') {
    return { isValid: false, error: 'No image file provided.' };
  }
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ];
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error:
        'Unsupported file type. Only JPEG, PNG, WebP, and SVG images are permitted.',
    };
  }
  const size = Number(file.size ?? 0);
  if (size <= 0 || size > maxSizeBytes) {
    return {
      isValid: false,
      error: `Image file size must not exceed ${Math.round(
        maxSizeBytes / (1024 * 1024)
      )} MB.`,
    };
  }
  return { isValid: true, error: null };
}

