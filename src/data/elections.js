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
    pollingStartDate: '2029-04-10',
    pollingEndDate: '2029-05-15',
    resultDate: '2029-05-23',
    constituencyIds: allParliamentaryIds,
    description:
      'Nationwide 19th Lok Sabha General Election (Demonstration Simulation across Parliamentary Constituencies).',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
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
    pollingStartDate: '2029-04-12',
    pollingEndDate: '2029-05-10',
    resultDate: '2029-05-23',
    constituencyIds: wbAssemblyIds,
    description:
      'Simultaneous State Legislative Assembly Election for West Bengal Assembly Constituencies (Demo).',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
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
    pollingStartDate: '2029-04-15',
    pollingEndDate: '2029-05-05',
    resultDate: '2029-05-23',
    constituencyIds: dlAssemblyIds,
    description:
      'State Legislative Assembly Election for National Capital Territory of Delhi (Demo).',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
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
    pollingStartDate: '2029-09-10',
    pollingEndDate: '2029-09-25',
    resultDate: '2029-10-02',
    constituencyIds: mhAssemblyIds,
    description:
      'Upcoming State Legislative Assembly Election for Maharashtra Assembly Constituencies (Demo).',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
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
    pollingStartDate: '2024-04-19',
    pollingEndDate: '2024-06-01',
    resultDate: '2024-06-04',
    constituencyIds: allParliamentaryIds,
    description:
      'Completed Lok Sabha General Election with declared demonstration results.',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
];

export const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'ANN-001',
    title: 'Simultaneous Polling Active: Lok Sabha 2029 & State Assemblies (WB, DL)',
    date: '2026-10-30',
    category: 'POLLING_SCHEDULE',
    summary:
      'Eligible voters in West Bengal and NCT of Delhi can now participate independently in both Lok Sabha General Election 2029 and their respective State Legislative Assembly elections via the Voter Hub.',
  },
  {
    id: 'ANN-002',
    title: 'Strict Separation of Parliamentary (PC) and Assembly (AC) Ballots',
    date: '2026-10-28',
    category: 'ELECTORAL_ROLL',
    summary:
      'Each voter profile maps independently to one Parliamentary Constituency and one Assembly Constituency. Participation in one election does not alter your status in the other.',
  },
  {
    id: 'ANN-003',
    title: 'Demonstration Notice & Data Classification',
    date: '2026-10-25',
    category: 'SYSTEM_NOTICE',
    summary:
      'All constituency mappings, candidate profiles, and tallies in this portal are local frontend demonstration records (DEMO_SAMPLE) and do not represent official ECI electoral rolls.',
  },
];
