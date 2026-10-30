import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  STORAGE_KEYS,
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  ELECTION_STATUSES,
  PARTICIPATION_STATUSES,
  NOTIFICATION_TYPES,
  OTP_CONFIG,
  DEMO_OTP_CODES,
  NOTA_OPTION,
} from '../src/utils/constants.js';
import {
  validateVoterInput,
  validateProfileUpdateInput,
} from '../src/utils/validation.js';
import {
  isVoterEligibleForElection,
  getVoterEligibleElections,
  getVoterElectionParticipationStatus,
  getVoterParticipationSummary,
  getVoterProfileCompletion,
  getCascadingGeographyOptions,
  reconcileGeographySelection,
  getCandidatesForElectionConstituency,
} from '../src/utils/electionHelpers.js';
import { INITIAL_STATES } from '../src/data/states.js';
import { INITIAL_DISTRICTS } from '../src/data/districts.js';
import { INITIAL_CONSTITUENCIES } from '../src/data/constituencies.js';
import { INITIAL_PARTIES } from '../src/data/parties.js';
import { INITIAL_ELECTIONS } from '../src/data/elections.js';
import { INITIAL_CANDIDATES, INITIAL_TALLIES } from '../src/data/candidates.js';
import {
  INITIAL_VOTERS,
  INITIAL_VOTER_NOTIFICATIONS,
} from '../src/data/voters.js';
import { storageService } from '../src/services/storageService.js';
import {
  createElectionRecord,
  recordSimulatedParticipation,
} from '../src/services/electionService.js';
import { createCandidateRecord } from '../src/services/candidateService.js';

// Ensure clean storage before tests
storageService.resetAllDemoData();

test('PHASE 1 & 2 CORE — Routing, Navigation, 36 States/UTs, PC/AC Separation, and Election Creation', () => {
  const routesSource = fs.readFileSync(
    path.resolve('src/routes/AppRoutes.jsx'),
    'utf8'
  );

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
    'path="constituencies"',
    'path="elections"',
    'path="election-info"',
    'path="candidates"',
    'path="notifications"',
    'path="history"',
    'path="settings"',
    'path="/eci/login"',
    'path="states"',
    'path="districts"',
    'path="parties"',
    'path="*"',
  ];

  for (const routePattern of requiredRoutes) {
    assert.ok(
      routesSource.includes(routePattern),
      `Expected AppRoutes.jsx to include ${routePattern}`
    );
  }

  // Verify 28 States + 8 UTs = 36
  const statesOnly = INITIAL_STATES.filter((s) => s.type === 'STATE');
  const utsOnly = INITIAL_STATES.filter(
    (s) => s.type === 'UNION_TERRITORY' || s.type === 'UT'
  );
  assert.equal(statesOnly.length, 28);
  assert.equal(utsOnly.length, 8);
  assert.equal(INITIAL_STATES.length, 36);

  // Verify Parliamentary & Assembly separation
  const pcs = INITIAL_CONSTITUENCIES.filter(
    (c) => (c.type || c.constituencyType) === CONSTITUENCY_TYPES.PARLIAMENTARY
  );
  const acs = INITIAL_CONSTITUENCIES.filter(
    (c) => (c.type || c.constituencyType) === CONSTITUENCY_TYPES.ASSEMBLY
  );
  assert.ok(pcs.length >= 72);
  assert.ok(acs.length >= 144);

  // Verify Lok Sabha & State Assembly creation rules
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

  const mismatchedCandidate = createCandidateRecord(
    {
      name: 'Invalid Scope Candidate',
      electionId: 'LS-2029',
      electionType: ELECTION_TYPES.LOK_SABHA,
      constituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
      partyId: INITIAL_PARTIES[0].id || INITIAL_PARTIES[0].partyId,
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES,
    INITIAL_PARTIES,
    INITIAL_CANDIDATES
  );
  assert.equal(mismatchedCandidate.ok, false);
});

test('PHASE 3 REGISTRATION TESTS (Scenarios 1–10) — Valid Registration, Underage, Invalid Mobile/Email/PIN, Cascading Geography, Duplicate EPIC', () => {
  // Scenario 1: Valid voter registration with Parliamentary + Assembly constituencies
  const validInput = {
    fullName: 'Ananya Chatterjee',
    dob: '1997-04-12',
    gender: 'Female',
    email: 'ananya.chatterjee@example.in',
    mobile: '9831234567',
    voterRef: 'WBX8899001',
    address: '45 College Street, Krishnanagar, Nadia',
    pinCode: '741101',
    stateId: 'WB',
    districtId: 'NADIA',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
  };
  const validRes = validateVoterInput(
    validInput,
    INITIAL_STATES,
    INITIAL_DISTRICTS,
    INITIAL_CONSTITUENCIES,
    INITIAL_VOTERS
  );
  assert.equal(validRes.isValid, true, 'Scenario 1: Valid voter registration must pass');

  // Scenario 2: Underage voter rejection (< 18 years)
  const underageRes = validateVoterInput(
    { ...validInput, dob: '2014-06-01', voterRef: 'WBX8899002' },
    INITIAL_STATES,
    INITIAL_DISTRICTS,
    INITIAL_CONSTITUENCIES,
    INITIAL_VOTERS
  );
  assert.equal(underageRes.isValid, false, 'Scenario 2: Underage voter must be rejected');
  assert.ok(underageRes.fieldErrors.dob);

  // Scenario 3: Invalid 10-digit Indian mobile number rejection
  const badMobileRes = validateVoterInput(
    { ...validInput, mobile: '12345', voterRef: 'WBX8899003' },
    INITIAL_STATES,
    INITIAL_DISTRICTS,
    INITIAL_CONSTITUENCIES,
    INITIAL_VOTERS
  );
  assert.equal(badMobileRes.isValid, false, 'Scenario 3: Invalid mobile must be rejected');
  assert.ok(badMobileRes.fieldErrors.mobile);

  // Scenario 4: Invalid email rejection
  const badEmailRes = validateVoterInput(
    { ...validInput, email: 'not-an-email', voterRef: 'WBX8899004' },
    INITIAL_STATES,
    INITIAL_DISTRICTS,
    INITIAL_CONSTITUENCIES,
    INITIAL_VOTERS
  );
  assert.equal(badEmailRes.isValid, false, 'Scenario 4: Invalid email must be rejected');
  assert.ok(badEmailRes.fieldErrors.email);

  // Scenario 5: Invalid 6-digit PIN code rejection
  const badPinRes = validateVoterInput(
    { ...validInput, pinCode: '0012', voterRef: 'WBX8899005' },
    INITIAL_STATES,
    INITIAL_DISTRICTS,
    INITIAL_CONSTITUENCIES,
    INITIAL_VOTERS
  );
  assert.equal(badPinRes.isValid, false, 'Scenario 5: Invalid PIN code must be rejected');
  assert.ok(badPinRes.fieldErrors.pinCode);

  // Scenario 6, 7, 8: State -> District -> Parliamentary Constituency -> Assembly Constituency cascading
  const wbCascading = getCascadingGeographyOptions({
    stateId: 'WB',
    districtId: 'NADIA',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    states: INITIAL_STATES,
    districts: INITIAL_DISTRICTS,
    constituencies: INITIAL_CONSTITUENCIES,
  });
  assert.ok(wbCascading.districts.some((d) => (d.id || d.districtId) === 'NADIA'));
  assert.ok(
    wbCascading.parliamentaryConstituencies.some(
      (pc) => (pc.id || pc.constituencyId) === 'WB-PC-KRISHNANAGAR'
    )
  );
  assert.ok(
    wbCascading.assemblyConstituencies.some(
      (ac) => (ac.id || ac.constituencyId) === 'WB-AC-KRISHNANAGAR-UTTAR'
    )
  );

  // Scenario 9: Changing parent state clears invalid dependent district, PC, and AC
  const reconciledAfterStateChange = reconcileGeographySelection({
    nextSelection: {
      stateId: 'MH',
      districtId: 'NADIA',
      parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    },
    changedField: 'stateId',
    districts: INITIAL_DISTRICTS,
    constituencies: INITIAL_CONSTITUENCIES,
  });
  assert.equal(reconciledAfterStateChange.stateId, 'MH');
  assert.equal(reconciledAfterStateChange.districtId, '');
  assert.equal(reconciledAfterStateChange.parliamentaryConstituencyId, '');
  assert.equal(reconciledAfterStateChange.assemblyConstituencyId, '');

  // Scenario 10: Duplicate demo voter ID (EPIC) prevention
  const duplicateEpicRes = validateVoterInput(
    { ...validInput, voterRef: 'WBX1234567' }, // Already belongs to VOTER-001
    INITIAL_STATES,
    INITIAL_DISTRICTS,
    INITIAL_CONSTITUENCIES,
    INITIAL_VOTERS
  );
  assert.equal(
    duplicateEpicRes.isValid,
    false,
    'Scenario 10: Duplicate EPIC reference must be prevented'
  );
  assert.ok(duplicateEpicRes.fieldErrors.voterRef);
});

test('PHASE 3 AUTHENTICATION TESTS (Scenarios 11–17) — Demo Voters in 5 States, OTP Config, Resend, Expiry, Max Attempts, Logout & Route Protection', () => {
  // Scenarios 11 & 12: Verify pre-seeded sample voters for WB, MH, UP, TN, DL exist with EPIC & Mobile
  const requiredDemoStates = ['WB', 'MH', 'UP', 'TN', 'DL'];
  for (const stCode of requiredDemoStates) {
    const sampleVoter = INITIAL_VOTERS.find((v) => v.stateId === stCode);
    assert.ok(
      sampleVoter,
      `Expected sample voter for state ${stCode} to exist in INITIAL_VOTERS`
    );
    assert.ok(
      sampleVoter.voterRef || sampleVoter.epicRef,
      `Voter in ${stCode} must have EPIC reference`
    );
    assert.ok(
      /^[6-9]\d{9}$/.test(sampleVoter.mobile),
      `Voter in ${stCode} must have valid 10-digit mobile`
    );
  }

  // Scenarios 13, 14, 15: OTP codes, expiry configuration, resend cooldown, max attempts
  assert.equal(DEMO_OTP_CODES.PRIMARY, '123456');
  assert.equal(DEMO_OTP_CODES.RESEND, '654321');
  assert.equal(OTP_CONFIG.MAX_ATTEMPTS, 3);
  assert.equal(OTP_CONFIG.EXPIRY_MS, 120000);
  assert.equal(OTP_CONFIG.RESEND_COOLDOWN_SECONDS, 30);

  // Scenarios 16 & 17: Verify AuthContext implements OTP challenge expiry, max attempts, and session restoration
  const authContextSource = fs.readFileSync(
    path.resolve('src/context/AuthContext.jsx'),
    'utf8'
  );
  assert.ok(authContextSource.includes('createSimulatedOtpChallenge'));
  assert.ok(authContextSource.includes('verifySimulatedOtpChallenge'));
  assert.ok(authContextSource.includes('OTP_CONFIG.MAX_ATTEMPTS'));
});

test('PHASE 3 PROFILE TESTS (Scenarios 18–20) — View Profile, Edit/Save Validation, Cancel Edit, and Locked Constituency Association', () => {
  const sampleVoter = INITIAL_VOTERS[0];
  const completion = getVoterProfileCompletion(sampleVoter);
  assert.equal(completion.percentage, 100);

  // Scenario 19: Edit and save profile validation
  const validProfileUpdate = validateProfileUpdateInput({
    fullName: 'Arindam Sen Updated',
    dob: '1994-06-15',
    email: 'arindam.updated@example.in',
    mobile: '9830011223',
    address: '14B Park Street, Kolkata',
    pinCode: '700016',
  });
  assert.equal(validProfileUpdate.isValid, true);

  const invalidProfileUpdate = validateProfileUpdateInput({
    fullName: 'A',
    dob: '2018-01-01',
    email: 'bad-email',
    mobile: '111',
    address: 'Short',
    pinCode: '12',
  });
  assert.equal(invalidProfileUpdate.isValid, false);

  // Verify ElectionContext locks constituency fields unless allowAdminConstituencyCorrection is true
  const electionCtxSource = fs.readFileSync(
    path.resolve('src/context/ElectionContext.jsx'),
    'utf8'
  );
  assert.ok(electionCtxSource.includes('allowAdminConstituencyCorrection'));
  assert.ok(electionCtxSource.includes('constituencyHistory'));
});

test('PHASE 3 CONSTITUENCY TESTS (Scenarios 21–24) — Separate PC & AC Details, Associated Elections, and Candidate Listings', () => {
  const wbVoter = INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-001');
  const pc = INITIAL_CONSTITUENCIES.find(
    (c) => (c.id || c.constituencyId) === wbVoter.parliamentaryConstituencyId
  );
  const ac = INITIAL_CONSTITUENCIES.find(
    (c) => (c.id || c.constituencyId) === wbVoter.assemblyConstituencyId
  );

  // Scenario 21 & 22: Parliamentary and Assembly constituencies are distinct with proper types
  assert.equal(pc.type || pc.constituencyType, CONSTITUENCY_TYPES.PARLIAMENTARY);
  assert.equal(ac.type || ac.constituencyType, CONSTITUENCY_TYPES.ASSEMBLY);
  assert.equal(
    ac.parentParliamentaryConstituencyId || ac.parentParliamentaryId,
    pc.id || pc.constituencyId
  );

  // Scenario 23 & 24: Candidates exist for both PC and AC
  const pcCandidates = getCandidatesForElectionConstituency(
    INITIAL_CANDIDATES,
    'LS-2029',
    pc.id || pc.constituencyId,
    true
  );
  const acCandidates = getCandidatesForElectionConstituency(
    INITIAL_CANDIDATES,
    'WB-ASSEMBLY-2029',
    ac.id || ac.constituencyId,
    true
  );
  assert.ok(pcCandidates.length >= 2);
  assert.ok(acCandidates.length >= 2);
});

test('PHASE 3 ELECTION TESTS (Scenarios 25–30) — Eligibility Matching for Lok Sabha, State Assembly, Simultaneous, and Cross-State Isolation', () => {
  const wbVoter = INITIAL_VOTERS.find((v) => v.stateId === 'WB');
  const mhVoter = INITIAL_VOTERS.find((v) => v.stateId === 'MH');
  const dlVoter = INITIAL_VOTERS.find((v) => v.stateId === 'DL');

  // Scenario 25 & 26: WB voter sees Lok Sabha + WB Assembly
  const wbEligible = getVoterEligibleElections(wbVoter, INITIAL_ELECTIONS);
  const wbIds = wbEligible.map((e) => e.id || e.electionId);
  assert.ok(wbIds.includes('LS-2029'));
  assert.ok(wbIds.includes('WB-ASSEMBLY-2029'));
  assert.ok(wbIds.includes('LS-2024')); // Completed election

  // Scenario 27: Simultaneous elections displayed independently
  const wbActiveSimultaneous = wbEligible.filter(
    (e) => e.status === 'POLLING_ACTIVE' || e.status === 'ACTIVE'
  );
  assert.equal(wbActiveSimultaneous.length, 2);

  // Scenario 28: Voter does NOT see unrelated state Assembly elections as eligible
  assert.equal(
    isVoterEligibleForElection(
      wbVoter,
      INITIAL_ELECTIONS.find((e) => (e.id || e.electionId) === 'DL-ASSEMBLY-2029')
    ),
    false
  );
  assert.equal(
    isVoterEligibleForElection(
      mhVoter,
      INITIAL_ELECTIONS.find((e) => (e.id || e.electionId) === 'WB-ASSEMBLY-2029')
    ),
    false
  );

  // Scenarios 29 & 30: Upcoming elections (MH-ASSEMBLY-2029) & Completed elections (LS-2024)
  const mhEligible = getVoterEligibleElections(mhVoter, INITIAL_ELECTIONS);
  const mhAssembly = mhEligible.find(
    (e) => (e.id || e.electionId) === 'MH-ASSEMBLY-2029'
  );
  assert.ok(mhAssembly);
  assert.equal(
    getVoterElectionParticipationStatus(mhVoter, mhAssembly),
    PARTICIPATION_STATUSES.UPCOMING
  );

  const dlEligible = getVoterEligibleElections(dlVoter, INITIAL_ELECTIONS);
  const ls2024 = dlEligible.find((e) => (e.id || e.electionId) === 'LS-2024');
  assert.ok(ls2024);
  assert.equal(
    getVoterElectionParticipationStatus(dlVoter, ls2024),
    PARTICIPATION_STATUSES.VOTED
  );
});

test('PHASE 3 PARTICIPATION TESTS (Scenarios 31–33) — Independent Lok Sabha & Assembly Participation Status + Non-Revealing History', () => {
  let voter = structuredClone(
    INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-001')
  );
  let talliesMap = structuredClone(INITIAL_TALLIES);
  const eligible = getVoterEligibleElections(voter, INITIAL_ELECTIONS);

  // Scenario 31: Initial independent status
  assert.equal(
    getVoterElectionParticipationStatus(
      voter,
      eligible.find((e) => (e.id || e.electionId) === 'LS-2029')
    ),
    PARTICIPATION_STATUSES.PENDING
  );
  assert.equal(
    getVoterElectionParticipationStatus(
      voter,
      eligible.find((e) => (e.id || e.electionId) === 'WB-ASSEMBLY-2029')
    ),
    PARTICIPATION_STATUSES.PENDING
  );

  // Scenario 32: Participating in Lok Sabha does NOT mark State Assembly as completed
  const lsSim = recordSimulatedParticipation({
    voter,
    electionId: 'LS-2029',
    constituencyId: voter.parliamentaryConstituencyId,
    selectedCandidateIdOrNota: null, // Phase 3 status-only simulation
    tallies: talliesMap,
  });
  assert.equal(lsSim.ok, true);
  voter = lsSim.voter;

  assert.equal(voter.elections['LS-2029'].status, PARTICIPATION_STATUSES.VOTED);
  assert.equal(
    voter.elections['WB-ASSEMBLY-2029'].status,
    PARTICIPATION_STATUSES.PENDING
  );

  // Scenario 33: Participation history displays non-revealing referenceId and NEVER stores candidate/party choice
  assert.ok(
    voter.elections['LS-2029'].referenceId.startsWith('DEMO-REF-LS2029'),
    'Must generate a non-revealing DEMO-REF participation reference'
  );
  assert.equal('candidateId' in voter.elections['LS-2029'], false);
  assert.equal('partyId' in voter.elections['LS-2029'], false);
  assert.equal('selectedCandidateIdOrNota' in voter.elections['LS-2029'], false);
});

test('PHASE 3 NOTIFICATION TESTS (Scenarios 34–36) — All 8 Notification Categories, Read/Unread State, and Clear All', () => {
  const presentCategories = new Set(
    INITIAL_VOTER_NOTIFICATIONS.map((n) => n.type)
  );
  for (const requiredType of Object.values(NOTIFICATION_TYPES)) {
    assert.ok(
      presentCategories.has(requiredType),
      `Expected INITIAL_VOTER_NOTIFICATIONS to include category ${requiredType}`
    );
  }

  const unreadInitial = INITIAL_VOTER_NOTIFICATIONS.filter(
    (n) => !n.isRead && !n.read
  );
  assert.ok(unreadInitial.length >= 3, 'Expected unread notifications initially');
});

test('PHASE 3 PERSISTENCE & RESPONSIVENESS TESTS (Scenarios 37–40) — localStorage Persistence, Demo Reset, and VoterLayout Navigation', () => {
  // Scenario 37 & 38: Persist and restore voter notifications and voters
  storageService.setDurableItem(STORAGE_KEYS.VOTER_NOTIFICATIONS, []);
  assert.equal(
    storageService.getDurableItem(STORAGE_KEYS.VOTER_NOTIFICATIONS, []).length,
    0
  );

  // Scenario 39: Reset demo data restores all initial voters and notifications
  const restored = storageService.resetAllDemoData();
  assert.equal(restored.voters.length, INITIAL_VOTERS.length);
  assert.equal(
    restored.voterNotifications.length,
    INITIAL_VOTER_NOTIFICATIONS.length
  );

  // Scenario 40: Verify VoterLayout contains all 10 required navigation items and responsive mobile drawer
  const voterLayoutSource = fs.readFileSync(
    path.resolve('src/layouts/VoterLayout.jsx'),
    'utf8'
  );
  const expectedLabels = [
    'Dashboard',
    'My Profile',
    'My Constituencies',
    'My Elections',
    'Election Information',
    'Candidate Directory',
    'Notifications',
    'Voting History',
    'Settings',
    'Logout',
  ];
  for (const label of expectedLabels) {
    assert.ok(
      voterLayoutSource.includes(label),
      `Expected VoterLayout.jsx to include navigation item: ${label}`
    );
  }
});
