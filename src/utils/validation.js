import { ELECTION_TYPES, CONSTITUENCY_TYPES, ELECTION_STATUSES } from './constants';

export function validateElectionInput(election, constituencies = []) {
  const errors = {};

  if (!election.name || !election.name.trim()) {
    errors.name = 'Election name is required.';
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
    if (election.stateId !== null && election.stateId !== undefined && election.stateId !== '') {
      errors.stateId = 'Lok Sabha election is nationwide and must not be restricted to a single stateId.';
    }
  }

  if (election.status && !ELECTION_STATUSES.includes(election.status)) {
    errors.status = 'Invalid election status.';
  }

  if (election.nominationStartDate && election.nominationEndDate) {
    if (new Date(election.nominationEndDate) < new Date(election.nominationStartDate)) {
      errors.nominationEndDate = 'Nomination end date cannot be earlier than nomination start date.';
    }
  }

  if (election.pollingStartDate && election.pollingEndDate) {
    if (new Date(election.pollingEndDate) < new Date(election.pollingStartDate)) {
      errors.pollingEndDate = 'Polling end date cannot be earlier than polling start date.';
    }
  }

  if (election.pollingEndDate && election.resultDate) {
    if (new Date(election.resultDate) < new Date(election.pollingEndDate)) {
      errors.resultDate = 'Result declaration date cannot be earlier than polling end date.';
    }
  }

  if (Array.isArray(election.constituencyIds) && election.constituencyIds.length > 0 && constituencies.length > 0) {
    const constituencyMap = new Map(constituencies.map((c) => [c.id, c]));
    for (const cId of election.constituencyIds) {
      const c = constituencyMap.get(cId);
      if (!c) {
        errors.constituencyIds = `Constituency ${cId} does not exist.`;
        break;
      }
      if (election.type === ELECTION_TYPES.LOK_SABHA && c.type !== CONSTITUENCY_TYPES.PARLIAMENTARY) {
        errors.constituencyIds = `Lok Sabha elections can only associate Parliamentary constituencies (found ${c.name}).`;
        break;
      }
      if (election.type === ELECTION_TYPES.STATE_ASSEMBLY) {
        if (c.type !== CONSTITUENCY_TYPES.ASSEMBLY) {
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
    errors,
  };
}

export function validateConstituencyInput(constituency, states = [], districts = [], constituencies = []) {
  const errors = {};

  if (!constituency.name || !constituency.name.trim()) {
    errors.name = 'Constituency name is required.';
  }

  if (
    !constituency.type ||
    ![CONSTITUENCY_TYPES.PARLIAMENTARY, CONSTITUENCY_TYPES.ASSEMBLY].includes(constituency.type)
  ) {
    errors.type = 'Constituency type must be PARLIAMENTARY or ASSEMBLY.';
  }

  if (!constituency.stateId) {
    errors.stateId = 'State / Union Territory is required.';
  } else if (states.length > 0 && !states.some((s) => s.id === constituency.stateId)) {
    errors.stateId = 'Selected State / Union Territory is invalid.';
  }

  if (constituency.type === CONSTITUENCY_TYPES.ASSEMBLY) {
    if (!constituency.districtId) {
      errors.districtId = 'District is required for an Assembly constituency.';
    } else if (districts.length > 0) {
      const dist = districts.find((d) => d.id === constituency.districtId);
      if (!dist || dist.stateId !== constituency.stateId) {
        errors.districtId = 'Selected district does not belong to the selected state.';
      }
    }

    if (constituency.parentParliamentaryConstituencyId && constituencies.length > 0) {
      const parentPc = constituencies.find(
        (c) => c.id === constituency.parentParliamentaryConstituencyId
      );
      if (
        !parentPc ||
        parentPc.type !== CONSTITUENCY_TYPES.PARLIAMENTARY ||
        parentPc.stateId !== constituency.stateId
      ) {
        errors.parentParliamentaryConstituencyId =
          'Parent Parliamentary Constituency must be a valid Parliamentary constituency in the same state.';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCandidateInput(candidate, elections = [], constituencies = [], parties = []) {
  const errors = {};

  if (!candidate.name || !candidate.name.trim()) {
    errors.name = 'Candidate name is required.';
  }

  if (!candidate.partyId) {
    errors.partyId = 'Political party affiliation is required.';
  } else if (parties.length > 0 && !parties.some((p) => p.id === candidate.partyId)) {
    errors.partyId = 'Selected political party does not exist.';
  }

  if (!candidate.electionId) {
    errors.electionId = 'Election selection is required.';
  }

  if (!candidate.constituencyId) {
    errors.constituencyId = 'Constituency selection is required.';
  }

  if (candidate.electionId && elections.length > 0) {
    const election = elections.find((e) => e.id === candidate.electionId);
    if (!election) {
      errors.electionId = 'Selected election was not found.';
    } else if (candidate.electionType && candidate.electionType !== election.type) {
      errors.electionType = 'Candidate electionType must match the selected election type.';
    } else if (candidate.constituencyId && constituencies.length > 0) {
      const constituency = constituencies.find((c) => c.id === candidate.constituencyId);
      if (!constituency) {
        errors.constituencyId = 'Selected constituency was not found.';
      } else {
        if (
          election.type === ELECTION_TYPES.LOK_SABHA &&
          constituency.type !== CONSTITUENCY_TYPES.PARLIAMENTARY
        ) {
          errors.constituencyId =
            'Lok Sabha candidate must be assigned to a Parliamentary constituency.';
        }
        if (election.type === ELECTION_TYPES.STATE_ASSEMBLY) {
          if (constituency.type !== CONSTITUENCY_TYPES.ASSEMBLY) {
            errors.constituencyId =
              'State Assembly candidate must be assigned to an Assembly constituency.';
          } else if (election.stateId && constituency.stateId !== election.stateId) {
            errors.constituencyId =
              'Candidate constituency must belong to the same state as the Assembly election.';
          }
        }
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateVoterInput(voter, states = [], districts = [], constituencies = []) {
  const errors = {};

  if (!voter.fullName || !voter.fullName.trim()) {
    errors.fullName = 'Full name is required.';
  }

  if (!voter.dob) {
    errors.dob = 'Date of birth is required.';
  } else {
    const birthDate = new Date(voter.dob);
    const ageDiff = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiff);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    if (isNaN(birthDate.getTime()) || age < 18) {
      errors.dob = 'Voter must be at least 18 years old.';
    }
  }

  if (!voter.epicRef || !voter.epicRef.trim()) {
    errors.epicRef = 'EPIC reference ID is required.';
  }

  if (!voter.stateId) {
    errors.stateId = 'State / Union Territory is required.';
  }

  if (!voter.districtId) {
    errors.districtId = 'District is required.';
  } else if (districts.length > 0 && voter.stateId) {
    const dist = districts.find((d) => d.id === voter.districtId);
    if (!dist || dist.stateId !== voter.stateId) {
      errors.districtId = 'Selected district does not belong to the chosen state.';
    }
  }

  if (!voter.parliamentaryConstituencyId) {
    errors.parliamentaryConstituencyId = 'Parliamentary constituency is required.';
  } else if (constituencies.length > 0 && voter.stateId) {
    const pc = constituencies.find((c) => c.id === voter.parliamentaryConstituencyId);
    if (!pc || pc.type !== CONSTITUENCY_TYPES.PARLIAMENTARY || pc.stateId !== voter.stateId) {
      errors.parliamentaryConstituencyId =
        'Selected Parliamentary constituency is invalid for this state.';
    }
  }

  if (!voter.assemblyConstituencyId) {
    errors.assemblyConstituencyId = 'Assembly constituency is required.';
  } else if (constituencies.length > 0 && voter.stateId) {
    const ac = constituencies.find((c) => c.id === voter.assemblyConstituencyId);
    if (!ac || ac.type !== CONSTITUENCY_TYPES.ASSEMBLY || ac.stateId !== voter.stateId) {
      errors.assemblyConstituencyId =
        'Selected Assembly constituency is invalid for this state.';
    }
  }

  if (!voter.mobile || !/^\d{10}$/.test(String(voter.mobile).trim())) {
    errors.mobile = 'Please enter a valid 10-digit mobile number.';
  }

  if (voter.email && voter.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(voter.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
