export const STORAGE_VERSION = 'ovs_v2_0';

export const STORAGE_KEYS = {
  VERSION: `${STORAGE_VERSION}_version`,
  STATES: `${STORAGE_VERSION}_states`,
  DISTRICTS: `${STORAGE_VERSION}_districts`,
  CONSTITUENCIES: `${STORAGE_VERSION}_constituencies`,
  PARTIES: `${STORAGE_VERSION}_parties`,
  ELECTIONS: `${STORAGE_VERSION}_elections`,
  CANDIDATES: `${STORAGE_VERSION}_candidates`,
  VOTERS: `${STORAGE_VERSION}_voters`,
  TALLIES: `${STORAGE_VERSION}_tallies`,
  FEEDBACK: `${STORAGE_VERSION}_feedback`,
  FEEDBACKS: `${STORAGE_VERSION}_feedback`,
  ANNOUNCEMENTS: `${STORAGE_VERSION}_announcements`,
  SESSION_AUTH: `${STORAGE_VERSION}_session_auth`,
};

export const ELECTION_TYPES = {
  LOK_SABHA: 'LOK_SABHA',
  STATE_ASSEMBLY: 'STATE_ASSEMBLY',
};

export const ELECTION_TYPE_LABELS = {
  LOK_SABHA: 'Lok Sabha General Election',
  STATE_ASSEMBLY: 'State Legislative Assembly Election',
};

export const CONSTITUENCY_TYPES = {
  PARLIAMENTARY: 'PARLIAMENTARY',
  ASSEMBLY: 'ASSEMBLY',
};

export const RESERVATION_TYPES = {
  GENERAL: 'GENERAL',
  SC: 'SC',
  ST: 'ST',
};

export const ELECTION_STATUSES = [
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

export const ELECTION_STATUS_LABELS = {
  DRAFT: 'Draft',
  UPCOMING: 'Upcoming',
  NOMINATION_OPEN: 'Nomination Open',
  NOMINATION_CLOSED: 'Nomination Closed',
  READY: 'Ready for Polling',
  POLLING_ACTIVE: 'Polling Active',
  POLLING_COMPLETED: 'Polling Completed',
  COUNTING: 'Counting in Progress',
  RESULTS_DECLARED: 'Results Declared',
  CANCELLED: 'Cancelled',
};

export const METADATA_SOURCES = {
  VERIFIED_OFFICIAL: 'VERIFIED_OFFICIAL',
  DEMO_SAMPLE: 'DEMO_SAMPLE',
};

export const DEMO_OTP_CODES = {
  PRIMARY: '123456',
  RESEND: '654321',
};

export const CANDIDATE_STATUSES = ['APPROVED', 'PENDING', 'REJECTED', 'WITHDRAWN'];

export const PARTY_STATUSES = ['ACTIVE', 'INACTIVE'];

export const NOTA_OPTION = {
  id: 'NOTA',
  candidateId: 'NOTA',
  name: 'None of the Above (NOTA)',
  partyName: 'Election Commission Option',
  abbreviation: 'NOTA',
  partyAbbreviation: 'NOTA',
  description: 'Reject all contesting candidates on this ballot (None of the Above)',
  isNota: true,
};
