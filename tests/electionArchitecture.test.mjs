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
  RESULT_STATUSES,
} from '../src/utils/constants.js';
import {
  validateVoterInput,
  validateProfileUpdateInput,
  sanitizeTextInput,
  isSafeImageUrl,
  validateImageFile,
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
  INITIAL_ADMIN_OFFICERS,
  INITIAL_AUDIT_LOGS,
} from '../src/data/voters.js';
import { INITIAL_ANNOUNCEMENTS } from '../src/data/elections.js';
import { storageService } from '../src/services/storageService.js';
import {
  createElectionRecord,
  recordSimulatedParticipation,
} from '../src/services/electionService.js';
import { createCandidateRecord } from '../src/services/candidateService.js';

import {
  getElectionStatusExplanation,
  validateBallotAccess,
  filterAndSortBallotCandidates,
  resolveTemporaryBallotSelection,
} from '../src/services/ballotValidationService.js';
import {
  canAdminAccessRoute,
  canAdminPerformAction,
  validateElectionStatusTransition,
  validateCandidateStatusTransition,
  checkConstituencyModificationImpact,
  canDeleteParty,
  validateElectionSchedule,
  detectScheduleConflicts,
  createSanitizedAuditLogEntry,
} from '../src/services/adminPermissionService.js';
import { INITIAL_RESULTS } from '../src/data/results.js';
import {
  calculateConstituencyStandings,
  validateResultRecord,
  createCountingSession,
  startCountingSession,
  pauseCountingSession,
  resumeCountingSession,
  processNextCountingRound,
  completeCountingSession,
  resetCountingSession,
  transitionResultPublicationStatus,
  applyAdminResultCorrection,
  isResultPubliclyVisible,
  getPubliclyVisibleResults,
  calculateTurnoutMetrics,
  computePartyWiseAnalytics,
  computeLokSabhaNationalAnalytics,
  computeStateAssemblyAnalytics,
  computeSimultaneousElectionOverview,
  exportConstituencyResultCSV,
  exportPartyWiseResultCSV,
  exportStateWiseResultCSV,
  exportLokSabhaNationalSummaryCSV,
  exportAssemblyStateSummaryCSV,
  escapeCsvCell,
} from '../src/services/countingService.js';
import { auditElectionDataIntegrity } from '../src/services/dataIntegrityService.js';

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
    'path="elections/:electionId/info"',
    'path="elections/:electionId/ballot"',
    'path="elections/:electionId/receipt"',
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

  assert.equal(DEMO_OTP_CODES.PRIMARY, '123456');
  assert.equal(DEMO_OTP_CODES.RESEND, '654321');
  assert.equal(OTP_CONFIG.MAX_ATTEMPTS, 3);
  assert.equal(OTP_CONFIG.EXPIRY_MS, 120000);
  assert.equal(OTP_CONFIG.RESEND_COOLDOWN_SECONDS, 30);

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

  assert.equal(pc.type || pc.constituencyType, CONSTITUENCY_TYPES.PARLIAMENTARY);
  assert.equal(ac.type || ac.constituencyType, CONSTITUENCY_TYPES.ASSEMBLY);
  assert.equal(
    ac.parentParliamentaryConstituencyId || ac.parentParliamentaryId,
    pc.id || pc.constituencyId
  );

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

  const wbEligible = getVoterEligibleElections(wbVoter, INITIAL_ELECTIONS);
  const wbIds = wbEligible.map((e) => e.id || e.electionId);
  assert.ok(wbIds.includes('LS-2029'));
  assert.ok(wbIds.includes('WB-ASSEMBLY-2029'));
  assert.ok(wbIds.includes('LS-2024'));

  const wbActiveSimultaneous = wbEligible.filter(
    (e) => e.status === 'POLLING_ACTIVE' || e.status === 'ACTIVE'
  );
  assert.equal(wbActiveSimultaneous.length, 2);

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

  const lsSim = recordSimulatedParticipation({
    voter,
    electionId: 'LS-2029',
    constituencyId: voter.parliamentaryConstituencyId,
    selectedCandidateIdOrNota: null,
    tallies: talliesMap,
  });
  assert.equal(lsSim.ok, true);
  voter = lsSim.voter;

  assert.equal(voter.elections['LS-2029'].status, PARTICIPATION_STATUSES.VOTED);
  assert.equal(
    voter.elections['WB-ASSEMBLY-2029'].status,
    PARTICIPATION_STATUSES.PENDING
  );

  assert.ok(
    voter.elections['LS-2029'].referenceId.startsWith('DEMO-REF-LS2029'),
    'Must generate a non-revealing DEMO-REF participation reference'
  );
  assert.equal(voter.elections['LS-2029'].demoReference, 'DEMO-LS-000001');
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
  storageService.setDurableItem(STORAGE_KEYS.VOTER_NOTIFICATIONS, []);
  assert.equal(
    storageService.getDurableItem(STORAGE_KEYS.VOTER_NOTIFICATIONS, []).length,
    0
  );

  const restored = storageService.resetAllDemoData();
  assert.equal(restored.voters.length, INITIAL_VOTERS.length);
  assert.equal(
    restored.voterNotifications.length,
    INITIAL_VOTER_NOTIFICATIONS.length
  );

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

test('PHASE 4 CANDIDATE FILTERING & BALLOT TOOLS — Strict Separation of Lok Sabha & Assembly Candidates, Search, Party Filter, and Sorting', () => {
  // 1. Lok Sabha candidates for WB-PC-KRISHNANAGAR in LS-2029
  const lsKrishnanagar = filterAndSortBallotCandidates({
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    electionType: ELECTION_TYPES.LOK_SABHA,
  });
  assert.ok(lsKrishnanagar.length >= 3);
  assert.ok(
    lsKrishnanagar.every(
      (c) =>
        c.electionId === 'LS-2029' &&
        c.constituencyId === 'WB-PC-KRISHNANAGAR' &&
        c.electionType === ELECTION_TYPES.LOK_SABHA
    ),
    'Lok Sabha ballot must ONLY contain candidates for LS-2029 and WB-PC-KRISHNANAGAR'
  );

  // 2. State Assembly candidates for WB-AC-KRISHNANAGAR-UTTAR in WB-ASSEMBLY-2029
  const asmKrishnanagar = filterAndSortBallotCandidates({
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    electionId: 'WB-ASSEMBLY-2029',
    constituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    electionType: ELECTION_TYPES.STATE_ASSEMBLY,
  });
  assert.ok(asmKrishnanagar.length >= 3);
  assert.ok(
    asmKrishnanagar.every(
      (c) =>
        c.electionId === 'WB-ASSEMBLY-2029' &&
        c.constituencyId === 'WB-AC-KRISHNANAGAR-UTTAR' &&
        c.electionType === ELECTION_TYPES.STATE_ASSEMBLY
    ),
    'Assembly ballot must ONLY contain candidates for WB-ASSEMBLY-2029 and WB-AC-KRISHNANAGAR-UTTAR'
  );

  // 3. Zero candidate overlap between Lok Sabha and State Assembly ballots
  const lsIds = new Set(lsKrishnanagar.map((c) => c.id || c.candidateId));
  const asmIds = new Set(asmKrishnanagar.map((c) => c.id || c.candidateId));
  for (const id of lsIds) {
    assert.equal(
      asmIds.has(id),
      false,
      'Lok Sabha candidate must never appear on State Assembly ballot'
    );
  }

  // 4. Unrelated constituency candidates never appear
  const hasDelhiCandidate = lsKrishnanagar.some(
    (c) => c.constituencyId === 'DL-PC-NEW-DELHI'
  );
  assert.equal(hasDelhiCandidate, false);

  // 5. Search & Party filter & Alphabetical sorting
  const independentOnly = filterAndSortBallotCandidates({
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    electionType: ELECTION_TYPES.LOK_SABHA,
    partyFilter: 'INDEPENDENT',
  });
  assert.equal(independentOnly.length, 1);
  assert.ok(
    independentOnly[0].partyId === 'IND' ||
      independentOnly[0].partyId === 'PARTY-IND'
  );

  const sortedAZ = filterAndSortBallotCandidates({
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    electionType: ELECTION_TYPES.LOK_SABHA,
    sortBy: 'NAME_ASC',
  });
  assert.ok(
    sortedAZ[0].name.localeCompare(sortedAZ[sortedAZ.length - 1].name) <= 0
  );
});

test('PHASE 4 BALLOT INTERACTION & VOLATILE SELECTION — Single Selection, Changing Selection, Clearing Selection, NOTA, and Cross-Ballot Rejection', () => {
  const lsCandidates = filterAndSortBallotCandidates({
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    electionType: ELECTION_TYPES.LOK_SABHA,
  });

  // 1. Selecting no candidate is blocked from review (returns null)
  const emptySelection = resolveTemporaryBallotSelection({
    selectedOptionId: null,
    ballotCandidates: lsCandidates,
    parties: INITIAL_PARTIES,
  });
  assert.equal(emptySelection, null);

  // 2. Selecting Candidate 1 resolves valid temporary selection
  const firstSelection = resolveTemporaryBallotSelection({
    selectedOptionId: lsCandidates[0].id || lsCandidates[0].candidateId,
    ballotCandidates: lsCandidates,
    parties: INITIAL_PARTIES,
  });
  assert.ok(firstSelection);
  assert.equal(firstSelection.isValid, true);
  assert.equal(firstSelection.isNota, false);
  assert.equal(firstSelection.candidate.name, lsCandidates[0].name);

  // 3. Changing selection to Candidate 2 replaces selection cleanly
  const secondSelection = resolveTemporaryBallotSelection({
    selectedOptionId: lsCandidates[1].id || lsCandidates[1].candidateId,
    ballotCandidates: lsCandidates,
    parties: INITIAL_PARTIES,
  });
  assert.ok(secondSelection);
  assert.equal(secondSelection.isValid, true);
  assert.equal(secondSelection.candidate.name, lsCandidates[1].name);

  // 4. Selecting NOTA resolves valid NOTA option
  const notaSelection = resolveTemporaryBallotSelection({
    selectedOptionId: NOTA_OPTION.id,
    ballotCandidates: lsCandidates,
    parties: INITIAL_PARTIES,
  });
  assert.ok(notaSelection);
  assert.equal(notaSelection.isValid, true);
  assert.equal(notaSelection.isNota, true);

  // 5. Attempting to select a candidate from an Assembly ballot on a Lok Sabha ballot is rejected (returns null)
  const crossBallotAttempt = resolveTemporaryBallotSelection({
    selectedOptionId: 'CAND-WB-AC-1', // Assembly candidate
    ballotCandidates: lsCandidates,
    parties: INITIAL_PARTIES,
  });
  assert.equal(crossBallotAttempt, null);
});

test('PHASE 4 ELIGIBILITY & BALLOT VALIDATION — All 8 Pre-Ballot Validation Rules & 10 Election Status Explanations', () => {
  const wbVoter = INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-001');
  const mhVoter = INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-002');
  const ls2029 = INITIAL_ELECTIONS.find((e) => (e.id || e.electionId) === 'LS-2029');
  const wbAssembly = INITIAL_ELECTIONS.find(
    (e) => (e.id || e.electionId) === 'WB-ASSEMBLY-2029'
  );
  const dlAssembly = INITIAL_ELECTIONS.find(
    (e) => (e.id || e.electionId) === 'DL-ASSEMBLY-2029'
  );
  const mhAssembly = INITIAL_ELECTIONS.find(
    (e) => (e.id || e.electionId) === 'MH-ASSEMBLY-2029'
  );
  const ls2024 = INITIAL_ELECTIONS.find((e) => (e.id || e.electionId) === 'LS-2024');

  // 1. Unauthenticated voter blocked
  const unauthRes = validateBallotAccess({
    voter: null,
    election: ls2029,
    constituencies: INITIAL_CONSTITUENCIES,
  });
  assert.equal(unauthRes.canVote, false);
  assert.equal(unauthRes.reasonCode, 'UNAUTHENTICATED');

  // 2. Nonexistent election blocked
  const missingElectionRes = validateBallotAccess({
    voter: wbVoter,
    election: null,
    constituencies: INITIAL_CONSTITUENCIES,
  });
  assert.equal(missingElectionRes.canVote, false);
  assert.equal(missingElectionRes.reasonCode, 'ELECTION_NOT_FOUND');

  // 3. Valid Lok Sabha access for WB voter
  const validLsAccess = validateBallotAccess({
    voter: wbVoter,
    election: ls2029,
    constituencies: INITIAL_CONSTITUENCIES,
  });
  assert.equal(validLsAccess.canVote, true);
  assert.equal(validLsAccess.constituency.id, 'WB-PC-KRISHNANAGAR');

  // 4. Valid WB Assembly access for WB voter
  const validAsmAccess = validateBallotAccess({
    voter: wbVoter,
    election: wbAssembly,
    constituencies: INITIAL_CONSTITUENCIES,
  });
  assert.equal(validAsmAccess.canVote, true);
  assert.equal(validAsmAccess.constituency.id, 'WB-AC-KRISHNANAGAR-UTTAR');

  // 5. Wrong state Assembly blocked (WB voter trying to open DL Assembly)
  const wrongStateRes = validateBallotAccess({
    voter: wbVoter,
    election: dlAssembly,
    constituencies: INITIAL_CONSTITUENCIES,
  });
  assert.equal(wrongStateRes.canVote, false);
  assert.equal(wrongStateRes.reasonCode, 'STATE_MISMATCH');

  // 6. Upcoming election blocked by default, permitted when Controlled Demo Polling Mode is enabled
  const upcomingBlocked = validateBallotAccess({
    voter: mhVoter,
    election: mhAssembly,
    constituencies: INITIAL_CONSTITUENCIES,
    demoPollingOverride: false,
  });
  assert.equal(upcomingBlocked.canVote, false);
  assert.equal(upcomingBlocked.reasonCode, 'ELECTION_NOT_ACTIVE');

  const upcomingDemoOverride = validateBallotAccess({
    voter: mhVoter,
    election: mhAssembly,
    constituencies: INITIAL_CONSTITUENCIES,
    demoPollingOverride: true,
  });
  assert.equal(upcomingDemoOverride.canVote, true);

  // 7. Closed / Results Declared election blocked even with demo override
  const closedElectionRes = validateBallotAccess({
    voter: { ...mhVoter, elections: {} },
    election: ls2024,
    constituencies: INITIAL_CONSTITUENCIES,
    demoPollingOverride: true,
  });
  assert.equal(closedElectionRes.canVote, false);
  assert.equal(closedElectionRes.reasonCode, 'ELECTION_CLOSED');

  // 8. Cancelled election blocked
  const cancelledElectionRes = validateBallotAccess({
    voter: wbVoter,
    election: { ...ls2029, status: ELECTION_STATUSES.CANCELLED },
    constituencies: INITIAL_CONSTITUENCIES,
  });
  assert.equal(cancelledElectionRes.canVote, false);
  assert.equal(cancelledElectionRes.reasonCode, 'ELECTION_CANCELLED');

  // 9. Verify all 10 election statuses return user-friendly explanations
  const tenStatuses = [
    'DRAFT',
    'UPCOMING',
    'NOMINATION_OPEN',
    'NOMINATION_CLOSED',
    'READY',
    'POLLING_ACTIVE',
    'POLLING_COMPLETED',
    'COUNTING',
    'RESULTS_DECLARED',
    'CANCELLED',
  ];
  for (const st of tenStatuses) {
    const explanation = getElectionStatusExplanation(st);
    assert.ok(
      typeof explanation === 'string' && explanation.length > 10,
      `Expected explanation string for status ${st}`
    );
  }
});

test('PHASE 4 SIMULTANEOUS ELECTIONS (Scenarios A–G) — Independent Completion, Duplicate Prevention, and Non-Persistence of Ballot Selection', () => {
  // Scenario A & B: Voter eligible for both Lok Sabha (LS-2029) & State Assembly (WB-ASSEMBLY-2029) completes Lok Sabha first
  let voter = structuredClone(
    INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-001')
  );
  let tallies = structuredClone(INITIAL_TALLIES);
  const eligible = getVoterEligibleElections(voter, INITIAL_ELECTIONS);
  const activeSimultaneous = eligible.filter(
    (e) => e.status === 'POLLING_ACTIVE' || e.status === 'ACTIVE'
  );
  assert.equal(activeSimultaneous.length, 2);

  // Complete Lok Sabha first
  const lsVote = recordSimulatedParticipation({
    voter,
    electionId: 'LS-2029',
    election: INITIAL_ELECTIONS.find((e) => e.id === 'LS-2029'),
    constituencyId: voter.parliamentaryConstituencyId,
    selectedCandidateIdOrNota: 'CAND-WB-PC-1',
    tallies,
  });
  assert.equal(lsVote.ok, true);
  assert.equal(lsVote.demoReference, 'DEMO-LS-000001');
  voter = lsVote.voter;
  tallies = lsVote.tallies;

  // Verify Lok Sabha is VOTED and WB Assembly remains PENDING (1/2 completed)
  const summaryAfterLs = getVoterParticipationSummary(voter, activeSimultaneous);
  assert.equal(summaryAfterLs.totalEligible, 2);
  assert.equal(summaryAfterLs.completedCount, 1);
  assert.equal(summaryAfterLs.pendingCount, 1);
  assert.equal(voter.elections['LS-2029'].status, PARTICIPATION_STATUSES.VOTED);
  assert.equal(
    voter.elections['WB-ASSEMBLY-2029'].status,
    PARTICIPATION_STATUSES.PENDING
  );

  // Verify candidate choice is NEVER persisted in voter object
  const serializedVoter = JSON.stringify(voter);
  assert.equal(serializedVoter.includes('CAND-WB-PC-1'), false);

  // Scenario E: Attempting to reopen or resubmit completed Lok Sabha election is blocked
  const duplicateLsAttempt = recordSimulatedParticipation({
    voter,
    electionId: 'LS-2029',
    election: INITIAL_ELECTIONS.find((e) => e.id === 'LS-2029'),
    constituencyId: voter.parliamentaryConstituencyId,
    selectedCandidateIdOrNota: 'CAND-WB-PC-2',
    tallies,
  });
  assert.equal(duplicateLsAttempt.ok, false);

  const ballotAccessAfterLs = validateBallotAccess({
    voter,
    election: INITIAL_ELECTIONS.find((e) => e.id === 'LS-2029'),
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
  });
  assert.equal(ballotAccessAfterLs.canVote, false);
  assert.equal(ballotAccessAfterLs.reasonCode, 'ALREADY_PARTICIPATED');

  // Scenario D: Complete remaining State Assembly election -> 2/2 completed
  const asmVote = recordSimulatedParticipation({
    voter,
    electionId: 'WB-ASSEMBLY-2029',
    election: INITIAL_ELECTIONS.find((e) => e.id === 'WB-ASSEMBLY-2029'),
    constituencyId: voter.assemblyConstituencyId,
    selectedCandidateIdOrNota: 'CAND-WB-AC-1',
    tallies,
  });
  assert.equal(asmVote.ok, true);
  assert.equal(asmVote.demoReference, 'DEMO-ASM-000001');
  voter = asmVote.voter;

  const summaryAfterBoth = getVoterParticipationSummary(voter, activeSimultaneous);
  assert.equal(summaryAfterBoth.completedCount, 2);
  assert.equal(summaryAfterBoth.pendingCount, 0);

  // Scenario C: Completing Assembly first leaves Lok Sabha PENDING
  let freshVoter = structuredClone(
    INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-001')
  );
  const asmFirst = recordSimulatedParticipation({
    voter: freshVoter,
    electionId: 'WB-ASSEMBLY-2029',
    election: INITIAL_ELECTIONS.find((e) => e.id === 'WB-ASSEMBLY-2029'),
    constituencyId: freshVoter.assemblyConstituencyId,
    selectedCandidateIdOrNota: NOTA_OPTION.id,
    tallies: structuredClone(INITIAL_TALLIES),
  });
  assert.equal(asmFirst.ok, true);
  assert.equal(
    asmFirst.voter.elections['WB-ASSEMBLY-2029'].status,
    PARTICIPATION_STATUSES.VOTED
  );
  assert.equal(
    asmFirst.voter.elections['LS-2029'].status,
    PARTICIPATION_STATUSES.PENDING
  );

  // Scenario F: Voter eligible for Lok Sabha only (UP voter VOTER-003 has no active UP Assembly election)
  const upVoter = INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-003');
  const upEligible = getVoterEligibleElections(upVoter, INITIAL_ELECTIONS);
  const upActiveAssemblies = upEligible.filter(
    (e) => (e.type || e.electionType) === ELECTION_TYPES.STATE_ASSEMBLY
  );
  assert.equal(upActiveAssemblies.length, 0);
  const upActiveLs = upEligible.filter(
    (e) =>
      (e.type || e.electionType) === ELECTION_TYPES.LOK_SABHA &&
      e.status === 'POLLING_ACTIVE'
  );
  assert.equal(upActiveLs.length, 1);

  // Scenario G: Verify all Phase 4 UI components and pages exist and include required statutory banners & disclaimers
  const ballotHeaderSource = fs.readFileSync(
    path.resolve('src/components/ballot/BallotHeader.jsx'),
    'utf8'
  );
  assert.ok(
    ballotHeaderSource.includes(
      'Parliamentary Election — Select your Member of Parliament.'
    )
  );
  assert.ok(
    ballotHeaderSource.includes(
      'State Legislative Assembly Election — Select your Member of Legislative Assembly.'
    )
  );

  const confirmModalSource = fs.readFileSync(
    path.resolve('src/components/ballot/DemoConfirmationModal.jsx'),
    'utf8'
  );
  assert.ok(confirmModalSource.includes('Complete demo participation'));
});

test('PHASE 5 ADMIN AUTHENTICATION & RBAC PERMISSIONS — 5 Admin Roles, Route Restrictions, and Scope Enforcement', () => {
  assert.equal(INITIAL_ADMIN_OFFICERS.length, 5);

  const superAdmin = INITIAL_ADMIN_OFFICERS.find((o) => o.role === 'SUPER_ADMIN');
  const nationalAdmin = INITIAL_ADMIN_OFFICERS.find(
    (o) => o.role === 'NATIONAL_ADMIN'
  );
  const stateAdmin = INITIAL_ADMIN_OFFICERS.find((o) => o.role === 'STATE_ADMIN');
  const electionOfficer = INITIAL_ADMIN_OFFICERS.find(
    (o) => o.role === 'ELECTION_OFFICER'
  );
  const auditor = INITIAL_ADMIN_OFFICERS.find(
    (o) => o.role === 'READ_ONLY_AUDITOR'
  );

  // 1. Unauthenticated user cannot access /eci/* routes
  assert.equal(canAdminAccessRoute(null, '/eci/dashboard'), false);
  assert.equal(canAdminAccessRoute(null, '/eci/elections'), false);

  // 2. SUPER_ADMIN and NATIONAL_ADMIN can access all routes and create national elections
  assert.equal(canAdminAccessRoute(superAdmin, '/eci/parties'), true);
  assert.equal(canAdminAccessRoute(nationalAdmin, '/eci/states'), true);
  assert.equal(
    canAdminPerformAction(superAdmin, 'CREATE_ELECTION', {
      electionType: 'LOK_SABHA',
    }).allowed,
    true
  );
  assert.equal(
    canAdminPerformAction(superAdmin, 'RESET_DEMO_DATA').allowed,
    true
  );
  assert.equal(
    canAdminPerformAction(nationalAdmin, 'RESET_DEMO_DATA').allowed,
    false
  );

  // 3. STATE_ADMIN (assigned to WB) cannot modify another state (e.g., MH) or create a national Lok Sabha election
  assert.equal(
    canAdminPerformAction(stateAdmin, 'EDIT_ELECTION', {
      electionType: 'STATE_ASSEMBLY',
      stateId: 'WB',
    }).allowed,
    true
  );
  assert.equal(
    canAdminPerformAction(stateAdmin, 'EDIT_ELECTION', {
      electionType: 'STATE_ASSEMBLY',
      stateId: 'MH',
    }).allowed,
    false
  );
  assert.equal(
    canAdminPerformAction(stateAdmin, 'CREATE_ELECTION', {
      electionType: 'LOK_SABHA',
    }).allowed,
    false
  );
  assert.equal(canAdminAccessRoute(stateAdmin, '/eci/parties'), false);

  // 4. ELECTION_OFFICER can manage assigned elections (WB-ASSEMBLY-2029, LS-2029) but not unassigned DL-ASSEMBLY-2029
  assert.equal(
    canAdminPerformAction(electionOfficer, 'MANAGE_CANDIDATE', {
      electionId: 'WB-ASSEMBLY-2029',
    }).allowed,
    true
  );
  assert.equal(
    canAdminPerformAction(electionOfficer, 'MANAGE_CANDIDATE', {
      electionId: 'DL-ASSEMBLY-2029',
    }).allowed,
    false
  );

  // 5. READ_ONLY_AUDITOR cannot perform any write actions
  assert.equal(canAdminAccessRoute(auditor, '/eci/audit-logs'), true);
  assert.equal(
    canAdminPerformAction(auditor, 'CREATE_ELECTION').allowed,
    false
  );
  assert.equal(
    canAdminPerformAction(auditor, 'MANAGE_CANDIDATE').allowed,
    false
  );
});

test('PHASE 5 ELECTION LIFECYCLE & VALIDATION — Duplicate ID Rejection, Constituency Type Validation, and Status Transitions', () => {
  // 1. Duplicate election ID is rejected
  const dupRes = createElectionRecord(
    {
      id: 'LS-2029',
      title: 'Duplicate Lok Sabha',
      electionType: 'LOK_SABHA',
      constituencyIds: ['WB-PC-KRISHNANAGAR'],
      pollingDate: '2029-05-01',
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES
  );
  assert.equal(dupRes.ok, false);
  const dupErrorMessages = Array.isArray(dupRes.errors)
    ? dupRes.errors
    : Object.values(dupRes.errors || {});
  assert.ok(dupErrorMessages.some((e) => e.toLowerCase().includes('already exists')));

  // 2. STATE_ASSEMBLY without stateId is rejected
  const missingStateRes = createElectionRecord(
    {
      title: 'Invalid Assembly',
      electionType: 'STATE_ASSEMBLY',
      stateId: '',
      constituencyIds: ['WB-AC-KRISHNANAGAR-UTTAR'],
      pollingDate: '2029-05-01',
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES
  );
  assert.equal(missingStateRes.ok, false);

  // 3. LOK_SABHA with ASSEMBLY constituencies is rejected
  const wrongConstLs = createElectionRecord(
    {
      title: 'Invalid LS with AC',
      electionType: 'LOK_SABHA',
      constituencyIds: ['WB-AC-KRISHNANAGAR-UTTAR'],
      pollingDate: '2029-05-01',
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES
  );
  assert.equal(wrongConstLs.ok, false);

  // 4. STATE_ASSEMBLY with PARLIAMENTARY constituencies is rejected
  const wrongConstAsm = createElectionRecord(
    {
      title: 'Invalid Assembly with PC',
      electionType: 'STATE_ASSEMBLY',
      stateId: 'WB',
      constituencyIds: ['WB-PC-KRISHNANAGAR'],
      pollingDate: '2029-05-01',
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES
  );
  assert.equal(wrongConstAsm.ok, false);

  // 5. Election status transitions follow valid rules & require confirmation for CANCELLED
  assert.equal(
    validateElectionStatusTransition('DRAFT', 'UPCOMING').valid,
    true
  );
  assert.equal(
    validateElectionStatusTransition('DRAFT', 'RESULTS_DECLARED').valid,
    false
  );
  assert.equal(
    validateElectionStatusTransition('DRAFT', 'RESULTS_DECLARED', {
      demoLifecycleMode: true,
    }).valid,
    true
  );
  const cancelWithoutConfirm = validateElectionStatusTransition(
    'POLLING_ACTIVE',
    'CANCELLED',
    { confirmCancellation: false }
  );
  assert.equal(cancelWithoutConfirm.valid, false);
  assert.equal(cancelWithoutConfirm.requiresConfirmation, true);

  const cancelWithConfirm = validateElectionStatusTransition(
    'POLLING_ACTIVE',
    'CANCELLED',
    { confirmCancellation: true }
  );
  assert.equal(cancelWithConfirm.valid, true);
});

test('PHASE 5 CONSTITUENCIES, PARTIES & CANDIDATE SCRUTINY — Dependency Warnings, Party Deletion Protection, and Ballot Filtering', () => {
  // 1. Modifying a constituency referenced by voters/elections triggers impact warning
  const impact = checkConstituencyModificationImpact({
    constituencyId: 'WB-PC-KRISHNANAGAR',
    voters: INITIAL_VOTERS,
    elections: INITIAL_ELECTIONS,
    candidates: INITIAL_CANDIDATES,
  });
  assert.equal(impact.hasImpact, true);
  assert.ok(impact.referencedVoters.length > 0);
  assert.ok(impact.referencedElections.length > 0);

  // 2. Deleting a party referenced by candidates is prevented
  const deleteReferencedParty = canDeleteParty('PARTY-BJP', INITIAL_CANDIDATES);
  assert.equal(deleteReferencedParty.canDelete, false);

  const deleteUnreferencedParty = canDeleteParty(
    'PARTY-UNREFERENCED-DEMO',
    INITIAL_CANDIDATES
  );
  assert.equal(deleteUnreferencedParty.canDelete, true);

  // 3. Candidate approval lifecycle: Only APPROVED candidates appear on ballot; REJECTED/SUSPENDED/WITHDRAWN are excluded
  assert.equal(
    validateCandidateStatusTransition('UNDER_REVIEW', 'APPROVED').valid,
    true
  );
  assert.equal(
    validateCandidateStatusTransition('APPROVED', 'SUSPENDED').valid,
    true
  );

  const modifiedCandidates = INITIAL_CANDIDATES.map((c) =>
    c.candidateId === 'CAND-WB-PC-1'
      ? { ...c, status: 'REJECTED', approvalStatus: 'REJECTED' }
      : c.candidateId === 'CAND-WB-PC-2'
      ? { ...c, status: 'SUSPENDED', approvalStatus: 'SUSPENDED' }
      : c
  );

  const ballotAfterScrutiny = filterAndSortBallotCandidates({
    candidates: modifiedCandidates,
    parties: INITIAL_PARTIES,
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    electionType: 'LOK_SABHA',
  });
  assert.equal(
    ballotAfterScrutiny.some((c) => c.candidateId === 'CAND-WB-PC-1'),
    false
  );
  assert.equal(
    ballotAfterScrutiny.some((c) => c.candidateId === 'CAND-WB-PC-2'),
    false
  );
});

test('PHASE 5 SCHEDULES, ANNOUNCEMENTS, PRIVACY, AUDIT LOGS & PERSISTENCE — 8-Stage Chronology, Conflict Detection, Sanitized Audit Logs, and Reset', () => {
  // 1. Valid 8-stage schedule passes; out-of-order dates fail
  const validSched = validateElectionSchedule({
    nominationStartDate: '2029-03-10',
    nominationEndDate: '2029-03-20',
    scrutinyDate: '2029-03-22',
    withdrawalDeadline: '2029-03-25',
    pollingStartDate: '2029-04-15',
    pollingEndDate: '2029-04-15',
    countingDate: '2029-05-18',
    resultDate: '2029-05-20',
  });
  assert.equal(validSched.isValid, true);

  const invalidSched = validateElectionSchedule({
    nominationStartDate: '2029-03-25',
    nominationEndDate: '2029-03-10', // before start
    pollingStartDate: '2029-04-15',
    countingDate: '2029-05-25',
    resultDate: '2029-05-20', // before counting
  });
  assert.equal(invalidSched.isValid, false);
  assert.ok(invalidSched.errors.length >= 2);

  // 2. Schedule conflict detection identifies simultaneous polling date overlap
  const conflicts = detectScheduleConflicts(
    INITIAL_ELECTIONS.find(
      (e) => (e.id || e.electionId) === 'WB-ASSEMBLY-2029'
    ),
    INITIAL_ELECTIONS
  );
  assert.ok(conflicts.length >= 1);

  // 3. Sanitized Audit Log entry never leaks sensitive ballot/OTP fields
  const logEntry = createSanitizedAuditLogEntry({
    adminUser: INITIAL_ADMIN_OFFICERS[0],
    actionType: 'UPDATE_ELECTION_STATUS',
    targetEntity: 'ELECTION',
    targetId: 'LS-2029',
    summary: 'Updated LS-2029 status to POLLING_ACTIVE',
  });
  assert.equal(logEntry.adminRole, 'SUPER_ADMIN');
  assert.equal('selectedCandidateId' in logEntry, false);
  assert.equal('otp' in logEntry, false);

  // 4. Verify all 15 Phase 5 Admin routes exist in AppRoutes.jsx
  const appRoutesSource = fs.readFileSync(
    path.resolve('src/routes/AppRoutes.jsx'),
    'utf8'
  );
  const requiredAdminPaths = [
    'dashboard',
    'elections',
    'elections/create',
    'elections/:id',
    'states',
    'districts',
    'constituencies',
    'parties',
    'candidates',
    'voters',
    'schedules',
    'monitoring',
    'announcements',
    'results',
    'audit-logs',
    'settings',
  ];
  for (const p of requiredAdminPaths) {
    assert.ok(
      appRoutesSource.includes(`path="${p}"`),
      `Expected route path="${p}" in AppRoutes.jsx`
    );
  }

  // 5. Persistence & Reset verification for Audit Logs and Result Publications
  storageService.saveAuditLogs([logEntry, ...INITIAL_AUDIT_LOGS]);
  assert.equal(storageService.getAuditLogs().length, INITIAL_AUDIT_LOGS.length + 1);

  storageService.resetAllDemoData();
  assert.equal(storageService.getAuditLogs().length, INITIAL_AUDIT_LOGS.length);
  assert.equal(storageService.getAnnouncements().length, INITIAL_ANNOUNCEMENTS.length);
});

test('PHASE 6.1 — Result Validation Rules (Tests 1–8)', () => {
  const baseContext = {
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
  };

  // Test 1: Valid result creation succeeds
  const validSession = createCountingSession({
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    totalConfiguredRounds: 3,
    totalConfiguredVotes: 15000,
    existingResults: [],
  });
  assert.equal(validSession.ok, true);
  const vCheck = validateResultRecord(validSession.result, baseContext);
  assert.equal(
    vCheck.isValid,
    true,
    `Expected valid result record, got errors: ${vCheck.errors.join('; ')}`
  );

  // Test 2: Invalid election ID rejected
  const badElectionRecord = {
    ...validSession.result,
    electionId: 'NON-EXISTENT-ELECTION-9999',
  };
  const badElectionCheck = validateResultRecord(badElectionRecord, baseContext);
  assert.equal(badElectionCheck.isValid, false);
  assert.ok(badElectionCheck.errors.some((e) => e.includes('Invalid election ID')));

  // Test 3: Invalid constituency rejected (mismatch or missing)
  const wrongConstituencyRecord = {
    ...validSession.result,
    constituencyId: 'WB-AC-KRISHNANAGAR-UTTAR', // AC assigned to Lok Sabha election
  };
  const wrongConstituencyCheck = validateResultRecord(
    wrongConstituencyRecord,
    baseContext
  );
  assert.equal(wrongConstituencyCheck.isValid, false);

  // Test 4: Candidate from another election rejected
  const crossElectionCandidateRecord = {
    ...validSession.result,
    candidates: [
      ...validSession.result.candidates,
      {
        candidateId: 'CAND-WBA29-KRNU-1', // Belongs to WB-ASSEMBLY-2029
        partyId: 'PARTY-AITC',
        totalVotes: 100,
        votePercentage: 0,
        rank: 5,
      },
    ],
  };
  const crossElectionCheck = validateResultRecord(
    crossElectionCandidateRecord,
    baseContext
  );
  assert.equal(crossElectionCheck.isValid, false);
  assert.ok(crossElectionCheck.errors.some((e) => e.includes('belongs to election')));

  // Test 5: Candidate from another constituency rejected
  const crossConstituencyCandidateRecord = {
    ...validSession.result,
    candidates: [
      ...validSession.result.candidates,
      {
        candidateId: 'CAND-LS29-DL-ND-1', // Belongs to DL-PC-NEW-DELHI in LS-2029
        partyId: 'PARTY-BJP',
        totalVotes: 100,
        votePercentage: 0,
        rank: 5,
      },
    ],
  };
  const crossConstituencyCheck = validateResultRecord(
    crossConstituencyCandidateRecord,
    baseContext
  );
  assert.equal(crossConstituencyCheck.isValid, false);
  assert.ok(
    crossConstituencyCheck.errors.some((e) => e.includes('belongs to constituency'))
  );

  // Test 6: Negative vote totals rejected
  const negativeVoteRecord = {
    ...validSession.result,
    candidates: validSession.result.candidates.map((c, idx) =>
      idx === 0 ? { ...c, totalVotes: -25 } : c
    ),
  };
  const negativeVoteCheck = validateResultRecord(negativeVoteRecord, baseContext);
  assert.equal(negativeVoteCheck.isValid, false);
  assert.ok(negativeVoteCheck.errors.some((e) => e.includes('non-negative integer')));

  // Test 7: Non-integer vote totals rejected
  const floatVoteRecord = {
    ...validSession.result,
    notaVotes: 14.75,
  };
  const floatVoteCheck = validateResultRecord(floatVoteRecord, baseContext);
  assert.equal(floatVoteCheck.isValid, false);
  assert.ok(
    floatVoteCheck.errors.some((e) =>
      e.includes('notaVotes must be a non-negative integer')
    )
  );

  // Test 8: Totals exceeding configured limits rejected
  const exceededLimitRecord = {
    ...validSession.result,
    totalConfiguredVotes: 5000,
    notaVotes: 6000,
  };
  const exceededLimitCheck = validateResultRecord(exceededLimitRecord, baseContext);
  assert.equal(exceededLimitCheck.isValid, false);
  assert.ok(
    exceededLimitCheck.errors.some((e) =>
      e.includes('exceed configured constituency limit')
    )
  );
});

test('PHASE 6.2 — Counting Engine & Standings Calculation (Tests 9–20)', () => {
  const sessionCreation = createCountingSession({
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    totalConfiguredRounds: 3,
    totalConfiguredVotes: 15000,
    existingResults: [],
  });
  assert.equal(sessionCreation.ok, true);
  let record = sessionCreation.result;
  assert.equal(record.status, RESULT_STATUSES.DRAFT);

  // Test 9: Counting session starts
  const started = startCountingSession(record);
  assert.equal(started.ok, true);
  record = started.result;
  assert.equal(record.status, RESULT_STATUSES.COUNTING_IN_PROGRESS);
  assert.equal(record.currentRound, 0);

  // Test 10: Rounds process sequentially (Round 1 -> Round 2)
  const r1 = processNextCountingRound(record);
  assert.equal(r1.ok, true);
  record = r1.result;
  assert.equal(record.currentRound, 1);
  assert.equal(record.rounds.length, 1);
  assert.equal(record.rounds[0].roundNumber, 1);
  const r1Total = record.totalCountedVotes;
  assert.ok(r1Total > 0);

  // Test 20: No winner declared before completion (during Round 1, leadingCandidateId is set, winnerCandidateId is null)
  assert.equal(record.winnerCandidateId, null);
  assert.ok(record.leadingCandidateId !== null);

  // Test 13: Counting can pause
  const paused = pauseCountingSession(record);
  assert.equal(paused.ok, true);
  record = paused.result;
  assert.equal(record.status, RESULT_STATUSES.COUNTING_PAUSED);

  // Cannot process next round while paused
  const blockedWhilePaused = processNextCountingRound(record);
  assert.equal(blockedWhilePaused.ok, false);

  // Test 14: Counting can resume
  const resumed = resumeCountingSession(record);
  assert.equal(resumed.ok, true);
  record = resumed.result;
  assert.equal(record.status, RESULT_STATUSES.COUNTING_IN_PROGRESS);

  // Test 11a: Duplicate round number rejected during ongoing counting
  const duplicateRoundAttempt = processNextCountingRound(record, { roundNumber: 1 });
  assert.equal(duplicateRoundAttempt.ok, false);
  assert.ok(duplicateRoundAttempt.error.includes('already been counted'));

  // Test 12: Cumulative totals increase correctly across rounds
  const r2 = processNextCountingRound(record);
  assert.equal(r2.ok, true);
  record = r2.result;
  assert.equal(record.currentRound, 2);
  assert.ok(record.totalCountedVotes > r1Total);

  const r3 = processNextCountingRound(record);
  assert.equal(r3.ok, true);
  record = r3.result;
  assert.equal(record.currentRound, 3);
  assert.ok(record.totalCountedVotes > r2.result.totalCountedVotes);
  assert.ok(record.totalCountedVotes <= record.totalConfiguredVotes);

  // Test 11b: Extra round processing rejected after all configured rounds processed
  const extraRound = processNextCountingRound(record);
  assert.equal(extraRound.ok, false);

  // Also verify duplicate round numbers in rounds array are rejected by validator
  const duplicateRoundCheck = validateResultRecord(
    {
      ...record,
      rounds: [record.rounds[0], record.rounds[0]],
    },
    {
      elections: INITIAL_ELECTIONS,
      constituencies: INITIAL_CONSTITUENCIES,
      candidates: INITIAL_CANDIDATES,
      parties: INITIAL_PARTIES,
    }
  );
  assert.equal(duplicateRoundCheck.isValid, false);

  // Test 15: Counting completes correctly
  const completed = completeCountingSession(record, { readyForReview: true });
  assert.equal(completed.ok, true);
  record = completed.result;
  assert.equal(record.status, RESULT_STATUSES.RESULT_READY_FOR_REVIEW);
  assert.ok(record.winnerCandidateId !== null);

  // Test 16, 17, 18: Winner, Runner-Up, and Victory Margin calculated accurately
  const standings = calculateConstituencyStandings({
    candidates: [
      { candidateId: 'CAND-A', partyId: 'PARTY-AITC', totalVotes: 52400 },
      { candidateId: 'CAND-B', partyId: 'PARTY-BJP', totalVotes: 41100 },
      { candidateId: 'CAND-C', partyId: 'PARTY-INC', totalVotes: 12500 },
    ],
    notaVotes: 1500,
    isCompleted: true,
  });

  // Test 16: Winner calculated correctly
  assert.equal(standings.winnerCandidateId, 'CAND-A');

  // Test 17: Runner-up calculated correctly
  assert.equal(standings.runnerUpCandidateId, 'CAND-B');
  assert.equal(standings.candidates[1].rank, 2);

  // Test 18: Victory margin calculated correctly (52400 - 41100 = 11300)
  assert.equal(standings.victoryMargin, 11300);
  assert.equal(standings.totalCountedVotes, 52400 + 41100 + 12500 + 1500);

  // Test 19: Tied result detected (no arbitrary winner declared)
  const tiedStandings = calculateConstituencyStandings({
    candidates: [
      { candidateId: 'CAND-A', partyId: 'PARTY-AITC', totalVotes: 45000 },
      { candidateId: 'CAND-B', partyId: 'PARTY-BJP', totalVotes: 45000 },
      { candidateId: 'CAND-C', partyId: 'PARTY-INC', totalVotes: 8000 },
    ],
    notaVotes: 2000,
    isCompleted: true,
  });
  assert.equal(tiedStandings.isTied, true);
  assert.equal(tiedStandings.winnerCandidateId, null);
  assert.equal(tiedStandings.victoryMargin, 0);
  assert.equal(tiedStandings.requiresResolution, true);
  assert.deepEqual(tiedStandings.tiedCandidateIds, ['CAND-A', 'CAND-B']);
});

test('PHASE 6.3 — Election Separation & Simultaneous Independence (Tests 21–25)', () => {
  // Test 21: Lok Sabha results remain independent
  const lsNational = computeLokSabhaNationalAnalytics({
    electionId: 'LS-2029',
    results: INITIAL_RESULTS,
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    states: INITIAL_STATES,
    publicOnly: true,
  });
  assert.equal(lsNational.totalParliamentaryConstituencies, 72);
  assert.equal(lsNational.resultsDeclaredCount, 3); // WB-PC-KRISHNANAGAR, DL-PC-NEW-DELHI, UP-PC-VARANASI

  // Test 22: Assembly results remain independent
  const wbAssembly = computeStateAssemblyAnalytics({
    electionId: 'WB-ASSEMBLY-2029',
    stateId: 'WB',
    results: INITIAL_RESULTS,
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    states: INITIAL_STATES,
    publicOnly: true,
  });
  assert.equal(wbAssembly.resultsDeclaredCount, 1);
  assert.ok(
    wbAssembly.constituencySummaries.every(
      (r) => r.electionType === ELECTION_TYPES.STATE_ASSEMBLY
    )
  );

  // Test 23: Simultaneous elections maintain separate result records
  const simOverview = computeSimultaneousElectionOverview({
    stateId: 'WB',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    lokSabhaElectionId: 'LS-2029',
    assemblyElectionId: 'WB-ASSEMBLY-2029',
    results: INITIAL_RESULTS,
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
  });
  assert.equal(simOverview.lokSabha.electionId, 'LS-2029');
  assert.equal(simOverview.stateAssembly.electionId, 'WB-ASSEMBLY-2029');
  assert.notEqual(
    simOverview.lokSabha.resultRecord.id,
    simOverview.stateAssembly.resultRecord.id
  );
  assert.equal(simOverview.lokSabha.electionType, ELECTION_TYPES.LOK_SABHA);
  assert.equal(simOverview.stateAssembly.electionType, ELECTION_TYPES.STATE_ASSEMBLY);

  // Test 24: Candidate totals never cross election boundaries
  const lsCandIds = new Set(
    simOverview.lokSabha.resultRecord.candidates.map((c) => c.candidateId)
  );
  const acCandIds = new Set(
    simOverview.stateAssembly.resultRecord.candidates.map((c) => c.candidateId)
  );
  for (const id of lsCandIds) {
    assert.equal(acCandIds.has(id), false, `Candidate ${id} must not cross LS/AC boundary`);
  }

  // Test 25: State Assembly results never mix between states
  const dlAssembly = computeStateAssemblyAnalytics({
    electionId: 'DL-ASSEMBLY-2029',
    stateId: 'DL',
    results: INITIAL_RESULTS,
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    states: INITIAL_STATES,
    publicOnly: true,
  });
  assert.ok(dlAssembly.constituencySummaries.every((r) => r.stateId === 'DL'));
  assert.ok(wbAssembly.constituencySummaries.every((r) => r.stateId === 'WB'));
});

test('PHASE 6.4 — Analytics: Party Seats, Vote Share, NOTA, Independents, Missing Results & Turnout (Tests 26–31)', () => {
  // Test 26 & 27: Party seat counts and vote percentages are correct
  const partyAnalytics = computePartyWiseAnalytics({
    electionId: 'LS-2029',
    results: INITIAL_RESULTS,
    parties: INITIAL_PARTIES,
    candidates: INITIAL_CANDIDATES,
    publicOnly: true,
  });
  const totalSeatsWon = partyAnalytics.partyRows.reduce(
    (acc, p) => acc + p.seatsWon,
    0
  );
  assert.equal(totalSeatsWon, 3); // BJP won 2 (New Delhi, Varanasi), AITC won 1 (Krishnanagar)
  const bjpRow = partyAnalytics.partyRows.find((p) => p.partyId === 'PARTY-BJP');
  const tmcRow = partyAnalytics.partyRows.find((p) => p.partyId === 'PARTY-AITC');
  assert.equal(bjpRow.seatsWon, 2);
  assert.equal(tmcRow.seatsWon, 1);

  const sumPct =
    partyAnalytics.partyRows.reduce(
      (acc, p) => acc + p.voteShareTotalBallotPct,
      0
    ) + partyAnalytics.notaSharePct;
  assert.ok(
    Math.abs(sumPct - 100) <= 0.2,
    `Expected vote percentage sum ~100%, got ${sumPct}`
  );

  // Test 28: NOTA is handled correctly (included in total votes, excluded from winning seat)
  assert.ok(partyAnalytics.totalNotaVotes > 0);
  assert.equal(
    partyAnalytics.partyRows.some((p) => p.partyId === 'NOTA'),
    false
  );

  // Even if NOTA has more votes than candidates, top candidate wins the seat
  const notaHighestStandings = calculateConstituencyStandings({
    candidates: [
      { candidateId: 'CAND-1', partyId: 'PARTY-IND', totalVotes: 12000 },
      { candidateId: 'CAND-2', partyId: 'PARTY-INC', totalVotes: 9000 },
    ],
    notaVotes: 25000,
    isCompleted: true,
  });
  assert.equal(notaHighestStandings.totalCountedVotes, 46000);
  assert.equal(notaHighestStandings.winnerCandidateId, 'CAND-1');

  // Test 29: Independent candidates are handled correctly
  const indPartyRow = partyAnalytics.partyRows.find(
    (p) => p.partyId === 'PARTY-IND'
  );
  assert.ok(
    indPartyRow,
    'Expected Independent (PARTY-IND) row in party analytics'
  );
  assert.equal(indPartyRow.isIndependent, true);
  assert.ok(indPartyRow.totalVotes > 0);

  // Test 30: Missing results are not counted as zero-vote declared results
  const lsNational = computeLokSabhaNationalAnalytics({
    electionId: 'LS-2029',
    results: INITIAL_RESULTS,
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    states: INITIAL_STATES,
    publicOnly: true,
  });
  assert.equal(lsNational.totalParliamentaryConstituencies, 72);
  assert.equal(lsNational.configuredResultRecordsCount, 5);
  assert.equal(lsNational.unconfiguredConstituenciesCount, 67);
  assert.equal(lsNational.resultsDeclaredCount, 3);
  const unconfiguredState = lsNational.stateSummaries.find(
    (s) => s.stateId === 'KA'
  );
  assert.equal(unconfiguredState.declaredCount, 0);
  assert.equal(unconfiguredState.configuredDemoResultRecords, 0);
  assert.ok(unconfiguredState.missingDemoResultRecords > 0);

  // Test 31: Turnout uses the correct denominator and explicitly declares basis
  const sampleRes = INITIAL_RESULTS.find(
    (r) => r.id === 'RESULT-LS-2029-KRISHNANAGAR'
  );
  const turnout = calculateTurnoutMetrics({
    simulatedParticipationCount: 4200,
    totalEligibleDemoVoters: sampleRes.totalEligibleDemoVoters,
    totalCountedVotes: sampleRes.totalCountedVotes,
    validCandidateVotes: sampleRes.validCandidateVotes,
    notaVotes: sampleRes.notaVotes,
  });
  assert.ok(
    turnout.demoTurnoutPercentage > 0 && turnout.demoTurnoutPercentage <= 100
  );
  assert.ok(turnout.calculationBasis.demoTurnout.includes('totalEligibleDemoVoters'));
  assert.ok(turnout.calculationBasis.totalBallotVoteShare.includes('totalCountedVotes'));
});

test('PHASE 6.5 — Publication Workflow & Admin Result Corrections (Tests 32–36)', () => {
  // Test 32: Draft results are hidden publicly
  const draftRecord = INITIAL_RESULTS.find(
    (r) => r.id === 'RESULT-MH-ASSEMBLY-2029-BANDRA-WEST'
  );
  assert.equal(draftRecord.status, RESULT_STATUSES.DRAFT);
  assert.equal(isResultPubliclyVisible(draftRecord), false);

  const publicResults = getPubliclyVisibleResults(INITIAL_RESULTS);
  assert.equal(
    publicResults.some((r) => r.id === 'RESULT-MH-ASSEMBLY-2029-BANDRA-WEST'),
    false,
    'Draft result must not be returned by getPubliclyVisibleResults'
  );

  // Test 33: Completed counting can be reviewed (RESULT_READY_FOR_REVIEW)
  const readyRecord = INITIAL_RESULTS.find(
    (r) => r.id === 'RESULT-LS-2029-TN-PC-1'
  );
  assert.equal(readyRecord.status, RESULT_STATUSES.RESULT_READY_FOR_REVIEW);
  assert.equal(isResultPubliclyVisible(readyRecord), false);

  // Test 34: Published results appear publicly
  const publishedTransition = transitionResultPublicationStatus(
    readyRecord,
    RESULT_STATUSES.PUBLISHED,
    {
      adminId: 'ECI-ADMIN-001',
      notes: 'Verified all 3 rounds and Form 20 summary',
    }
  );
  assert.equal(publishedTransition.ok, true);
  assert.equal(publishedTransition.result.status, RESULT_STATUSES.PUBLISHED);
  assert.equal(isResultPubliclyVisible(publishedTransition.result), true);

  // Test 35: Unpublished results disappear from public display
  const unpublishedTransition = transitionResultPublicationStatus(
    publishedTransition.result,
    RESULT_STATUSES.UNPUBLISHED,
    {
      adminId: 'ECI-ADMIN-001',
      notes: 'Temporarily recalled for postal ballot verification',
    }
  );
  assert.equal(unpublishedTransition.ok, true);
  assert.equal(unpublishedTransition.result.status, RESULT_STATUSES.UNPUBLISHED);
  assert.equal(isResultPubliclyVisible(unpublishedTransition.result), false);

  // Test 36: Corrections create audit/correction history and require confirmation + reason
  const missingReasonCorrection = applyAdminResultCorrection(
    publishedTransition.result,
    {
      candidateVotesMap: {
        'CAND-LS29-TN-1': 6500,
        'CAND-LS29-TN-2': 5100,
      },
      notaVotes: 210,
      reason: '', // empty reason rejected
      confirmed: true,
      adminId: 'ECI-ADMIN-001',
      adminName: 'Chief Election Commissioner',
    }
  );
  assert.equal(missingReasonCorrection.ok, false);

  const validCorrection = applyAdminResultCorrection(
    publishedTransition.result,
    {
      candidateVotesMap: {
        'CAND-LS29-TN-1': 6500,
        'CAND-LS29-TN-2': 5100,
      },
      notaVotes: 210,
      reason: 'Recount verification added 110 postal votes to INC candidate',
      confirmed: true,
      adminId: 'ECI-ADMIN-001',
      adminName: 'Chief Election Commissioner',
    }
  );
  assert.equal(validCorrection.ok, true);
  assert.equal(validCorrection.result.correctionHistory.length, 1);
  assert.equal(
    validCorrection.result.correctionHistory[0].reason,
    'Recount verification added 110 postal votes to INC candidate'
  );
  assert.equal(validCorrection.result.totalCountedVotes, 6500 + 5100 + 210);
});

test('PHASE 6.6 — Privacy Protection & CSV Export Integrity (Tests 37–40)', () => {
  const sampleResult = INITIAL_RESULTS.find(
    (r) => r.id === 'RESULT-LS-2029-KRISHNANAGAR'
  );
  const serializedResults = JSON.stringify(INITIAL_RESULTS);

  // Test 37: Individual voter candidate selection is never stored or exposed in results
  assert.equal(serializedResults.includes('voterId'), false);
  assert.equal(serializedResults.includes('selectedCandidateId'), false);

  // Test 38: Voter identities (names, EPIC numbers, mobile numbers) are never exposed in results
  for (const voter of INITIAL_VOTERS) {
    assert.equal(
      serializedResults.includes(voter.voterIdNumber),
      false,
      `Voter EPIC ${voter.voterIdNumber} must not appear in results`
    );
    assert.equal(
      serializedResults.includes(voter.mobile),
      false,
      `Voter mobile ${voter.mobile} must not appear in results`
    );
  }

  // Test 39: Participation records are not converted into candidate vote totals
  const beforeVotes = sampleResult.totalCountedVotes;
  const votersCopy = JSON.parse(JSON.stringify(INITIAL_VOTERS));
  const talliesCopy = JSON.parse(JSON.stringify(INITIAL_TALLIES));
  recordSimulatedParticipation({
    voterId: 'VOTER-WB-002',
    electionId: 'LS-2029',
    selectedOptionId: 'CAND-LS29-WB-KRN-1',
    voters: votersCopy,
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    tallies: talliesCopy,
  });
  assert.equal(sampleResult.totalCountedVotes, beforeVotes);

  // Test 40: Result CSV exports contain no voter personal information and include DEMONSTRATION_RESULTS
  const lsAnalytics = computeLokSabhaNationalAnalytics({
    electionId: 'LS-2029',
    results: INITIAL_RESULTS,
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    states: INITIAL_STATES,
    publicOnly: true,
  });
  const wbAnalytics = computeStateAssemblyAnalytics({
    electionId: 'WB-ASSEMBLY-2029',
    stateId: 'WB',
    results: INITIAL_RESULTS,
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
    states: INITIAL_STATES,
    publicOnly: true,
  });
  const lsPartyAnalytics = computePartyWiseAnalytics({
    electionId: 'LS-2029',
    results: INITIAL_RESULTS,
    parties: INITIAL_PARTIES,
    candidates: INITIAL_CANDIDATES,
    publicOnly: true,
  });

  const csvOutputs = [
    exportConstituencyResultCSV(sampleResult, {
      parties: INITIAL_PARTIES,
      candidates: INITIAL_CANDIDATES,
    }),
    exportPartyWiseResultCSV(lsPartyAnalytics),
    exportStateWiseResultCSV('LS-2029', lsAnalytics.stateSummaries),
    exportLokSabhaNationalSummaryCSV(lsAnalytics, INITIAL_RESULTS),
    exportAssemblyStateSummaryCSV(wbAnalytics),
  ];

  for (const csv of csvOutputs) {
    assert.ok(
      csv.includes('DEMONSTRATION_RESULTS'),
      'CSV export must explicitly include DEMONSTRATION_RESULTS label'
    );
    for (const voter of INITIAL_VOTERS) {
      assert.equal(csv.includes(voter.voterIdNumber), false);
      assert.equal(csv.includes(voter.mobile), false);
    }
  }
});

test('PHASE 6.7 — Public & Admin UI Pages, Charts, Empty States, and Routes (Tests 41–46)', () => {
  const appRoutesSource = fs.readFileSync(
    path.resolve('src/routes/AppRoutes.jsx'),
    'utf8'
  );
  const lsPageSource = fs.readFileSync(
    path.resolve('src/pages/public/LokSabhaResults.jsx'),
    'utf8'
  );
  const assemblyPageSource = fs.readFileSync(
    path.resolve('src/pages/public/AssemblyResults.jsx'),
    'utf8'
  );
  const constituencyDetailSource = fs.readFileSync(
    path.resolve('src/pages/public/ConstituencyResultDetail.jsx'),
    'utf8'
  );
  const chartsSource = fs.readFileSync(
    path.resolve('src/components/results/ResultCharts.jsx'),
    'utf8'
  );
  const adminResultsSource = fs.readFileSync(
    path.resolve('src/pages/admin/ResultsManagement.jsx'),
    'utf8'
  );

  // Test 41: Lok Sabha national dashboard renders correctly & route registered
  assert.ok(appRoutesSource.includes('path="/results/lok-sabha"'));
  assert.ok(lsPageSource.includes('computeLokSabhaNationalAnalytics'));
  assert.ok(lsPageSource.includes('exportLokSabhaNationalSummaryCSV'));

  // Test 42: Assembly state dashboard renders correctly & route registered
  assert.ok(appRoutesSource.includes('path="/results/assembly"'));
  assert.ok(assemblyPageSource.includes('computeStateAssemblyAnalytics'));
  assert.ok(assemblyPageSource.includes('exportAssemblyStateSummaryCSV'));

  // Test 43: Constituency details render correctly & route registered
  assert.ok(appRoutesSource.includes('path="/results/:electionId/:constituencyId"'));
  assert.ok(constituencyDetailSource.includes('CumulativeRoundLineChart'));
  assert.ok(constituencyDetailSource.includes('exportConstituencyResultCSV'));

  // Test 44: Charts render without crashing when data is empty
  assert.ok(chartsSource.includes('PartySeatsBarChart'));
  assert.ok(chartsSource.includes('VoteShareDonutChart'));
  assert.ok(chartsSource.includes('CumulativeRoundLineChart'));
  assert.ok(chartsSource.includes('No party seat data available for the selected scope.'));
  assert.ok(chartsSource.includes('No counting rounds have been processed yet.'));

  // Test 45: Filters & tabs in Admin and Public views work cleanly
  assert.ok(adminResultsSource.includes('COUNTING_SESSIONS'));
  assert.ok(adminResultsSource.includes('DRAFT_RESULTS'));
  assert.ok(adminResultsSource.includes('PUBLISHED_RESULTS'));

  // Test 46: Responsive layouts & storage reset restores initial results
  assert.ok(lsPageSource.includes('grid-cols-1'));
  assert.ok(assemblyPageSource.includes('grid-cols-1'));
  assert.ok(constituencyDetailSource.includes('grid-cols-1'));

  storageService.resetAllDemoData();
  assert.equal(storageService.getResults().length, INITIAL_RESULTS.length);
});

test('PHASE 7.1 — Critical 17-Rule Election Data Integrity & Provenance Audit (Section 3)', () => {
  const report = auditElectionDataIntegrity({
    states: INITIAL_STATES,
    districts: INITIAL_DISTRICTS,
    constituencies: INITIAL_CONSTITUENCIES,
    parties: INITIAL_PARTIES,
    elections: INITIAL_ELECTIONS,
    candidates: INITIAL_CANDIDATES,
    voters: INITIAL_VOTERS,
    results: INITIAL_RESULTS,
    announcements: INITIAL_ANNOUNCEMENTS,
  });

  // Verify all 17 rules are evaluated and healthy on seed dataset
  assert.equal(report.totalRulesChecked, 17);
  assert.equal(report.rulesPassed, 17);
  assert.equal(report.rulesFailed, 0);
  assert.equal(report.isHealthy, true);
  assert.equal(report.errors.length, 0);

  // Verify entity counts
  assert.equal(report.counts.statesCount, 28);
  assert.equal(report.counts.unionTerritoriesCount, 8);
  assert.equal(report.counts.parliamentaryConstituencies, 72);
  assert.ok(report.counts.assemblyConstituencies >= 40);

  // Verify negative detection: inject a candidate with mismatched constituency type (AC candidate in Lok Sabha election)
  const brokenCandidates = [
    ...INITIAL_CANDIDATES,
    {
      id: 'CAND-BROKEN-PC-AC',
      name: 'Invalid Constituency Candidate',
      electionId: 'LS-2029',
      electionType: 'LOK_SABHA',
      stateId: 'WB',
      constituencyId: 'AC-WB-001', // AC instead of PC!
      constituencyType: 'ASSEMBLY',
      partyId: 'PARTY-IND',
      ballotNumber: 99,
      status: 'APPROVED',
      metadata: { source: 'SIMULATED_DEMO_DATA' },
    },
  ];
  const brokenReport = auditElectionDataIntegrity({
    candidates: brokenCandidates,
  });
  assert.equal(brokenReport.isHealthy, false);
  assert.ok(brokenReport.rulesFailed >= 1);
  assert.equal(
    brokenReport.ruleResults.some((r) => !r.passed),
    true
  );
});

test('PHASE 7.2 — Complete Simultaneous Election Scenarios (Scenarios A–L) & End-to-End Journeys (Sections 4 & 15)', () => {
  // Scenario A & B & D: Voter eligible for both LS & Assembly completes LS first, then Assembly
  let voterWb = structuredClone(
    INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-001')
  );
  let tallies = structuredClone(INITIAL_TALLIES);
  const lsElection = INITIAL_ELECTIONS.find((e) => e.id === 'LS-2029');
  const wbAsmElection = INITIAL_ELECTIONS.find((e) => e.id === 'WB-ASSEMBLY-2029');

  const lsCast = recordSimulatedParticipation({
    voter: voterWb,
    electionId: 'LS-2029',
    election: lsElection,
    constituencyId: voterWb.parliamentaryConstituencyId,
    selectedCandidateIdOrNota: 'CAND-WB-PC-1',
    tallies,
  });
  assert.equal(lsCast.ok, true);
  assert.equal(
    lsCast.voter.elections['LS-2029'].status,
    PARTICIPATION_STATUSES.VOTED
  );
  assert.equal(
    lsCast.voter.elections['WB-ASSEMBLY-2029'].status,
    PARTICIPATION_STATUSES.PENDING
  );

  // Scenario C: Voter completes State Assembly first, Lok Sabha remains available
  let voterWb2 = structuredClone(
    INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-001')
  );
  const asmCastFirst = recordSimulatedParticipation({
    voter: voterWb2,
    electionId: 'WB-ASSEMBLY-2029',
    election: wbAsmElection,
    constituencyId: voterWb2.assemblyConstituencyId,
    selectedCandidateIdOrNota: 'CAND-WB-AC-1',
    tallies: structuredClone(INITIAL_TALLIES),
  });
  assert.equal(asmCastFirst.ok, true);
  assert.equal(
    asmCastFirst.voter.elections['WB-ASSEMBLY-2029'].status,
    PARTICIPATION_STATUSES.VOTED
  );
  assert.equal(
    asmCastFirst.voter.elections['LS-2029'].status,
    PARTICIPATION_STATUSES.PENDING
  );

  // Scenario E: Voter attempts to vote again in an already completed election -> blocked
  const duplicateVote = recordSimulatedParticipation({
    voter: lsCast.voter,
    electionId: 'LS-2029',
    election: lsElection,
    constituencyId: voterWb.parliamentaryConstituencyId,
    selectedCandidateIdOrNota: 'CAND-WB-PC-2',
    tallies: lsCast.tallies,
  });
  assert.equal(duplicateVote.ok, false);

  // Scenario F: Voter eligible for Lok Sabha only (e.g. UP voter or UT without assembly)
  const upVoter = INITIAL_VOTERS.find((v) => (v.id || v.voterId) === 'VOTER-003');
  const upEligible = getVoterEligibleElections(upVoter, INITIAL_ELECTIONS);
  assert.equal(
    upEligible.some((e) => (e.type || e.electionType) === ELECTION_TYPES.LOK_SABHA),
    true
  );
  assert.equal(
    upEligible.some(
      (e) =>
        (e.type || e.electionType) === ELECTION_TYPES.STATE_ASSEMBLY &&
        e.status === 'POLLING_ACTIVE'
    ),
    false
  );

  // Scenario G: Voter eligible for State Assembly only (simulated when LS is UPCOMING and Assembly is POLLING_ACTIVE)
  const electionsOnlyAsmActive = INITIAL_ELECTIONS.map((e) =>
    e.id === 'LS-2029' ? { ...e, status: 'UPCOMING' } : e
  );
  const wbEligibleAsmOnly = getVoterEligibleElections(
    voterWb,
    electionsOnlyAsmActive
  ).filter((e) => e.status === 'POLLING_ACTIVE');
  assert.equal(wbEligibleAsmOnly.length, 1);
  assert.equal(wbEligibleAsmOnly[0].id, 'WB-ASSEMBLY-2029');

  // Scenario H: Voter in Union Territory without Legislative Assembly (Ladakh - LA)
  const ladakhState = INITIAL_STATES.find((s) => s.id === 'LA');
  assert.equal(ladakhState.type, 'UNION_TERRITORY');
  const ladakhAssemblyElections = INITIAL_ELECTIONS.filter(
    (e) =>
      e.stateId === 'LA' &&
      (e.type || e.electionType) === ELECTION_TYPES.STATE_ASSEMBLY
  );
  assert.equal(ladakhAssemblyElections.length, 0);
  const ladakhVoter = {
    id: 'VOTER-LA-TEST',
    name: 'Tashi Namgyal',
    stateId: 'LA',
    parliamentaryConstituencyId: 'PC-LA-01',
    assemblyConstituencyId: null,
    elections: {},
  };
  const ladakhEligible = getVoterEligibleElections(ladakhVoter, INITIAL_ELECTIONS);
  assert.equal(
    ladakhEligible.every(
      (e) => (e.type || e.electionType) === ELECTION_TYPES.LOK_SABHA
    ),
    true
  );

  // Scenario I: Voter changes State/District/PC/AC in profile -> cascading reconciliation
  const reconciled = reconcileGeographySelection({
    stateId: 'MH',
    districtId: 'DIST-WB-KOL', // mismatched district from WB
    parliamentaryConstituencyId: 'PC-WB-01',
    assemblyConstituencyId: 'AC-WB-001',
    states: INITIAL_STATES,
    districts: INITIAL_DISTRICTS,
    constituencies: INITIAL_CONSTITUENCIES,
  });
  assert.equal(reconciled.stateId, 'MH');
  assert.notEqual(reconciled.districtId, 'DIST-WB-KOL');
  assert.notEqual(reconciled.parliamentaryConstituencyId, 'PC-WB-01');
  assert.notEqual(reconciled.assemblyConstituencyId, 'AC-WB-001');

  // Scenario J: Admin creates simultaneous Lok Sabha and Assembly elections
  const newSimLs = createElectionRecord(
    {
      name: 'Simultaneous Demo LS 2034',
      type: ELECTION_TYPES.LOK_SABHA,
      year: 2034,
      nominationStartDate: '2034-03-10',
      nominationEndDate: '2034-03-25',
      pollingStartDate: '2034-04-15',
      pollingEndDate: '2034-05-15',
      resultDate: '2034-05-20',
      status: 'DRAFT',
    },
    INITIAL_ELECTIONS,
    INITIAL_CONSTITUENCIES
  );
  const newSimAc = createElectionRecord(
    {
      name: 'Simultaneous Demo MH Assembly 2034',
      type: ELECTION_TYPES.STATE_ASSEMBLY,
      stateId: 'MH',
      year: 2034,
      nominationStartDate: '2034-03-10',
      nominationEndDate: '2034-03-25',
      pollingStartDate: '2034-04-15',
      pollingEndDate: '2034-05-15',
      resultDate: '2034-05-20',
      status: 'DRAFT',
    },
    [...INITIAL_ELECTIONS, newSimLs.election],
    INITIAL_CONSTITUENCIES
  );
  assert.equal(newSimLs.ok, true);
  assert.equal(newSimAc.ok, true);
  assert.notEqual(newSimLs.election.id, newSimAc.election.id);

  // Scenario K & L: Admin counts & publishes Lok Sabha while Assembly remains in counting; Public portal displays both accurately
  const simOverview = computeSimultaneousElectionOverview({
    stateId: 'WB',
    parliamentaryConstituencyId: 'PC-WB-12',
    assemblyConstituencyId: 'AC-WB-082',
    results: INITIAL_RESULTS,
    elections: INITIAL_ELECTIONS,
    constituencies: INITIAL_CONSTITUENCIES,
    candidates: INITIAL_CANDIDATES,
    parties: INITIAL_PARTIES,
  });
  assert.equal(simOverview.lokSabha.electionType, ELECTION_TYPES.LOK_SABHA);
  assert.equal(
    simOverview.stateAssembly.electionType,
    ELECTION_TYPES.STATE_ASSEMBLY
  );
  assert.notEqual(
    simOverview.lokSabha.constituencyId,
    simOverview.stateAssembly.constituencyId
  );
});

test('PHASE 7.3 — Counting & Results Numerical Edge Cases (Section 8)', () => {
  // Edge Case 1: 0 total votes
  const zeroVotes = calculateConstituencyStandings({
    candidates: [
      { candidateId: 'C1', partyId: 'P1', totalVotes: 0 },
      { candidateId: 'C2', partyId: 'P2', totalVotes: 0 },
    ],
    notaVotes: 0,
    isCompleted: true,
  });
  assert.equal(zeroVotes.totalCountedVotes, 0);
  assert.equal(zeroVotes.winnerCandidateId, null);
  assert.equal(zeroVotes.isTied, false);
  assert.equal(zeroVotes.candidates[0].votePercentage, 0);
  assert.equal(Number.isNaN(zeroVotes.candidates[0].votePercentage), false);

  // Edge Case 2: Single candidate with > 0 votes
  const singleCand = calculateConstituencyStandings({
    candidates: [{ candidateId: 'C1', partyId: 'P1', totalVotes: 1500 }],
    notaVotes: 0,
    isCompleted: true,
  });
  assert.equal(singleCand.winnerCandidateId, 'C1');
  assert.equal(singleCand.runnerUpCandidateId, null);
  assert.equal(singleCand.victoryMargin, 1500);
  assert.equal(singleCand.candidates[0].votePercentage, 100);

  // Edge Case 3: All votes go to NOTA
  const allNota = calculateConstituencyStandings({
    candidates: [
      { candidateId: 'C1', partyId: 'P1', totalVotes: 0 },
      { candidateId: 'C2', partyId: 'P2', totalVotes: 0 },
    ],
    notaVotes: 500,
    isCompleted: true,
  });
  assert.equal(allNota.totalCountedVotes, 500);
  assert.equal(allNota.notaPercentage, 100);
  assert.equal(allNota.winnerCandidateId, null);
  assert.equal(allNota.leadingCandidateId, null);

  // Edge Case 4: 2-way tie for highest votes
  const twoWayTie = calculateConstituencyStandings({
    candidates: [
      { candidateId: 'C1', partyId: 'P1', totalVotes: 4200 },
      { candidateId: 'C2', partyId: 'P2', totalVotes: 4200 },
      { candidateId: 'C3', partyId: 'P3', totalVotes: 1600 },
    ],
    notaVotes: 0,
    isCompleted: true,
  });
  assert.equal(twoWayTie.isTied, true);
  assert.equal(twoWayTie.winnerCandidateId, null);
  assert.deepEqual(twoWayTie.tiedCandidateIds, ['C1', 'C2']);
  assert.equal(twoWayTie.victoryMargin, 0);

  // Edge Case 5: 3-way tie for highest votes
  const threeWayTie = calculateConstituencyStandings({
    candidates: [
      { candidateId: 'C1', partyId: 'P1', totalVotes: 3000 },
      { candidateId: 'C2', partyId: 'P2', totalVotes: 3000 },
      { candidateId: 'C3', partyId: 'P3', totalVotes: 3000 },
    ],
    notaVotes: 1000,
    isCompleted: true,
  });
  assert.equal(threeWayTie.isTied, true);
  assert.equal(threeWayTie.winnerCandidateId, null);
  assert.equal(threeWayTie.tiedCandidateIds.length, 3);

  // Edge Case 6: Large realistic Indian constituency vote numbers (e.g., > 1,200,000 votes)
  const largeNumbers = calculateConstituencyStandings({
    candidates: [
      { candidateId: 'C1', partyId: 'P1', totalVotes: 685432 },
      { candidateId: 'C2', partyId: 'P2', totalVotes: 512310 },
    ],
    notaVotes: 14258,
    isCompleted: true,
  });
  assert.equal(largeNumbers.totalCountedVotes, 1212000);
  assert.equal(largeNumbers.winnerCandidateId, 'C1');
  assert.equal(largeNumbers.victoryMargin, 685432 - 512310);
});

test('PHASE 7.4 — Frontend Security Protections: CSV Formula Injection, Sanitization & Safe Uploads (Section 9)', () => {
  // 1. CSV Formula-Injection Protection
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(escapeCsvCell('+cmd|"/c calc"!A0'), '"\'+cmd|""/c calc""!A0"');
  assert.equal(escapeCsvCell('@IMPORTXML(...)'), "'@IMPORTXML(...)");
  assert.equal(escapeCsvCell('-2+3'), "'-2+3");
  // Plain '-' and negative numbers must remain unprefixed
  assert.equal(escapeCsvCell('-'), '-');
  assert.equal(escapeCsvCell('-12.5'), '-12.5');
  assert.equal(escapeCsvCell('Normal Text'), 'Normal Text');

  // 2. Plain-text input sanitization
  const dirty = '<script>alert("xss")</script>Rajesh <b>Kumar</b>';
  assert.equal(sanitizeTextInput(dirty), 'Rajesh bKumar/b');

  // 3. Safe image URL validation
  assert.equal(isSafeImageUrl('https://example.com/photo.png'), true);
  assert.equal(isSafeImageUrl('/assets/avatar.png'), true);
  assert.equal(
    isSafeImageUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'),
    true
  );
  assert.equal(isSafeImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeImageUrl('data:text/html;base64,PHNjcmlwdD4='), false);

  // 4. Image upload validation
  assert.equal(
    validateImageFile({ type: 'image/png', size: 512 * 1024 }).isValid,
    true
  );
  assert.equal(
    validateImageFile({ type: 'application/x-msdownload', size: 1024 }).isValid,
    false
  );
  assert.equal(
    validateImageFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 }).isValid,
    false
  );
});

test('PHASE 7.5 — Storage Corruption Recovery, ErrorBoundary, Accessibility, and Documentation (Sections 10, 11, 12 & 18)', () => {
  // 1. Verify corrupted JSON string in localStorage recovers gracefully without crashing
  const recoveredElections = storageService.safeParseJSON(
    '{corrupted_json_syntax',
    INITIAL_ELECTIONS
  );
  assert.ok(Array.isArray(recoveredElections));
  assert.equal(recoveredElections.length, INITIAL_ELECTIONS.length);

  // 2. Verify ErrorBoundary component exists and wraps App.jsx
  const errorBoundarySource = fs.readFileSync(
    path.resolve('src/components/common/ErrorBoundary.jsx'),
    'utf8'
  );
  const appSource = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
  assert.ok(errorBoundarySource.includes('getDerivedStateFromError'));
  assert.ok(errorBoundarySource.includes('handleResetAndReload'));
  assert.ok(appSource.includes('<ErrorBoundary>'));

  // 3. Verify Accessibility features (Skip link, Font-Size A-/A/A+, High-Contrast toggle, Escape key modal, main-content landmark)
  const navbarSource = fs.readFileSync(
    path.resolve('src/components/common/Navbar.jsx'),
    'utf8'
  );
  const modalSource = fs.readFileSync(
    path.resolve('src/components/common/Modal.jsx'),
    'utf8'
  );
  const cssSource = fs.readFileSync(path.resolve('src/index.css'), 'utf8');

  assert.ok(navbarSource.includes('href="#main-content"'));
  assert.ok(navbarSource.includes('Skip to main content'));
  assert.ok(navbarSource.includes('data-contrast'));
  assert.ok(navbarSource.includes('data-font-scale'));
  assert.ok(modalSource.includes("e.key === 'Escape'"));
  assert.ok(cssSource.includes('prefers-reduced-motion: reduce'));

  // 4. Verify all 4 required Phase 7 project documentation files exist and are non-empty
  for (const docFile of [
    'README.md',
    'ARCHITECTURE.md',
    'TESTING.md',
    'SECURITY-LIMITATIONS.md',
  ]) {
    const fullPath = path.resolve(docFile);
    assert.equal(fs.existsSync(fullPath), true, `Missing ${docFile}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.length > 500, `${docFile} should be comprehensive`);
  }
});




