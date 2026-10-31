import {
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  METADATA_SOURCES,
  RESULT_STATUSES,
} from '../utils/constants';
import { INITIAL_STATES } from '../data/states';
import { INITIAL_DISTRICTS } from '../data/districts';
import { INITIAL_CONSTITUENCIES } from '../data/constituencies';
import { INITIAL_PARTIES } from '../data/parties';
import { INITIAL_ELECTIONS, INITIAL_ANNOUNCEMENTS } from '../data/elections';
import { INITIAL_CANDIDATES } from '../data/candidates';
import { INITIAL_VOTERS } from '../data/voters';
import { INITIAL_RESULTS } from '../data/results';

/**
 * Phase 7 Section 3: Critical Election Data Integrity Audit Service
 * Validates all 17 relational integrity and provenance rules across:
 * States, Districts, Parliamentary Constituencies, Assembly Constituencies,
 * Elections, Parties, Candidates, Voters, Participation Records,
 * Counting Rounds, and Published Results.
 */
export function auditElectionDataIntegrity({
  states = INITIAL_STATES,
  districts = INITIAL_DISTRICTS,
  constituencies = INITIAL_CONSTITUENCIES,
  parties = INITIAL_PARTIES,
  elections = INITIAL_ELECTIONS,
  candidates = INITIAL_CANDIDATES,
  voters = INITIAL_VOTERS,
  results = INITIAL_RESULTS,
  announcements = INITIAL_ANNOUNCEMENTS,
} = {}) {
  const errors = [];
  const warnings = [];
  const ruleResults = [];

  const recordRule = (ruleNumber, ruleName, passed, ruleErrors = []) => {
    ruleResults.push({
      ruleNumber,
      ruleName,
      passed,
      issueCount: ruleErrors.length,
      issues: ruleErrors,
    });
    for (const err of ruleErrors) {
      errors.push(`[Rule ${ruleNumber}: ${ruleName}] ${err}`);
    }
  };

  // =========================================================================
  // Rule 1: Every entity has a unique ID
  // =========================================================================
  const rule1Errors = [];
  const checkUniqueIds = (collection, label, idKey = 'id', altKey = null) => {
    const seen = new Set();
    for (const item of collection || []) {
      const id = item?.[idKey] || (altKey ? item?.[altKey] : null);
      if (!id || typeof id !== 'string' || !id.trim()) {
        rule1Errors.push(`${label} contains an entity with missing ID.`);
        continue;
      }
      if (seen.has(id)) {
        rule1Errors.push(`Duplicate ${label} ID detected: "${id}".`);
      }
      seen.add(id);
    }
    return seen;
  };

  const stateIds = checkUniqueIds(states, 'State', 'id', 'stateId');
  const districtIds = checkUniqueIds(districts, 'District', 'id', 'districtId');
  const constituencyIds = checkUniqueIds(
    constituencies,
    'Constituency',
    'id',
    'constituencyId'
  );
  const partyIds = checkUniqueIds(parties, 'Party', 'id', 'partyId');
  const electionIds = checkUniqueIds(elections, 'Election', 'id', 'electionId');
  const candidateIds = checkUniqueIds(
    candidates,
    'Candidate',
    'id',
    'candidateId'
  );
  const voterIds = checkUniqueIds(voters, 'Voter', 'id', 'voterId');
  const resultIds = checkUniqueIds(results, 'Result', 'id', 'resultId');
  checkUniqueIds(announcements, 'Announcement', 'id', 'announcementId');

  recordRule(1, 'Unique Entity IDs', rule1Errors.length === 0, rule1Errors);

  // Build lookup maps
  const stateMap = new Map(
    (states || []).map((s) => [s.id || s.stateId, s])
  );
  const districtMap = new Map(
    (districts || []).map((d) => [d.id || d.districtId, d])
  );
  const constituencyMap = new Map(
    (constituencies || []).map((c) => [c.id || c.constituencyId, c])
  );
  const partyMap = new Map(
    (parties || []).map((p) => [p.id || p.partyId, p])
  );
  const electionMap = new Map(
    (elections || []).map((e) => [e.id || e.electionId, e])
  );
  const candidateMap = new Map(
    (candidates || []).map((c) => [c.id || c.candidateId, c])
  );

  // =========================================================================
  // Rule 2: Every foreign-key-like reference points to an existing entity
  // =========================================================================
  const rule2Errors = [];
  for (const d of districts || []) {
    if (!stateIds.has(d.stateId)) {
      rule2Errors.push(
        `District "${d.id || d.districtId}" references non-existent stateId "${d.stateId}".`
      );
    }
  }
  for (const c of constituencies || []) {
    if (!stateIds.has(c.stateId)) {
      rule2Errors.push(
        `Constituency "${c.id}" references non-existent stateId "${c.stateId}".`
      );
    }
  }
  for (const cand of candidates || []) {
    if (!electionIds.has(cand.electionId)) {
      rule2Errors.push(
        `Candidate "${cand.id}" references non-existent electionId "${cand.electionId}".`
      );
    }
    if (!constituencyIds.has(cand.constituencyId)) {
      rule2Errors.push(
        `Candidate "${cand.id}" references non-existent constituencyId "${cand.constituencyId}".`
      );
    }
    if (!partyIds.has(cand.partyId)) {
      rule2Errors.push(
        `Candidate "${cand.id}" references non-existent partyId "${cand.partyId}".`
      );
    }
  }
  recordRule(
    2,
    'Foreign-Key Reference Integrity',
    rule2Errors.length === 0,
    rule2Errors
  );

  // =========================================================================
  // Rule 3: Every Assembly constituency has a valid state & district association
  // =========================================================================
  const rule3Errors = [];
  for (const c of constituencies || []) {
    const cType = c.type || c.constituencyType;
    if (cType === CONSTITUENCY_TYPES.ASSEMBLY) {
      if (!c.stateId || !stateMap.has(c.stateId)) {
        rule3Errors.push(
          `Assembly constituency "${c.id}" is missing a valid stateId.`
        );
      }
      if (!c.districtId || !districtMap.has(c.districtId)) {
        rule3Errors.push(
          `Assembly constituency "${c.id}" is missing a valid districtId.`
        );
      } else {
        const dist = districtMap.get(c.districtId);
        if (dist.stateId !== c.stateId) {
          rule3Errors.push(
            `Assembly constituency "${c.id}" state "${c.stateId}" does not match district "${c.districtId}" state "${dist.stateId}".`
          );
        }
      }
      if (c.parentParliamentaryConstituencyId) {
        const parentPc = constituencyMap.get(
          c.parentParliamentaryConstituencyId
        );
        if (
          !parentPc ||
          (parentPc.type || parentPc.constituencyType) !==
            CONSTITUENCY_TYPES.PARLIAMENTARY ||
          parentPc.stateId !== c.stateId
        ) {
          rule3Errors.push(
            `Assembly constituency "${c.id}" has invalid parentParliamentaryConstituencyId "${c.parentParliamentaryConstituencyId}".`
          );
        }
      }
    }
  }
  recordRule(
    3,
    'Assembly Constituency State & District Association',
    rule3Errors.length === 0,
    rule3Errors
  );

  // =========================================================================
  // Rule 4: Every Parliamentary constituency has valid geographical associations
  // =========================================================================
  const rule4Errors = [];
  for (const c of constituencies || []) {
    const cType = c.type || c.constituencyType;
    if (cType === CONSTITUENCY_TYPES.PARLIAMENTARY) {
      if (!c.stateId || !stateMap.has(c.stateId)) {
        rule4Errors.push(
          `Parliamentary constituency "${c.id}" is missing a valid stateId.`
        );
      }
      if (Array.isArray(c.districtIds)) {
        for (const dId of c.districtIds) {
          const dist = districtMap.get(dId);
          if (!dist || dist.stateId !== c.stateId) {
            rule4Errors.push(
              `Parliamentary constituency "${c.id}" references district "${dId}" outside state "${c.stateId}".`
            );
          }
        }
      }
    }
  }
  recordRule(
    4,
    'Parliamentary Constituency Geography Association',
    rule4Errors.length === 0,
    rule4Errors
  );

  // =========================================================================
  // Rule 5: Constituency types are not mixed
  // =========================================================================
  const rule5Errors = [];
  const pcIdSet = new Set();
  const acIdSet = new Set();
  for (const c of constituencies || []) {
    const cId = c.id || c.constituencyId;
    const cType = c.type || c.constituencyType;
    if (
      cType !== CONSTITUENCY_TYPES.PARLIAMENTARY &&
      cType !== CONSTITUENCY_TYPES.ASSEMBLY
    ) {
      rule5Errors.push(
        `Constituency "${cId}" has invalid constituencyType "${cType}".`
      );
    } else if (cType === CONSTITUENCY_TYPES.PARLIAMENTARY) {
      pcIdSet.add(cId);
    } else {
      acIdSet.add(cId);
    }
  }
  for (const id of pcIdSet) {
    if (acIdSet.has(id)) {
      rule5Errors.push(
        `Constituency ID "${id}" appears as both PARLIAMENTARY and ASSEMBLY.`
      );
    }
  }
  recordRule(
    5,
    'Strict Separation of Parliamentary & Assembly Constituency Types',
    rule5Errors.length === 0,
    rule5Errors
  );

  // =========================================================================
  // Rule 6: Election types match constituency types
  // =========================================================================
  const rule6Errors = [];
  for (const el of elections || []) {
    const elId = el.id || el.electionId;
    const elType = el.type || el.electionType;
    const expectedConstType =
      elType === ELECTION_TYPES.LOK_SABHA
        ? CONSTITUENCY_TYPES.PARLIAMENTARY
        : CONSTITUENCY_TYPES.ASSEMBLY;

    if (
      el.constituencyType &&
      el.constituencyType !== expectedConstType
    ) {
      rule6Errors.push(
        `Election "${elId}" (${elType}) declares mismatched constituencyType "${el.constituencyType}".`
      );
    }

    for (const cId of el.constituencyIds || []) {
      const c = constituencyMap.get(cId);
      if (!c) {
        rule6Errors.push(
          `Election "${elId}" references unknown constituency "${cId}".`
        );
      } else if ((c.type || c.constituencyType) !== expectedConstType) {
        rule6Errors.push(
          `Election "${elId}" (${elType}) includes "${cId}" of type "${c.type || c.constituencyType}".`
        );
      }
    }
  }
  recordRule(
    6,
    'Election Type Matches Constituency Type',
    rule6Errors.length === 0,
    rule6Errors
  );

  // =========================================================================
  // Rule 7: Assembly elections have valid state associations
  // =========================================================================
  const rule7Errors = [];
  for (const el of elections || []) {
    const elId = el.id || el.electionId;
    const elType = el.type || el.electionType;
    if (elType === ELECTION_TYPES.STATE_ASSEMBLY) {
      if (!el.stateId || !stateMap.has(el.stateId)) {
        rule7Errors.push(
          `State Assembly election "${elId}" is missing a valid stateId.`
        );
      }
    } else if (elType === ELECTION_TYPES.LOK_SABHA) {
      if (el.stateId !== null && el.stateId !== undefined && el.stateId !== '') {
        rule7Errors.push(
          `Lok Sabha election "${elId}" must be national (stateId: null), found "${el.stateId}".`
        );
      }
    }
  }
  recordRule(
    7,
    'State Assembly Election State Association',
    rule7Errors.length === 0,
    rule7Errors
  );

  // =========================================================================
  // Rule 8: Lok Sabha candidates are assigned to Parliamentary constituencies
  // =========================================================================
  const rule8Errors = [];
  for (const cand of candidates || []) {
    const el = electionMap.get(cand.electionId);
    const elType = cand.electionType || el?.type || el?.electionType;
    if (elType === ELECTION_TYPES.LOK_SABHA) {
      const c = constituencyMap.get(cand.constituencyId);
      if (
        !c ||
        (c.type || c.constituencyType) !== CONSTITUENCY_TYPES.PARLIAMENTARY
      ) {
        rule8Errors.push(
          `Lok Sabha candidate "${cand.id}" is assigned to non-Parliamentary constituency "${cand.constituencyId}".`
        );
      }
    }
  }
  recordRule(
    8,
    'Lok Sabha Candidates Assigned to Parliamentary Constituencies',
    rule8Errors.length === 0,
    rule8Errors
  );

  // =========================================================================
  // Rule 9: Assembly candidates are assigned to Assembly constituencies
  // =========================================================================
  const rule9Errors = [];
  for (const cand of candidates || []) {
    const el = electionMap.get(cand.electionId);
    const elType = cand.electionType || el?.type || el?.electionType;
    if (elType === ELECTION_TYPES.STATE_ASSEMBLY) {
      const c = constituencyMap.get(cand.constituencyId);
      if (
        !c ||
        (c.type || c.constituencyType) !== CONSTITUENCY_TYPES.ASSEMBLY
      ) {
        rule9Errors.push(
          `State Assembly candidate "${cand.id}" is assigned to non-Assembly constituency "${cand.constituencyId}".`
        );
      } else if (el?.stateId && c.stateId !== el.stateId) {
        rule9Errors.push(
          `State Assembly candidate "${cand.id}" constituency "${cand.constituencyId}" (${c.stateId}) does not match election state "${el.stateId}".`
        );
      }
    }
  }
  recordRule(
    9,
    'Assembly Candidates Assigned to Assembly Constituencies',
    rule9Errors.length === 0,
    rule9Errors
  );

  // =========================================================================
  // Rule 10: Candidates belong to the correct election
  // =========================================================================
  const rule10Errors = [];
  for (const cand of candidates || []) {
    const el = electionMap.get(cand.electionId);
    if (!el) {
      rule10Errors.push(
        `Candidate "${cand.id}" references missing election "${cand.electionId}".`
      );
    } else {
      const elType = el.type || el.electionType;
      if (cand.electionType && cand.electionType !== elType) {
        rule10Errors.push(
          `Candidate "${cand.id}" has electionType "${cand.electionType}", but election "${cand.electionId}" is "${elType}".`
        );
      }
    }
  }
  recordRule(
    10,
    'Candidate Election Membership Integrity',
    rule10Errors.length === 0,
    rule10Errors
  );

  // =========================================================================
  // Rule 11: Party references are valid
  // =========================================================================
  const rule11Errors = [];
  for (const cand of candidates || []) {
    if (!cand.partyId || !partyMap.has(cand.partyId)) {
      rule11Errors.push(
        `Candidate "${cand.id}" references invalid partyId "${cand.partyId}".`
      );
    }
  }
  recordRule(
    11,
    'Political Party Reference Integrity',
    rule11Errors.length === 0,
    rule11Errors
  );

  // =========================================================================
  // Rule 12: Voter constituency references are valid
  // =========================================================================
  const rule12Errors = [];
  for (const v of voters || []) {
    const vId = v.id || v.voterId;
    if (!stateMap.has(v.stateId)) {
      rule12Errors.push(`Voter "${vId}" has invalid stateId "${v.stateId}".`);
    }
    const dist = districtMap.get(v.districtId);
    if (!dist || dist.stateId !== v.stateId) {
      rule12Errors.push(
        `Voter "${vId}" has invalid districtId "${v.districtId}" for state "${v.stateId}".`
      );
    }
    const pc = constituencyMap.get(v.parliamentaryConstituencyId);
    if (
      !pc ||
      (pc.type || pc.constituencyType) !== CONSTITUENCY_TYPES.PARLIAMENTARY ||
      pc.stateId !== v.stateId
    ) {
      rule12Errors.push(
        `Voter "${vId}" has invalid parliamentaryConstituencyId "${v.parliamentaryConstituencyId}".`
      );
    }
    const ac = constituencyMap.get(v.assemblyConstituencyId);
    if (
      !ac ||
      (ac.type || ac.constituencyType) !== CONSTITUENCY_TYPES.ASSEMBLY ||
      ac.stateId !== v.stateId
    ) {
      rule12Errors.push(
        `Voter "${vId}" has invalid assemblyConstituencyId "${v.assemblyConstituencyId}".`
      );
    }
  }
  recordRule(
    12,
    'Voter Geography & Dual-Constituency Reference Integrity',
    rule12Errors.length === 0,
    rule12Errors
  );

  // =========================================================================
  // Rule 13: Election schedules are chronologically valid
  // =========================================================================
  const rule13Errors = [];
  for (const el of elections || []) {
    const elId = el.id || el.electionId;
    const pairs = [
      ['nominationStartDate', 'nominationEndDate'],
      ['nominationEndDate', 'pollingStartDate'],
      ['pollingStartDate', 'pollingEndDate'],
      ['pollingEndDate', 'countingDate'],
      ['countingDate', 'resultDate'],
    ];
    for (const [startKey, endKey] of pairs) {
      const sVal = el[startKey];
      const eVal = el[endKey];
      if (sVal && eVal && new Date(eVal) < new Date(sVal)) {
        rule13Errors.push(
          `Election "${elId}" schedule violation: ${endKey} (${eVal}) is earlier than ${startKey} (${sVal}).`
        );
      }
    }
  }
  recordRule(
    13,
    'Election Schedule Chronology Validation',
    rule13Errors.length === 0,
    rule13Errors
  );

  // =========================================================================
  // Rule 14: Result records reference valid elections & constituencies
  // =========================================================================
  const rule14Errors = [];
  for (const res of results || []) {
    const rId = res.id || res.resultId;
    const el = electionMap.get(res.electionId);
    if (!el) {
      rule14Errors.push(
        `Result "${rId}" references non-existent electionId "${res.electionId}".`
      );
    }
    const c = constituencyMap.get(res.constituencyId);
    if (!c) {
      rule14Errors.push(
        `Result "${rId}" references non-existent constituencyId "${res.constituencyId}".`
      );
    } else if (el) {
      const expectedType =
        (el.type || el.electionType) === ELECTION_TYPES.LOK_SABHA
          ? CONSTITUENCY_TYPES.PARLIAMENTARY
          : CONSTITUENCY_TYPES.ASSEMBLY;
      if ((c.type || c.constituencyType) !== expectedType) {
        rule14Errors.push(
          `Result "${rId}" constituency "${res.constituencyId}" does not match election type "${el.type || el.electionType}".`
        );
      }
    }
  }
  recordRule(
    14,
    'Result Record Election & Constituency References',
    rule14Errors.length === 0,
    rule14Errors
  );

  // =========================================================================
  // Rule 15: Counting rounds reference valid result sessions & sequential order
  // =========================================================================
  const rule15Errors = [];
  for (const res of results || []) {
    const rId = res.id || res.resultId;
    const rounds = Array.isArray(res.rounds) ? res.rounds : [];
    const candIdsInSession = new Set(
      (res.candidates || []).map((c) => c.candidateId)
    );
    let prevTotal = 0;
    for (let i = 0; i < rounds.length; i += 1) {
      const r = rounds[i];
      if (Number(r.roundNumber) !== i + 1) {
        rule15Errors.push(
          `Result "${rId}" has non-sequential roundNumber ${r.roundNumber} at index ${i}.`
        );
      }
      if (Number(r.totalVotesCounted) < prevTotal) {
        rule15Errors.push(
          `Result "${rId}" round ${r.roundNumber} decreased cumulative votes (${r.totalVotesCounted} < ${prevTotal}).`
        );
      }
      prevTotal = Number(r.totalVotesCounted) || prevTotal;
      for (const cv of r.candidateVotes || []) {
        if (!candIdsInSession.has(cv.candidateId)) {
          rule15Errors.push(
            `Result "${rId}" round ${r.roundNumber} references candidate "${cv.candidateId}" not in result session.`
          );
        }
      }
    }
  }
  recordRule(
    15,
    'Counting Round Session & Cumulative Sequence Integrity',
    rule15Errors.length === 0,
    rule15Errors
  );

  // =========================================================================
  // Rule 16: Published results reference valid candidates
  // =========================================================================
  const rule16Errors = [];
  for (const res of results || []) {
    const rId = res.id || res.resultId;
    if (
      res.status === RESULT_STATUSES.PUBLISHED ||
      res.status === RESULT_STATUSES.CORRECTED
    ) {
      if (!res.winnerCandidateId) {
        rule16Errors.push(
          `Published result "${rId}" is missing winnerCandidateId.`
        );
      } else {
        const winCand = candidateMap.get(res.winnerCandidateId);
        if (
          !winCand ||
          winCand.electionId !== res.electionId ||
          winCand.constituencyId !== res.constituencyId
        ) {
          rule16Errors.push(
            `Published result "${rId}" references invalid winnerCandidateId "${res.winnerCandidateId}".`
          );
        }
      }
      if (res.runnerUpCandidateId) {
        const runCand = candidateMap.get(res.runnerUpCandidateId);
        if (
          !runCand ||
          runCand.electionId !== res.electionId ||
          runCand.constituencyId !== res.constituencyId
        ) {
          rule16Errors.push(
            `Published result "${rId}" references invalid runnerUpCandidateId "${res.runnerUpCandidateId}".`
          );
        }
      }
    }
  }
  recordRule(
    16,
    'Published Result Winner & Candidate Reference Integrity',
    rule16Errors.length === 0,
    rule16Errors
  );

  // =========================================================================
  // Rule 17: Archived records & metadata provenance integrity
  // =========================================================================
  const rule17Errors = [];
  const archivedElections = (elections || []).filter(
    (e) => e.status === 'ARCHIVED' || e.status === 'RESULTS_DECLARED'
  );
  for (const archEl of archivedElections) {
    const elId = archEl.id || archEl.electionId;
    const archCands = (candidates || []).filter((c) => c.electionId === elId);
    for (const ac of archCands) {
      if (!constituencyMap.has(ac.constituencyId)) {
        rule17Errors.push(
          `Archived candidate "${ac.id}" (${elId}) has broken constituency reference "${ac.constituencyId}".`
        );
      }
      if (!partyMap.has(ac.partyId)) {
        rule17Errors.push(
          `Archived candidate "${ac.id}" (${elId}) has broken party reference "${ac.partyId}".`
        );
      }
    }
  }

  // Verify 28 States + 8 Union Territories = 36 jurisdictions
  const stateCount = (states || []).filter(
    (s) => (s.type || s.category) === 'STATE'
  ).length;
  const utCount = (states || []).filter(
    (s) => (s.type || s.category) === 'UNION_TERRITORY' || (s.type || s.category) === 'UT'
  ).length;
  if (stateCount !== 28 || utCount !== 8) {
    rule17Errors.push(
      `Expected 28 States and 8 Union Territories, found ${stateCount} States and ${utCount} UTs.`
    );
  }

  recordRule(
    17,
    'Archived Historical Relationships & 36-Jurisdiction Provenance',
    rule17Errors.length === 0,
    rule17Errors
  );

  // Provenance breakdown
  const countProvenance = (items = []) => {
    let official = 0;
    let demoSample = 0;
    for (const item of items) {
      if (item?.metadataSource === METADATA_SOURCES.VERIFIED_OFFICIAL) {
        official += 1;
      } else {
        demoSample += 1;
      }
    }
    return { total: items.length, official, demoSample };
  };

  const provenanceSummary = {
    states: countProvenance(states),
    districts: countProvenance(districts),
    constituencies: countProvenance(constituencies),
    parties: countProvenance(parties),
    elections: countProvenance(elections),
    candidates: countProvenance(candidates),
    voters: countProvenance(voters),
    results: countProvenance(results),
  };

  return {
    isHealthy: errors.length === 0,
    auditedAt: new Date().toISOString(),
    totalRulesChecked: ruleResults.length,
    rulesPassed: ruleResults.filter((r) => r.passed).length,
    rulesFailed: ruleResults.filter((r) => !r.passed).length,
    counts: {
      states: (states || []).length,
      statesCount: stateCount,
      unionTerritoriesCount: utCount,
      districts: (districts || []).length,
      parliamentaryConstituencies: pcIdSet.size,
      assemblyConstituencies: acIdSet.size,
      parties: (parties || []).length,
      elections: (elections || []).length,
      candidates: (candidates || []).length,
      voters: (voters || []).length,
      results: (results || []).length,
      announcements: (announcements || []).length,
    },
    provenanceSummary,
    ruleResults,
    errors,
    warnings,
  };
}
