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
  AUDIT_LOGS: `${STORAGE_VERSION}_audit_logs`,
  RESULT_PUBLICATIONS: `${STORAGE_VERSION}_result_publications`,
  RESULTS: `${STORAGE_VERSION}_results`,
  SESSION_AUTH: `${STORAGE_VERSION}_session_auth`,
};

export const ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  NATIONAL_ADMIN: 'NATIONAL_ADMIN',
  STATE_ADMIN: 'STATE_ADMIN',
  ELECTION_OFFICER: 'ELECTION_OFFICER',
  READ_ONLY_AUDITOR: 'READ_ONLY_AUDITOR',
};

export const ADMIN_ROLE_LABELS = {
  SUPER_ADMIN: 'Super Administrator (Chief Election Commissioner Demo)',
  NATIONAL_ADMIN: 'National Election Administrator',
  STATE_ADMIN: 'State Chief Electoral Officer (State Admin)',
  ELECTION_OFFICER: 'Returning / Election Officer',
  READ_ONLY_AUDITOR: 'Read-Only Election Observer & Auditor',
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
    'ARCHIVED',
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
    ARCHIVED: 'ARCHIVED',
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
  ARCHIVED: 'Archived (Historical)',
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

export const ANNOUNCEMENT_CATEGORIES = {
  GENERAL_INFO: 'GENERAL_INFO',
  ELECTION_SCHEDULE: 'ELECTION_SCHEDULE',
  CANDIDATE_INFO: 'CANDIDATE_INFO',
  POLLING_INSTRUCTIONS: 'POLLING_INSTRUCTIONS',
  RESULTS: 'RESULTS',
  IMPORTANT_NOTICE: 'IMPORTANT_NOTICE',
};

export const ANNOUNCEMENT_CATEGORY_LABELS = {
  GENERAL_INFO: 'General Information',
  ELECTION_SCHEDULE: 'Election Schedule',
  CANDIDATE_INFO: 'Candidate Information',
  POLLING_INSTRUCTIONS: 'Polling Instructions',
  RESULTS: 'Results',
  IMPORTANT_NOTICE: 'Important Notice',
  POLLING_SCHEDULE: 'Polling Schedule',
  ELECTORAL_ROLL: 'Electoral Roll Notice',
  SYSTEM_NOTICE: 'System & Demo Notice',
};

export const ANNOUNCEMENT_AUDIENCES = {
  ALL_VOTERS: 'ALL_VOTERS',
  SPECIFIC_STATE: 'SPECIFIC_STATE',
  SPECIFIC_ELECTION: 'SPECIFIC_ELECTION',
  SPECIFIC_CONSTITUENCY: 'SPECIFIC_CONSTITUENCY',
};

export const ANNOUNCEMENT_STATUSES = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
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

export const CANDIDATE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
  'SUSPENDED',
  'ARCHIVED',
];

export const CANDIDATE_STATUS_LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved (Contesting)',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived',
  PENDING: 'Under Review',
};

export const PARTY_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];

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

export const RESULT_STATUSES = {
  DRAFT: 'DRAFT',
  COUNTING_IN_PROGRESS: 'COUNTING_IN_PROGRESS',
  COUNTING_PAUSED: 'COUNTING_PAUSED',
  COUNTING_COMPLETED: 'COUNTING_COMPLETED',
  RESULT_READY_FOR_REVIEW: 'RESULT_READY_FOR_REVIEW',
  PUBLISHED: 'PUBLISHED',
  TIED: 'TIED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  CORRECTED: 'CORRECTED',
  UNPUBLISHED: 'UNPUBLISHED',
};

export const RESULT_STATUS_LABELS = {
  DRAFT: 'Draft (Counting Not Started)',
  COUNTING_IN_PROGRESS: 'Counting in Progress',
  COUNTING_PAUSED: 'Counting Paused',
  COUNTING_COMPLETED: 'Counting Completed',
  RESULT_READY_FOR_REVIEW: 'Ready for Review',
  PUBLISHED: 'Results Declared (Published)',
  TIED: 'Tied — Requires Resolution',
  UNDER_REVIEW: 'Under Administrative Review',
  CORRECTED: 'Published (Corrected)',
  UNPUBLISHED: 'Unpublished (Withdrawn)',
};

/**
 * Centralized Demonstration Clock & Election Lifecycle Configuration (Phase 7.5 / 7.6).
 * Prevents scattered hardcoded dates across components and provides a single source of truth
 * for evaluating past, active simulated, upcoming, and completed elections.
 */
const DEFAULT_DEMO_CLOCK_CONFIG = Object.freeze({
  referenceDate: '2029-04-20',
  referenceTimestamp: '2029-04-20T10:30:00.000Z',
  portalNoticeDefaultDate: '2029-04-10',
  portalNoticeDefaultExpiry: '2029-12-31',
  voterRegistryCutoffDate: '2029-01-01',
  simulationMode: 'SIMULATED_ELECTION_TIMELINE',
  sandboxConcurrencyMode: 'CONCURRENT_SIMULATION_SANDBOX',
  simulationDisclaimer:
    'DEMO / SIMULATION — Centralized demonstration clock set to 20 April 2029 for concurrent evaluation of active 2029 polling, upcoming 2029 schedules, and historical 2024 declared results.',
});

export const DEMO_CLOCK_CONFIG = {
  ...DEFAULT_DEMO_CLOCK_CONFIG,
};

export function isValidIsoDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return false;
  }
  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value.trim());
}

export function isValidIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }
  const parsed = new Date(value.trim());
  return !Number.isNaN(parsed.getTime());
}

export function setDemoClockConfig(overrides = {}) {
  if (overrides.referenceDate && isValidIsoDateString(overrides.referenceDate)) {
    DEMO_CLOCK_CONFIG.referenceDate = overrides.referenceDate.trim();
    if (!overrides.referenceTimestamp) {
      DEMO_CLOCK_CONFIG.referenceTimestamp = `${DEMO_CLOCK_CONFIG.referenceDate}T10:30:00.000Z`;
    }
  }
  if (overrides.referenceTimestamp && isValidIsoTimestamp(overrides.referenceTimestamp)) {
    DEMO_CLOCK_CONFIG.referenceTimestamp = new Date(overrides.referenceTimestamp.trim()).toISOString();
    if (!overrides.referenceDate) {
      DEMO_CLOCK_CONFIG.referenceDate = DEMO_CLOCK_CONFIG.referenceTimestamp.slice(0, 10);
    }
  }
  return { ...DEMO_CLOCK_CONFIG };
}

export function resetDemoClockConfig() {
  Object.assign(DEMO_CLOCK_CONFIG, DEFAULT_DEMO_CLOCK_CONFIG);
  return { ...DEMO_CLOCK_CONFIG };
}

export function getDemoReferenceDate(customDate = null) {
  if (isValidIsoDateString(customDate)) {
    return customDate.trim();
  }
  if (isValidIsoTimestamp(customDate)) {
    return new Date(customDate.trim()).toISOString().slice(0, 10);
  }
  return DEMO_CLOCK_CONFIG.referenceDate;
}

export function getDemoReferenceIso(customTimestamp = null) {
  if (isValidIsoDateString(customTimestamp)) {
    return `${customTimestamp.trim()}T10:30:00.000Z`;
  }
  if (isValidIsoTimestamp(customTimestamp)) {
    return new Date(customTimestamp.trim()).toISOString();
  }
  return DEMO_CLOCK_CONFIG.referenceTimestamp;
}



