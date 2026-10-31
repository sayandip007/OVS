import { ELECTION_TYPES, CONSTITUENCY_TYPES, METADATA_SOURCES } from '../utils/constants';
import { INITIAL_CONSTITUENCIES } from './constituencies';

const allParliamentaryIds = INITIAL_CONSTITUENCIES
  .filter((c) => c.type === CONSTITUENCY_TYPES.PARLIAMENTARY)
  .map((c) => c.id);

const wbAssemblyIds = INITIAL_CONSTITUENCIES
  .filter((c) => c.type === CONSTITUENCY_TYPES.ASSEMBLY && c.stateId === 'WB')
  .map((c) => c.id);

const dlAssemblyIds = INITIAL_CONSTITUENCIES
  .filter((c) => c.type === CONSTITUENCY_TYPES.ASSEMBLY && c.stateId === 'DL')
  .map((c) => c.id);

const mhAssemblyIds = INITIAL_CONSTITUENCIES
  .filter((c) => c.type === CONSTITUENCY_TYPES.ASSEMBLY && c.stateId === 'MH')
  .map((c) => c.id);

export const INITIAL_ELECTIONS = [
  {
    id: 'LS-2029',
    name: 'Lok Sabha General Election 2029',
    type: ELECTION_TYPES.LOK_SABHA,
    year: 2029,
    stateId: null,
    status: 'POLLING_ACTIVE',
    nominationStartDate: '2029-03-01',
    nominationEndDate: '2029-03-20',
    scrutinyDate: '2029-03-22',
    withdrawalDeadline: '2029-03-25',
    pollingStartDate: '2029-04-10',
    pollingEndDate: '2029-05-15',
    countingDate: '2029-05-20',
    resultDate: '2029-05-23',
    constituencyIds: allParliamentaryIds,
    description:
      'Nationwide 19th Lok Sabha General Election (Demonstration Simulation across Parliamentary Constituencies).',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
    lifecycleHistory: [
      { status: 'DRAFT', changedAt: '2029-01-10T10:00:00.000Z', note: 'Initial notification draft created' },
      { status: 'POLLING_ACTIVE', changedAt: '2029-04-10T07:00:00.000Z', note: 'Polling opened across Parliamentary constituencies' },
    ],
  },
  {
    id: 'WB-ASSEMBLY-2029',
    name: 'West Bengal Legislative Assembly Election 2029',
    type: ELECTION_TYPES.STATE_ASSEMBLY,
    year: 2029,
    stateId: 'WB',
    status: 'POLLING_ACTIVE',
    nominationStartDate: '2029-03-05',
    nominationEndDate: '2029-03-22',
    scrutinyDate: '2029-03-24',
    withdrawalDeadline: '2029-03-27',
    pollingStartDate: '2029-04-12',
    pollingEndDate: '2029-05-10',
    countingDate: '2029-05-20',
    resultDate: '2029-05-23',
    constituencyIds: wbAssemblyIds,
    description:
      'Simultaneous State Legislative Assembly Election for West Bengal Assembly Constituencies (Demo).',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
    lifecycleHistory: [
      { status: 'DRAFT', changedAt: '2029-01-12T10:00:00.000Z', note: 'WB Assembly notification draft' },
      { status: 'POLLING_ACTIVE', changedAt: '2029-04-12T07:00:00.000Z', note: 'Polling active across WB Assembly seats' },
    ],
  },
  {
    id: 'DL-ASSEMBLY-2029',
    name: 'Delhi Legislative Assembly Election 2029',
    type: ELECTION_TYPES.STATE_ASSEMBLY,
    year: 2029,
    stateId: 'DL',
    status: 'POLLING_ACTIVE',
    nominationStartDate: '2029-03-10',
    nominationEndDate: '2029-03-25',
    scrutinyDate: '2029-03-26',
    withdrawalDeadline: '2029-03-29',
    pollingStartDate: '2029-04-15',
    pollingEndDate: '2029-05-05',
    countingDate: '2029-05-20',
    resultDate: '2029-05-23',
    constituencyIds: dlAssemblyIds,
    description:
      'State Legislative Assembly Election for National Capital Territory of Delhi (Demo).',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
    lifecycleHistory: [
      { status: 'POLLING_ACTIVE', changedAt: '2029-04-15T07:00:00.000Z', note: 'Polling active across NCT of Delhi Assembly seats' },
    ],
  },
  {
    id: 'MH-ASSEMBLY-2029',
    name: 'Maharashtra Legislative Assembly Election 2029',
    type: ELECTION_TYPES.STATE_ASSEMBLY,
    year: 2029,
    stateId: 'MH',
    status: 'UPCOMING',
    nominationStartDate: '2029-08-01',
    nominationEndDate: '2029-08-18',
    scrutinyDate: '2029-08-20',
    withdrawalDeadline: '2029-08-23',
    pollingStartDate: '2029-09-10',
    pollingEndDate: '2029-09-25',
    countingDate: '2029-09-30',
    resultDate: '2029-10-02',
    constituencyIds: mhAssemblyIds,
    description:
      'Upcoming State Legislative Assembly Election for Maharashtra Assembly Constituencies (Demo).',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
    lifecycleHistory: [
      { status: 'UPCOMING', changedAt: '2029-02-01T10:00:00.000Z', note: 'Scheduled upcoming State Assembly election' },
    ],
  },
  {
    id: 'LS-2024',
    name: 'Lok Sabha General Election 2024 (Declared Demo Reference)',
    type: ELECTION_TYPES.LOK_SABHA,
    year: 2024,
    stateId: null,
    status: 'RESULTS_DECLARED',
    nominationStartDate: '2024-03-20',
    nominationEndDate: '2024-04-05',
    scrutinyDate: '2024-04-06',
    withdrawalDeadline: '2024-04-08',
    pollingStartDate: '2024-04-19',
    pollingEndDate: '2024-06-01',
    countingDate: '2024-06-04',
    resultDate: '2024-06-04',
    constituencyIds: allParliamentaryIds,
    description:
      'Completed Lok Sabha General Election with declared demonstration results.',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
    lifecycleHistory: [
      { status: 'RESULTS_DECLARED', changedAt: '2024-06-04T18:00:00.000Z', note: 'Official demonstration results declared' },
    ],
  },
];

export const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'ANN-001',
    title: 'Simultaneous Polling Active: Lok Sabha 2029 & State Assemblies (WB, DL)',
    date: '2026-10-30',
    publicationDate: '2026-10-30',
    expiryDate: '2029-06-01',
    category: 'ELECTION_SCHEDULE',
    status: 'PUBLISHED',
    targetAudience: 'ALL_VOTERS',
    targetStateId: null,
    targetElectionId: 'LS-2029',
    targetConstituencyId: null,
    message:
      'Eligible voters in West Bengal and NCT of Delhi can now participate independently in both Lok Sabha General Election 2029 and their respective State Legislative Assembly elections via the Voter Hub.',
    summary:
      'Eligible voters in West Bengal and NCT of Delhi can now participate independently in both Lok Sabha General Election 2029 and their respective State Legislative Assembly elections via the Voter Hub.',
  },
  {
    id: 'ANN-002',
    title: 'Strict Separation of Parliamentary (PC) and Assembly (AC) Ballots',
    date: '2026-10-28',
    publicationDate: '2026-10-28',
    expiryDate: '2029-12-31',
    category: 'POLLING_INSTRUCTIONS',
    status: 'PUBLISHED',
    targetAudience: 'ALL_VOTERS',
    targetStateId: null,
    targetElectionId: null,
    targetConstituencyId: null,
    message:
      'Each voter profile maps independently to one Parliamentary Constituency and one Assembly Constituency. Participation in one election does not alter your status in the other.',
    summary:
      'Each voter profile maps independently to one Parliamentary Constituency and one Assembly Constituency. Participation in one election does not alter your status in the other.',
  },
  {
    id: 'ANN-003',
    title: 'Demonstration Notice & Data Classification',
    date: '2026-10-25',
    publicationDate: '2026-10-25',
    expiryDate: '2030-12-31',
    category: 'IMPORTANT_NOTICE',
    status: 'PUBLISHED',
    targetAudience: 'ALL_VOTERS',
    targetStateId: null,
    targetElectionId: null,
    targetConstituencyId: null,
    message:
      'All constituency mappings, candidate profiles, and tallies in this portal are local frontend demonstration records (DEMO_SAMPLE) and do not represent official ECI electoral rolls.',
    summary:
      'All constituency mappings, candidate profiles, and tallies in this portal are local frontend demonstration records (DEMO_SAMPLE) and do not represent official ECI electoral rolls.',
  },
];

