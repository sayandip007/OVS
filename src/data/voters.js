import { defaultAvatar } from '../assets';
import { METADATA_SOURCES, NOTIFICATION_TYPES } from '../utils/constants';

/**
 * Deterministic Sample Voters for Phase 3 Voter Portal Demonstration.
 * Includes sample profiles for:
 * 1. West Bengal (WB) — Simultaneous Lok Sabha 2029 + West Bengal Assembly 2029
 * 2. Maharashtra (MH) — Lok Sabha 2029 (Active) + Maharashtra Assembly 2029 (Upcoming)
 * 3. Uttar Pradesh (UP) — Lok Sabha 2029 (Active) + Historical Lok Sabha 2024
 * 4. Tamil Nadu (TN) — Lok Sabha 2029 (Active)
 * 5. Delhi (DL) — Simultaneous Lok Sabha 2029 + Delhi Assembly 2029
 * 6. West Bengal (WB) — Partial Simultaneous Completion (1/2 completed demo)
 *
 * Each voter has TWO strictly separate constituency associations:
 * - parliamentaryConstituencyId (PARLIAMENTARY)
 * - assemblyConstituencyId (ASSEMBLY)
 *
 * Participation records (`elections`) NEVER store candidate or party choices.
 */
export const INITIAL_VOTERS = [
  {
    id: 'VOTER-001',
    voterId: 'VOTER-001',
    fullName: 'Demo Voter (Aarav Sen)',
    dateOfBirth: '1998-01-01',
    dob: '1998-01-01',
    gender: 'Male',
    email: 'demo@example.com',
    mobile: '9876543210',
    altMobile: '9000000001',
    epicReference: 'DEMO-EPIC-001',
    epicRef: 'WBX1234567',
    voterRef: 'WBX1234567',
    legacyLoginId: '1234',
    address: '14 College Street, Ward 8, Krishnanagar, Nadia, West Bengal',
    pinCode: '741101',
    stateId: 'WB',
    districtId: 'NADIA',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    accountStatus: 'ACTIVE',
    avatar: defaultAvatar,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-10-25T10:00:00.000Z',
    constituencyHistory: [
      {
        changedAt: '2026-01-15T10:00:00.000Z',
        reason: 'Initial Demo Registration',
        stateId: 'WB',
        districtId: 'NADIA',
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
      },
    ],
    elections: {
      'LS-2029': {
        status: 'PENDING',
        participatedAt: null,
        referenceId: null,
      },
      'WB-ASSEMBLY-2029': {
        status: 'PENDING',
        participatedAt: null,
        referenceId: null,
      },
      'LS-2024': {
        status: 'VOTED',
        participatedAt: '2024-05-13T11:42:00.000Z',
        referenceId: 'DEMO-REF-LS2024-WB001',
      },
    },
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'VOTER-002',
    voterId: 'VOTER-002',
    fullName: 'Rohan Deshmukh (Demo)',
    dateOfBirth: '1993-07-19',
    dob: '1993-07-19',
    gender: 'Male',
    email: 'rohan.demo@example.com',
    mobile: '9000000002',
    epicReference: 'DEMO-EPIC-002',
    epicRef: 'MHX2345678',
    voterRef: 'MHX2345678',
    legacyLoginId: '2002',
    address: '204 Hill Road, Bandra West, Mumbai Suburban, Maharashtra',
    pinCode: '400050',
    stateId: 'MH',
    districtId: 'MH-DIST-MUMBAI-SUBURBAN',
    parliamentaryConstituencyId: 'MH-PC-MUMBAI-NORTH',
    assemblyConstituencyId: 'MH-AC-BANDRA-WEST',
    accountStatus: 'ACTIVE',
    avatar: defaultAvatar,
    createdAt: '2026-02-10T09:15:00.000Z',
    updatedAt: '2026-10-20T09:15:00.000Z',
    constituencyHistory: [],
    elections: {
      'LS-2029': {
        status: 'PENDING',
        participatedAt: null,
        referenceId: null,
      },
      'MH-ASSEMBLY-2029': {
        status: 'UPCOMING',
        participatedAt: null,
        referenceId: null,
      },
      'LS-2024': {
        status: 'VOTED',
        participatedAt: '2024-05-20T14:15:00.000Z',
        referenceId: 'DEMO-REF-LS2024-MH002',
      },
    },
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'VOTER-003',
    voterId: 'VOTER-003',
    fullName: 'Siddharth Verma (Demo)',
    dateOfBirth: '1990-03-12',
    dob: '1990-03-12',
    gender: 'Male',
    email: 'siddharth.demo@example.com',
    mobile: '9000000003',
    epicReference: 'DEMO-EPIC-003',
    epicRef: 'UPX3456789',
    voterRef: 'UPX3456789',
    legacyLoginId: '3003',
    address: '88 Assi Ghat Road, Varanasi, Uttar Pradesh',
    pinCode: '221005',
    stateId: 'UP',
    districtId: 'UP-DIST-VARANASI',
    parliamentaryConstituencyId: 'UP-PC-VARANASI',
    assemblyConstituencyId: 'UP-AC-VARANASI-SOUTH',
    accountStatus: 'ACTIVE',
    avatar: defaultAvatar,
    createdAt: '2026-03-05T12:00:00.000Z',
    updatedAt: '2026-10-18T12:00:00.000Z',
    constituencyHistory: [],
    elections: {
      'LS-2029': {
        status: 'PENDING',
        participatedAt: null,
        referenceId: null,
      },
      'LS-2024': {
        status: 'VOTED',
        participatedAt: '2024-06-01T09:50:00.000Z',
        referenceId: 'DEMO-REF-LS2024-UP003',
      },
    },
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'VOTER-004',
    voterId: 'VOTER-004',
    fullName: 'Kavitha Sundaram (Demo)',
    dateOfBirth: '1996-11-08',
    dob: '1996-11-08',
    gender: 'Female',
    email: 'kavitha.demo@example.com',
    mobile: '9000000004',
    epicReference: 'DEMO-EPIC-004',
    epicRef: 'TNX4567890',
    voterRef: 'TNX4567890',
    legacyLoginId: '4004',
    address: '19 Anna Salai, Mylapore, Chennai, Tamil Nadu',
    pinCode: '600004',
    stateId: 'TN',
    districtId: 'TN-DIST-CHENNAI',
    parliamentaryConstituencyId: 'TN-PC-1',
    assemblyConstituencyId: 'TN-AC-1A',
    accountStatus: 'ACTIVE',
    avatar: defaultAvatar,
    createdAt: '2026-04-12T15:30:00.000Z',
    updatedAt: '2026-10-22T15:30:00.000Z',
    constituencyHistory: [],
    elections: {
      'LS-2029': {
        status: 'PENDING',
        participatedAt: null,
        referenceId: null,
      },
    },
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'VOTER-005',
    voterId: 'VOTER-005',
    fullName: 'Priya Sharma (Demo)',
    dateOfBirth: '1991-11-22',
    dob: '1991-11-22',
    gender: 'Female',
    email: 'priya.sharma@example.com',
    mobile: '9811122233',
    altMobile: '9000000005',
    epicReference: 'DEMO-EPIC-005',
    epicRef: 'DLX7654321',
    voterRef: 'DLX7654321',
    legacyLoginId: '5678',
    address: '42 Hanuman Road, Connaught Place, New Delhi',
    pinCode: '110001',
    stateId: 'DL',
    districtId: 'DL-DIST-NEW-DELHI',
    parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
    assemblyConstituencyId: 'DL-AC-NEW-DELHI',
    accountStatus: 'ACTIVE',
    avatar: defaultAvatar,
    createdAt: '2026-02-20T08:45:00.000Z',
    updatedAt: '2026-10-26T08:45:00.000Z',
    constituencyHistory: [],
    elections: {
      'LS-2029': {
        status: 'PENDING',
        participatedAt: null,
        referenceId: null,
      },
      'DL-ASSEMBLY-2029': {
        status: 'PENDING',
        participatedAt: null,
        referenceId: null,
      },
      'LS-2024': {
        status: 'VOTED',
        participatedAt: '2024-05-25T10:30:00.000Z',
        referenceId: 'DEMO-REF-LS2024-DL005',
      },
    },
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'VOTER-006',
    voterId: 'VOTER-006',
    fullName: 'Ananya Chatterjee (Demo)',
    dateOfBirth: '1988-08-03',
    dob: '1988-08-03',
    gender: 'Female',
    email: 'ananya.c@example.com',
    mobile: '9830011223',
    epicReference: 'DEMO-EPIC-006',
    epicRef: 'WBX9988776',
    voterRef: 'WBX9988776',
    legacyLoginId: '9988',
    address: '78 Ghurni Main Road, Krishnanagar, Nadia, West Bengal',
    pinCode: '741103',
    stateId: 'WB',
    districtId: 'NADIA',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    accountStatus: 'ACTIVE',
    avatar: defaultAvatar,
    createdAt: '2026-03-01T11:00:00.000Z',
    updatedAt: '2026-10-29T11:20:00.000Z',
    constituencyHistory: [],
    elections: {
      'LS-2029': {
        status: 'VOTED',
        participatedAt: '2026-10-29T11:20:00.000Z',
        referenceId: 'DEMO-REF-LS2029-WB006',
      },
      'WB-ASSEMBLY-2029': {
        status: 'PENDING',
        participatedAt: null,
        referenceId: null,
      },
    },
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
];

export const INITIAL_VOTER_NOTIFICATIONS = [
  {
    id: 'VNOTIF-001',
    type: NOTIFICATION_TYPES.ELECTION_ANNOUNCEMENT,
    title: 'Simultaneous Elections Announced: Lok Sabha 2029 & State Assemblies',
    message:
      'Demonstration schedule published for Lok Sabha General Election 2029 and simultaneous State Legislative Assembly elections in West Bengal and NCT of Delhi.',
    timestamp: '2026-10-30T08:00:00.000Z',
    read: false,
    targetStateId: null, // All voters
  },
  {
    id: 'VNOTIF-002',
    type: NOTIFICATION_TYPES.POLLING_SCHEDULE,
    title: 'Polling Schedule Active for Parliamentary & Assembly Constituencies',
    message:
      'Polling window is active from 2029-04-10 to 2029-05-15. Verify your independent Parliamentary (PC) and Assembly (AC) constituency mappings under My Constituencies.',
    timestamp: '2026-10-29T14:30:00.000Z',
    read: false,
    targetStateId: null,
  },
  {
    id: 'VNOTIF-003',
    type: NOTIFICATION_TYPES.ELECTION_REMINDER,
    title: 'Reminder: Independent Participation Tracking per Election ID',
    message:
      'Participating in a Lok Sabha election does not mark your State Assembly election as completed. Track each eligible election separately in My Elections.',
    timestamp: '2026-10-28T11:15:00.000Z',
    read: false,
    targetStateId: null,
  },
  {
    id: 'VNOTIF-004',
    type: NOTIFICATION_TYPES.NOMINATION_SCHEDULE,
    title: 'Nomination Scrutiny Completed for 2029 Demo Elections',
    message:
      'Candidate nominations and symbol allocations have been finalised for contested Parliamentary and Assembly seats.',
    timestamp: '2026-10-26T16:45:00.000Z',
    read: true,
    targetStateId: null,
  },
  {
    id: 'VNOTIF-005',
    type: NOTIFICATION_TYPES.CANDIDATE_LIST,
    title: 'Contesting Candidate Directory Published',
    message:
      'Inspect candidate affidavits, educational qualifications, and manifestos for your Parliamentary and Assembly constituencies.',
    timestamp: '2026-10-25T09:20:00.000Z',
    read: true,
    targetStateId: null,
  },
  {
    id: 'VNOTIF-006',
    type: NOTIFICATION_TYPES.RESULT_PUBLISHED,
    title: 'Historical Reference Results Available: Lok Sabha 2024',
    message:
      'Constituency-wise vote tallies and NOTA shares for Lok Sabha 2024 (Demo Reference) are available in the Results portal.',
    timestamp: '2026-10-20T18:00:00.000Z',
    read: true,
    targetStateId: null,
  },
  {
    id: 'VNOTIF-007',
    type: NOTIFICATION_TYPES.PROFILE_UPDATE,
    title: 'Dual Constituency Association Verified in Demo Store',
    message:
      'Your demo voter profile is mapped to separate Parliamentary (PC) and Assembly (AC) constituency IDs.',
    timestamp: '2026-10-18T10:10:00.000Z',
    read: true,
    targetStateId: null,
  },
  {
    id: 'VNOTIF-008',
    type: NOTIFICATION_TYPES.GENERAL_ANNOUNCEMENT,
    title: 'Frontend Demonstration & Ballot Secrecy Notice',
    message:
      'This portal operates as a local frontend demonstration. Participation history never records or reveals any candidate or party selection.',
    timestamp: '2026-10-15T08:00:00.000Z',
    read: true,
    targetStateId: null,
  },
];

export const INITIAL_ADMIN_OFFICERS = [
  {
    id: 'ECI-ADMIN-001',
    officerId: '1234',
    officerCode: '1234',
    altOfficerId: 'ECI001',
    name: 'Dr. R. K. Sen (Demo Chief Election Officer)',
    fullName: 'Dr. R. K. Sen (Demo Chief Election Officer)',
    designation: 'Chief Returning Officer (Demonstration)',
    mobile: '9876543210',
  },
];
