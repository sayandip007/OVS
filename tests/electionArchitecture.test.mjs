import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  STORAGE_KEYS,
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  ELECTION_STATUSES,
  DEMO_OTP_CODES,
  NOTA_OPTION,
} from '../src/utils/constants.js';
import {
  validateElectionInput,
  validateConstituencyInput,
  validateCandidateInput,
  validateVoterInput,
} from '../src/utils/validation.js';
import {
  getVoterEligibleElections,
  getVoterConstituencyIdForElection,
  getVoterParticipationSummary,
  getCandidatesForElectionConstituency,
} from '../src/utils/electionHelpers.js';
import { INITIAL_STATES } from '../src/data/states.js';
import { INITIAL_DISTRICTS } from '../src/data/districts.js';
import { INITIAL_CONSTITUENCIES } from '../src/data/constituencies.js';
import { INITIAL_PARTIES } from '../src/data/parties.js';
import { INITIAL_ELECTIONS } from '../src/data/elections.js';
import { INITIAL_CANDIDATES, INITIAL_TALLIES } from '../src/data/candidates.js';
import { INITIAL_VOTERS, INITIAL_ADMIN_OFFICERS } from '../src/data/voters.js';
import { storageService } from '../src/services/storageService.js';
import {
  createElectionRecord,
  recordSimulatedParticipation,
} from '../src/services/electionService.js';
import { createCandidateRecord } from '../src/services/candidateService.js';

// Ensure clean storage before tests
storageService.resetAllDemoData();

test('TEST 1 & TEST 2 — Routing, Navigation, and Public Pages Integrity', () => {
  const routesSource = fs.readFileSync(
    path.resolve('src/routes/AppRoutes.jsx'),
    'utf8'
  );

  // Verify all required public, voter, and admin routes are registered
  const requiredRoutes = [
    'path="/"',
    'path="/about"',
    'path="/elections"',
    'path="/candidates"',
    'path="/results"',
    'path="/feedback"',
    'path="/voter/login"',
    'path="/voter/register"',
    'path="dashboard"',
    'path="profile"',
    'path="elections"',
    'path="constituencies"',
    'path="/eci/login"',
    'path="states"',
    'path="districts"',
    'path="parties"',
    'path="candidates"',
    'path="*"',
  ];

  for (const routePattern of requiredRoutes) {
    assert.ok(
      routesSource.includes(routePattern),
      `Expected AppRoutes.jsx to include ${routePattern}`
    );
  }

  // Verify all page files exist in the modular structure
  const requiredFiles = [
    'src/pages/public/Home.jsx',
    'src/pages/public/About.jsx',
    'src/pages/public/ElectionInformation.jsx',
    'src/pages/public/CandidateDirectory.jsx',
    'src/pages/public/Results.jsx',
    'src/pages/public/Feedback.jsx',
    'src/pages/public/NotFound.jsx',
    'src/pages/voter/Login.jsx',
    'src/pages/voter/Register.jsx',
    'src/pages/voter/Dashboard.jsx',
    'src/pages/voter/Profile.jsx',
    'src/pages/voter/ElectionHub.jsx',
    'src/pages/voter/ConstituencyDetails.jsx',
    'src/pages/admin/Login.jsx',
    'src/pages/admin/Dashboard.jsx',
    'src/pages/admin/ElectionManagement.jsx',
    'src/pages/admin/StateManagement.jsx',
    'src/pages/admin/DistrictManagement.jsx',
    'src/pages/admin/ConstituencyManagement.jsx',
    'src/pages/admin/PartyManagement.jsx',
    'src/pages/admin/CandidateManagement.jsx',
  ];

  for (const file of requiredFiles) {
    assert.ok(fs.existsSync(path.resolve(file)), `Missing required page file: ${file}`);
  }
});

test('TEST 3 — Voter Registration with Dual Constituency Mapping & 18+ Validation', () => {
  // Reject underage voter
  const underageValidation = validateVoterInput(
    {
      fullName: 'Young Citizen',
      dob: '2015-01-01',
      epicRef: 'WBX0001112',
      stateId: 'WB',
      districtId: 'NADIA',
      parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
      email: 'young@example.in',
      mobile: '9876500001',
    },
    INITIAL_STATES,
    INITIAL_DISTRICTS,
    INITIAL_CONSTITUENCIES
  );
  assert.equal(underageValidation.isValid, false);

  // Accept valid adult voter with both Parliamentary and Assembly constituencies
  const validVoterInput = {
    fullName: 'Sourav Chatterjee',
    dob: '1996-08-15',
    epicRef: 'WBX7788990',
    stateId: 'WB',
    districtId: 'NADIA',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    email: 'sourav@example.in',
    mobile: '9831122334',
  };
  const adultValidation = validateVoterInput(
    validVoterInput,
    INITIAL_STATES,
    INITIAL_DISTRICTS,
    INITIAL_CONSTITUENCIES
  );
  assert.equal(adultValidation.isValid, true);
});

test('TEST 4 & TEST 5 — Voter & Admin OTP Authentication and Role Separation', () => {
  assert.equal(DEMO_OTP_CODES.PRIMARY, '123456');
  assert.equal(DEMO_OTP_CODES.RESEND, '654321');

  // Verify default West Bengal voter exists and has both PC and AC mapped
  const wbVoter = INITIAL_VOTERS.find((v) => v.epicRef === 'WBX1234567');
  assert.ok(wbVoter, 'Expected WBX1234567 demo voter to exist');
  assert.equal(wbVoter.stateId, 'WB');
  assert.equal(wbVoter.parliamentaryConstituencyId, 'WB-PC-KRISHNANAGAR');
  assert.equal(wbVoter.assemblyConstituencyId, 'WB-AC-KRISHNANAGAR-UTTAR');

  // Verify ECI Admin officer exists
  const adminOfficer = INITIAL_ADMIN_OFFICERS.find(
    (o) => o.officerId === '1234' || o.altOfficerId === '1234'
  );
  assert.ok(adminOfficer, 'Expected ECI officer 1234 to exist');

  // Verify route guards in AppRoutes.jsx enforce separation between Voter and Admin
  const routesSource = fs.readFileSync(
    path.resolve('src/routes/AppRoutes.jsx'),
    'utf8'
  );
  assert.ok(routesSource.includes('function RequireVoter'));
  assert.ok(routesSource.includes('function RequireAdmin'));
});

test('TEST 6 — All 28 States and 8 Union Territories & Geographical Hierarchy', () => {
  const statesOnly = INITIAL_STATES.filter((s) => s.type === 'STATE');
  const utsOnly = INITIAL_STATES.filter(
    (s) => s.type === 'UNION_TERRITORY' || s.type === 'UT'
  );

  assert.equal(statesOnly.length, 28, 'Must include all 28 Indian States');
  assert.equal(utsOnly.length, 8, 'Must include all 8 Union Territories');
  assert.equal(INITIAL_STATES.length, 36, 'Total States + UTs must be 36');

  // Verify every single State/UT has at least 2 sample districts and at least 2 Parliamentary constituencies
  for (const st of INITIAL_STATES) {
    const stateDistricts = INITIAL_DISTRICTS.filter((d) => d.stateId === st.id);
    assert.ok(
      stateDistricts.length >= 2,
      `State/UT ${st.id} must have at least 2 sample districts`
    );

    const statePCs = INITIAL_CONSTITUENCIES.filter(
      (c) =>
        c.stateId === st.id &&
        c.type === CONSTITUENCY_TYPES.PARLIAMENTARY
    );
    assert.ok(
      statePCs.length >= 2,
      `State/UT ${st.id} must have at least 2 Parliamentary constituencies`
    );

    // Every sample district has at least 2 sample Assembly constituencies
    for (const dist of stateDistricts) {
      const distACs = INITIAL_CONSTITUENCIES.filter(
        (c) =>
          c.districtId === dist.id &&
          c.type === CONSTITUENCY_TYPES.ASSEMBLY
      );
      assert.ok(
        distACs.length >= 2,
        `District ${dist.id} must have at least 2 Assembly constituencies`
      );
    }
  }
});

test('TEST 7 — Constituency Separation (PARLIAMENTARY vs ASSEMBLY)', () => {
  const pcs = INITIAL_CONSTITUENCIES.filter(
    (c) => c.type === CONSTITUENCY_TYPES.PARLIAMENTARY
  );
  const acs = INITIAL_CONSTITUENCIES.filter(
    (c) => c.type === CONSTITUENCY_TYPES.ASSEMBLY
  );

  assert.ok(pcs.length >= 72);
  assert.ok(acs.length >= 144);

  // Verify Assembly constituencies reference a valid parent Parliamentary constituency in the same state
  for (const ac of acs) {
    assert.ok(
      ac.parentParliamentaryConstituencyId,
      `Assembly constituency ${ac.id} must reference a parent PC`
    );
    const parentPC = pcs.find(
      (pc) => pc.id === ac.parentParliamentaryConstituencyId
    );
    assert.ok(
      parentPC,
      `Parent PC ${ac.parentParliamentaryConstituencyId} must exist`
    );
    assert.equal(parentPC.stateId, ac.stateId);
  }
});

test('TEST 8 & TEST 9 — Lok Sabha & State Assembly Election Creation and Validation', () => {
  // Create a Lok Sabha election
  const lsResult = createElectionRecord(
    {
      name: 'Lok Sabha General Election 2034',
      type: ELECTION_TYPES.LOK_SABHA,
      year: 2034,
      nominationStartDate: '2034-03-10',
      nominationEndDate: '2034-03-25',
      pollingStartDate: '2034-04-15',
      pollingEndDate: '2034-05-15',
      resultDate: '2034-05-20',
      status: 'POLLING_ACTIVE',
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES
  );
  assert.equal(lsResult.ok, true);
  assert.equal(lsResult.election.type, ELECTION_TYPES.LOK_SABHA);
  assert.equal(lsResult.election.stateId, null);

  // Create a State Assembly election for West Bengal
  const wbAssemblyResult = createElectionRecord(
    {
      name: 'West Bengal Legislative Assembly Election 2031',
      type: ELECTION_TYPES.STATE_ASSEMBLY,
      year: 2031,
      stateId: 'WB',
      nominationStartDate: '2031-03-10',
      nominationEndDate: '2031-03-25',
      pollingStartDate: '2031-04-18',
      pollingEndDate: '2031-05-10',
      resultDate: '2031-05-18',
      status: 'POLLING_ACTIVE',
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES
  );
  assert.equal(wbAssemblyResult.ok, true);
  assert.equal(wbAssemblyResult.election.type, ELECTION_TYPES.STATE_ASSEMBLY);
  assert.equal(wbAssemblyResult.election.stateId, 'WB');

  // Ensure STATE_ASSEMBLY without stateId is rejected
  const invalidStateElection = createElectionRecord(
    {
      name: 'Invalid Assembly Election Without State',
      type: ELECTION_TYPES.STATE_ASSEMBLY,
      year: 2031,
      stateId: null,
      pollingStartDate: '2031-04-18',
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES
  );
  assert.equal(invalidStateElection.ok, false);
});

test('TEST 10 — Simultaneous Elections (Lok Sabha + West Bengal Assembly Independent Ballots & 0/2 -> 1/2 -> 2/2 Progress)', () => {
  let voter = structuredClone(
    INITIAL_VOTERS.find((v) => v.id === 'VOTER-001')
  );
  let talliesMap = structuredClone(INITIAL_TALLIES);

  // Verify voter is in West Bengal -> Nadia -> Krishnanagar PC + Krishnanagar Uttar AC
  assert.equal(voter.stateId, 'WB');
  assert.equal(voter.parliamentaryConstituencyId, 'WB-PC-KRISHNANAGAR');
  assert.equal(voter.assemblyConstituencyId, 'WB-AC-KRISHNANAGAR-UTTAR');

  // Eligible elections for this voter
  const eligible = getVoterEligibleElections(voter, INITIAL_ELECTIONS);
  const eligibleIds = eligible.map((e) => e.id);
  assert.ok(eligibleIds.includes('LS-2029'), 'Voter must see Lok Sabha 2029');
  assert.ok(
    eligibleIds.includes('WB-ASSEMBLY-2029'),
    'Voter must see West Bengal Assembly 2029'
  );
  assert.ok(
    !eligibleIds.includes('DL-ASSEMBLY-2029'),
    'West Bengal voter must NOT see Delhi Assembly 2029'
  );

  // Initial participation summary: 0/2 completed
  const summary0 = getVoterParticipationSummary(voter, eligible);
  assert.equal(summary0.totalCount, 2);
  assert.equal(summary0.completedCount, 0);
  assert.equal(summary0.label, '0/2 completed');

  // Step 1: Participate in Lok Sabha Election (LS-2029)
  const lsVoteRes = recordSimulatedParticipation({
    voter,
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    selectedCandidateIdOrNota: 'CAND-LS29-WB-KRN-1',
    tallies: talliesMap,
  });
  assert.equal(lsVoteRes.ok, true);
  voter = lsVoteRes.voter;
  talliesMap = lsVoteRes.tallies;

  // Verify 1/2 completed: LS-2029 is VOTED, WB-ASSEMBLY-2029 is still PENDING!
  const summary1 = getVoterParticipationSummary(voter, eligible);
  assert.equal(summary1.completedCount, 1);
  assert.equal(summary1.label, '1/2 completed');
  assert.equal(voter.elections['LS-2029'].status, 'VOTED');
  assert.equal(voter.elections['WB-ASSEMBLY-2029'].status, 'PENDING');

  // Verify ballot secrecy (Rule 17): voter record must NOT contain selectedCandidateIdOrNota or candidateId
  assert.equal(
    'candidateId' in voter.elections['LS-2029'],
    false,
    'Voter participation record must NEVER store chosen candidateId'
  );
  assert.equal(
    'selectedCandidateIdOrNota' in voter.elections['LS-2029'],
    false,
    'Voter participation record must NEVER store selectedCandidateIdOrNota'
  );

  // Prevent duplicate participation in LS-2029
  const duplicateLsRes = recordSimulatedParticipation({
    voter,
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    selectedCandidateIdOrNota: 'CAND-LS29-WB-KRN-2',
    tallies: talliesMap,
  });
  assert.equal(duplicateLsRes.ok, false);

  // Step 2: Participate in West Bengal Assembly Election (WB-ASSEMBLY-2029)
  const wbVoteRes = recordSimulatedParticipation({
    voter,
    electionId: 'WB-ASSEMBLY-2029',
    constituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    selectedCandidateIdOrNota: 'CAND-WB29-KRNU-1',
    tallies: talliesMap,
  });
  assert.equal(wbVoteRes.ok, true);
  voter = wbVoteRes.voter;
  talliesMap = wbVoteRes.tallies;

  // Verify 2/2 completed
  const summary2 = getVoterParticipationSummary(voter, eligible);
  assert.equal(summary2.completedCount, 2);
  assert.equal(summary2.label, '2/2 completed');
  assert.equal(voter.elections['WB-ASSEMBLY-2029'].status, 'VOTED');
});

test('TEST 11 — Candidate Separation Between Parliamentary and Assembly Ballots', () => {
  const lsKrishnanagarCandidates = getCandidatesForElectionConstituency(
    INITIAL_CANDIDATES,
    'LS-2029',
    'WB-PC-KRISHNANAGAR',
    true
  );
  const wbAssemblyCandidates = getCandidatesForElectionConstituency(
    INITIAL_CANDIDATES,
    'WB-ASSEMBLY-2029',
    'WB-AC-KRISHNANAGAR-UTTAR',
    true
  );

  assert.ok(lsKrishnanagarCandidates.length >= 2);
  assert.ok(wbAssemblyCandidates.length >= 2);

  // Ensure zero overlap between Lok Sabha candidates and State Assembly candidates
  for (const cand of lsKrishnanagarCandidates) {
    assert.equal(cand.electionId, 'LS-2029');
    assert.equal(cand.electionType, ELECTION_TYPES.LOK_SABHA);
    assert.equal(cand.constituencyId, 'WB-PC-KRISHNANAGAR');
  }

  for (const cand of wbAssemblyCandidates) {
    assert.equal(cand.electionId, 'WB-ASSEMBLY-2029');
    assert.equal(cand.electionType, ELECTION_TYPES.STATE_ASSEMBLY);
    assert.equal(cand.constituencyId, 'WB-AC-KRISHNANAGAR-UTTAR');
  }

  // Verify candidate validation rejects assigning a candidate to a mismatched constituency type
  const mismatchedCandidate = createCandidateRecord(
    {
      name: 'Invalid Scope Candidate',
      electionId: 'LS-2029',
      electionType: ELECTION_TYPES.LOK_SABHA,
      constituencyId: 'WB-AC-KRISHNANAGAR-UTTAR', // Assembly constituency in a Lok Sabha election!
      partyId: 'PARTY-BJP',
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES,
    INITIAL_PARTIES,
    INITIAL_CANDIDATES
  );
  assert.equal(
    mismatchedCandidate.ok,
    false,
    'Must reject assigning an ASSEMBLY constituency to a LOK_SABHA candidate'
  );
});

test('TEST 12, TEST 13 & TEST 14 — Parties, Results with NOTA, Storage Persistence, and Demo Reset', () => {
  // Verify political parties exist and have symbols
  assert.ok(INITIAL_PARTIES.length >= 6);
  for (const party of INITIAL_PARTIES) {
    assert.ok(party.id);
    assert.ok(party.symbol);
  }

  // Verify NOTA option is always defined
  assert.equal(NOTA_OPTION.id, 'NOTA');
  assert.equal(NOTA_OPTION.candidateId, 'NOTA');

  // Verify storageService persistence and resetAllDemoData
  storageService.setDurableItem(STORAGE_KEYS.FEEDBACK, [
    { id: 'FB-TEST', name: 'Test Citizen', message: 'Great architecture!' },
  ]);
  const storedFeedbacks = storageService.getDurableItem(STORAGE_KEYS.FEEDBACK, []);
  assert.equal(storedFeedbacks.length, 1);

  const resetSnapshot = storageService.resetAllDemoData();
  assert.equal(resetSnapshot.states.length, 36);
  assert.equal(storageService.getDurableItem(STORAGE_KEYS.FEEDBACK, []).length, 1);
});
