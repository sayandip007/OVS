import type { SettingDefinition, FeatureFlagDefinition } from './settings.types.js';

export const SYSTEM_SETTINGS_REGISTRY: Record<string, SettingDefinition> = {
  // Platform
  'platform.siteName': {
    key: 'platform.siteName',
    category: 'PLATFORM',
    valueType: 'STRING',
    defaultValue: 'Online Voting System (ECI Simulation)',
    description: 'Public platform display name displayed in headers and banners.',
    isEditable: true,
    isSensitive: false,
    isPublic: true,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'string' || val.trim().length === 0 || val.length > 100) {
        return { valid: false, error: 'Site name must be between 1 and 100 characters.' };
      }
      return { valid: true };
    },
  },
  'platform.tagline': {
    key: 'platform.tagline',
    category: 'PLATFORM',
    valueType: 'STRING',
    defaultValue: 'Official Educational Simulation Platform of the Election Commission of India',
    description: 'Public subtitle displayed beneath the main platform header.',
    isEditable: true,
    isSensitive: false,
    isPublic: true,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'string' || val.length > 200) {
        return { valid: false, error: 'Tagline must be at most 200 characters.' };
      }
      return { valid: true };
    },
  },
  'platform.supportEmail': {
    key: 'platform.supportEmail',
    category: 'PLATFORM',
    valueType: 'STRING',
    defaultValue: 'support-ovs@eci.gov.in.demo',
    description: 'Contact support email address displayed on public pages.',
    isEditable: true,
    isSensitive: false,
    isPublic: true,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'string' || !val.includes('@')) {
        return { valid: false, error: 'Valid support email address is required.' };
      }
      return { valid: true };
    },
  },
  'platform.allowDemoDataReset': {
    key: 'platform.allowDemoDataReset',
    category: 'PLATFORM',
    valueType: 'BOOLEAN',
    defaultValue: true,
    description: 'Permits authorized administrators to reset the demo dataset to initial seeds.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
  },

  // Election Operations
  'election.defaultNominationWindowDays': {
    key: 'election.defaultNominationWindowDays',
    category: 'ELECTION_OPERATIONS',
    valueType: 'NUMBER',
    defaultValue: 14,
    description: 'Default duration in days for candidate nomination filing period.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'number' || val < 1 || val > 60) {
        return { valid: false, error: 'Nomination window must be between 1 and 60 days.' };
      }
      return { valid: true };
    },
  },
  'election.defaultScrutinyWindowDays': {
    key: 'election.defaultScrutinyWindowDays',
    category: 'ELECTION_OPERATIONS',
    valueType: 'NUMBER',
    defaultValue: 2,
    description: 'Default duration in days for nomination scrutiny.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'number' || val < 1 || val > 14) {
        return { valid: false, error: 'Scrutiny window must be between 1 and 14 days.' };
      }
      return { valid: true };
    },
  },
  'election.defaultWithdrawalWindowDays': {
    key: 'election.defaultWithdrawalWindowDays',
    category: 'ELECTION_OPERATIONS',
    valueType: 'NUMBER',
    defaultValue: 2,
    description: 'Default duration in days for nomination withdrawal.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'number' || val < 1 || val > 14) {
        return { valid: false, error: 'Withdrawal window must be between 1 and 14 days.' };
      }
      return { valid: true };
    },
  },
  'election.enforceStrictPhaseOrdering': {
    key: 'election.enforceStrictPhaseOrdering',
    category: 'ELECTION_OPERATIONS',
    valueType: 'BOOLEAN',
    defaultValue: true,
    description: 'Enforces strict chronological lifecycle transition rules for elections.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
  },

  // Voting
  'voting.allowVoteReceiptDownload': {
    key: 'voting.allowVoteReceiptDownload',
    category: 'VOTING',
    valueType: 'BOOLEAN',
    defaultValue: true,
    description: 'Allows voters to download their participation confirmation PDF/receipt.',
    isEditable: true,
    isSensitive: false,
    isPublic: true,
    requiresRestart: false,
  },
  'voting.demoParticipationCooldownMinutes': {
    key: 'voting.demoParticipationCooldownMinutes',
    category: 'VOTING',
    valueType: 'NUMBER',
    defaultValue: 0,
    description: 'Cooldown in minutes before a demo voter may re-cast simulated participation (0 = unlimited).',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'number' || val < 0 || val > 1440) {
        return { valid: false, error: 'Cooldown must be between 0 and 1440 minutes.' };
      }
      return { valid: true };
    },
  },
  'voting.showRealtimeParticipationCounter': {
    key: 'voting.showRealtimeParticipationCounter',
    category: 'VOTING',
    valueType: 'BOOLEAN',
    defaultValue: true,
    description: 'Shows live participation statistics on public demo dashboards.',
    isEditable: true,
    isSensitive: false,
    isPublic: true,
    requiresRestart: false,
  },

  // Security
  'security.maxFailedLoginAttempts': {
    key: 'security.maxFailedLoginAttempts',
    category: 'SECURITY',
    valueType: 'NUMBER',
    defaultValue: 5,
    description: 'Maximum failed authentication attempts before temporary lockout.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'number' || val < 3 || val > 20) {
        return { valid: false, error: 'Max failed login attempts must be between 3 and 20.' };
      }
      return { valid: true };
    },
  },
  'security.accountLockoutDurationMinutes': {
    key: 'security.accountLockoutDurationMinutes',
    category: 'SECURITY',
    valueType: 'NUMBER',
    defaultValue: 15,
    description: 'Lockout duration in minutes when failed attempts threshold is reached.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'number' || val < 1 || val > 1440) {
        return { valid: false, error: 'Lockout duration must be between 1 and 1440 minutes.' };
      }
      return { valid: true };
    },
  },
  'security.sessionTimeoutMinutes': {
    key: 'security.sessionTimeoutMinutes',
    category: 'SECURITY',
    valueType: 'NUMBER',
    defaultValue: 60,
    description: 'Inactivity session expiration period in minutes.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'number' || val < 5 || val > 1440) {
        return { valid: false, error: 'Session timeout must be between 5 and 1440 minutes.' };
      }
      return { valid: true };
    },
  },

  // Notifications
  'notifications.enableEmailChannel': {
    key: 'notifications.enableEmailChannel',
    category: 'NOTIFICATIONS',
    valueType: 'BOOLEAN',
    defaultValue: false,
    description: 'Enables external outbound email sending for voter and admin alerts.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
  },
  'notifications.batchWorkerIntervalSeconds': {
    key: 'notifications.batchWorkerIntervalSeconds',
    category: 'NOTIFICATIONS',
    valueType: 'NUMBER',
    defaultValue: 30,
    description: 'Worker polling interval in seconds for processing queued notification deliveries.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'number' || val < 5 || val > 300) {
        return { valid: false, error: 'Worker interval must be between 5 and 300 seconds.' };
      }
      return { valid: true };
    },
  },

  // Demo Simulation
  'demo.bannerDisclaimerText': {
    key: 'demo.bannerDisclaimerText',
    category: 'DEMO_SIMULATION',
    valueType: 'STRING',
    defaultValue: 'DEMO NOTICE: This is an educational voting simulation. No actual or legally binding votes are cast.',
    description: 'Disclaimer banner text rendered across all voter and public screens.',
    isEditable: true,
    isSensitive: false,
    isPublic: true,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'string' || val.trim().length === 0 || val.length > 300) {
        return { valid: false, error: 'Disclaimer text must be between 1 and 300 characters.' };
      }
      return { valid: true };
    },
  },
  'demo.acceleratedClockMultiplier': {
    key: 'demo.acceleratedClockMultiplier',
    category: 'DEMO_SIMULATION',
    valueType: 'NUMBER',
    defaultValue: 1,
    description: 'Time acceleration multiplier for simulated timeline progression.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
    validate: (val) => {
      if (typeof val !== 'number' || val < 1 || val > 100) {
        return { valid: false, error: 'Clock multiplier must be between 1 and 100.' };
      }
      return { valid: true };
    },
  },
  'demo.enableSimulatedCountingTally': {
    key: 'demo.enableSimulatedCountingTally',
    category: 'DEMO_SIMULATION',
    valueType: 'BOOLEAN',
    defaultValue: true,
    description: 'Allows administrative generation of synthetic demo counting rounds.',
    isEditable: true,
    isSensitive: false,
    isPublic: false,
    requiresRestart: false,
  },
};

export const DEFAULT_FEATURE_FLAGS: Record<string, FeatureFlagDefinition> = {
  'feat.advanced_analytics': {
    key: 'feat.advanced_analytics',
    description: 'Enables deep analytics dashboards and breakdown metrics.',
    defaultEnabled: true,
    defaultRollout: 100,
    defaultRoles: [],
  },
  'feat.voter_receipt_download': {
    key: 'feat.voter_receipt_download',
    description: 'Enables voter participation confirmation download feature.',
    defaultEnabled: true,
    defaultRollout: 100,
    defaultRoles: [],
  },
  'feat.email_notification_delivery': {
    key: 'feat.email_notification_delivery',
    description: 'Enables outbound email dispatcher for notifications and announcements.',
    defaultEnabled: true,
    defaultRollout: 0,
    defaultRoles: ['SUPER_ADMIN', 'NATIONAL_ADMIN'],
  },
  'feat.multi_round_counting_simulation': {
    key: 'feat.multi_round_counting_simulation',
    description: 'Enables multi-round synthetic tally processing and audit logs.',
    defaultEnabled: true,
    defaultRollout: 100,
    defaultRoles: [],
  },
  'feat.announcement_scheduler': {
    key: 'feat.announcement_scheduler',
    description: 'Enables future-scheduled announcement publishing.',
    defaultEnabled: true,
    defaultRollout: 100,
    defaultRoles: [],
  },
  'feat.maintenance_mode_interception': {
    key: 'feat.maintenance_mode_interception',
    description: 'Enforces system maintenance middleware request interception.',
    defaultEnabled: true,
    defaultRollout: 100,
    defaultRoles: [],
  },
};
