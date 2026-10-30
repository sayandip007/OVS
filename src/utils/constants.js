export const STORAGE_VERSION = 'ovs_v3_0';

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
  VOTER_NOTIFICATIONS: `${STORAGE_VERSION}_voter_notifications`,
  RECENT_CANDIDATES: `${STORAGE_VERSION}_recent_candidates`,
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

export const GENDER_OPTIONS = ['Male', 'Female', 'Third Gender / Other'];

export const ELECTION_STATUSES = Object.assign(
  [
    'DRAFT',
    'UPCOMING',
    'NOMINATION_OPEN',
    'NOMINATION_CLOSED',
    'READY',
    'POLLING_ACTIVE',
    'ACTIVE',
    'POLLING_COMPLETED',
    'COMPLETED',
    'COUNTING',
    'RESULTS_DECLARED',
    'CANCELLED',
  ],
  {
    DRAFT: 'DRAFT',
    UPCOMING: 'UPCOMING',
    NOMINATION_OPEN: 'NOMINATION_OPEN',
    NOMINATION_CLOSED: 'NOMINATION_CLOSED',
    READY: 'READY',
    POLLING_ACTIVE: 'POLLING_ACTIVE',
    ACTIVE: 'POLLING_ACTIVE',
    POLLING_COMPLETED: 'POLLING_COMPLETED',
    COMPLETED: 'RESULTS_DECLARED',
    COUNTING: 'COUNTING',
    RESULTS_DECLARED: 'RESULTS_DECLARED',
    CANCELLED: 'CANCELLED',
  }
);

export const ELECTION_STATUS_LABELS = {
  DRAFT: 'Draft',
  UPCOMING: 'Upcoming',
  NOMINATION_OPEN: 'Nomination Open',
  NOMINATION_CLOSED: 'Nomination Closed',
  READY: 'Ready for Polling',
  POLLING_ACTIVE: 'Polling Active',
  ACTIVE: 'Polling Active',
  POLLING_COMPLETED: 'Polling Completed',
  COMPLETED: 'Results Declared',
  COUNTING: 'Counting in Progress',
  RESULTS_DECLARED: 'Results Declared',
  CANCELLED: 'Cancelled',
};

export const PARTICIPATION_STATUSES = {
  PENDING: 'PENDING',
  VOTED: 'VOTED',
  UPCOMING: 'UPCOMING',
  CLOSED: 'CLOSED',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
};

export const PARTICIPATION_STATUS_STYLES = {
  PENDING: {
    label: 'PENDING',
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
    dotClass: 'bg-amber-500',
    bg: 'bg-amber-100',
    text: 'text-amber-900',
    border: 'border-amber-300',
  },
  VOTED: {
    label: 'VOTED',
    badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    dotClass: 'bg-emerald-600',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900',
    border: 'border-emerald-300',
  },
  UPCOMING: {
    label: 'UPCOMING',
    badgeClass: 'bg-blue-100 text-blue-900 border border-blue-300',
    dotClass: 'bg-blue-600',
    bg: 'bg-blue-100',
    text: 'text-blue-900',
    border: 'border-blue-300',
  },
  CLOSED: {
    label: 'CLOSED',
    badgeClass: 'bg-slate-200 text-slate-800 border border-slate-300',
    dotClass: 'bg-slate-500',
    bg: 'bg-slate-200',
    text: 'text-slate-800',
    border: 'border-slate-300',
  },
  NOT_ELIGIBLE: {
    label: 'NOT ELIGIBLE',
    badgeClass: 'bg-slate-100 text-slate-600 border border-slate-300',
    dotClass: 'bg-slate-400',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
  },
};

export const NOTIFICATION_TYPES = {
  ELECTION_ANNOUNCEMENT: 'ELECTION_ANNOUNCEMENT',
  NOMINATION_SCHEDULE: 'NOMINATION_SCHEDULE',
  POLLING_SCHEDULE: 'POLLING_SCHEDULE',
  ELECTION_REMINDER: 'ELECTION_REMINDER',
  CANDIDATE_LIST: 'CANDIDATE_LIST',
  RESULT_PUBLISHED: 'RESULT_PUBLISHED',
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  GENERAL_ANNOUNCEMENT: 'GENERAL_ANNOUNCEMENT',
};

export const NOTIFICATION_TYPE_LABELS = {
  ELECTION_ANNOUNCEMENT: 'Election Announcement',
  NOMINATION_SCHEDULE: 'Nomination Schedule Announcement',
  POLLING_SCHEDULE: 'Polling Schedule Announcement',
  ELECTION_REMINDER: 'Election Reminder',
  CANDIDATE_LIST: 'Candidate List Published',
  RESULT_PUBLISHED: 'Result Published',
  PROFILE_UPDATE: 'Profile Update',
  GENERAL_ANNOUNCEMENT: 'General Announcement',
};

export const METADATA_SOURCES = {
  VERIFIED_OFFICIAL: 'VERIFIED_OFFICIAL',
  DEMO_SAMPLE: 'DEMO_SAMPLE',
};

export const DEMO_OTP_CODES = {
  PRIMARY: '123456',
  RESEND: '654321',
  VOTER_LOGIN: '123456',
  ADMIN_LOGIN: '123456',
};

export const OTP_CONFIG = {
  MAX_ATTEMPTS: 3,
  EXPIRY_MS: 120 * 1000, // 2 minutes validity
  RESEND_COOLDOWN_SECONDS: 30,
  SESSION_DURATION_MS: 8 * 60 * 60 * 1000, // 8 hours demo session
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
