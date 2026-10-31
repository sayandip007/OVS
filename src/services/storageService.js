import { STORAGE_KEYS, STORAGE_VERSION } from '../utils/constants';
import { INITIAL_STATES } from '../data/states';
import { INITIAL_DISTRICTS } from '../data/districts';
import { INITIAL_CONSTITUENCIES } from '../data/constituencies';
import { INITIAL_PARTIES } from '../data/parties';
import { INITIAL_ELECTIONS, INITIAL_ANNOUNCEMENTS } from '../data/elections';
import { INITIAL_CANDIDATES, INITIAL_TALLIES } from '../data/candidates';
import {
  INITIAL_VOTERS,
  INITIAL_VOTER_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
} from '../data/voters';
import { INITIAL_RESULTS } from '../data/results';

const memoryLocalStore = new Map();
const memorySessionStore = new Map();

function getLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Fallback to memory store
  }
  return {
    getItem: (k) => (memoryLocalStore.has(k) ? memoryLocalStore.get(k) : null),
    setItem: (k, v) => memoryLocalStore.set(k, String(v)),
    removeItem: (k) => memoryLocalStore.delete(k),
  };
}

function getSessionStorage() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // Fallback to memory store
  }
  return {
    getItem: (k) => (memorySessionStore.has(k) ? memorySessionStore.get(k) : null),
    setItem: (k, v) => memorySessionStore.set(k, String(v)),
    removeItem: (k) => memorySessionStore.delete(k),
  };
}

export function safeParseJSON(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function getDurableItem(key, fallback) {
  const storage = getLocalStorage();
  const raw = storage.getItem(key);
  return safeParseJSON(raw, fallback);
}

export function setDurableItem(key, value) {
  const storage = getLocalStorage();
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Failed to persist key ${key}:`, err);
    return false;
  }
}

export function getSessionItem(key, fallback) {
  const storage = getSessionStorage();
  const raw = storage.getItem(key);
  return safeParseJSON(raw, fallback);
}

export function setSessionItem(key, value) {
  const storage = getSessionStorage();
  try {
    if (value === null || value === undefined) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify(value));
    }
    return true;
  } catch (err) {
    console.error(`Failed to persist session key ${key}:`, err);
    return false;
  }
}

export function getDefaultSeedSnapshot() {
  return {
    states: structuredClone(INITIAL_STATES),
    districts: structuredClone(INITIAL_DISTRICTS),
    constituencies: structuredClone(INITIAL_CONSTITUENCIES),
    parties: structuredClone(INITIAL_PARTIES),
    elections: structuredClone(INITIAL_ELECTIONS),
    candidates: structuredClone(INITIAL_CANDIDATES),
    voters: structuredClone(INITIAL_VOTERS),
    tallies: structuredClone(INITIAL_TALLIES),
    results: structuredClone(INITIAL_RESULTS),
    announcements: structuredClone(INITIAL_ANNOUNCEMENTS),
    voterNotifications: structuredClone(INITIAL_VOTER_NOTIFICATIONS),
    auditLogs: structuredClone(INITIAL_AUDIT_LOGS),
    resultPublications: {
      'LS-2024': {
        electionId: 'LS-2024',
        status: 'PUBLISHED',
        publishedAt: '2024-06-04T18:00:00.000Z',
        publishedBy: 'ECI-ADMIN-001',
        notes: 'Historical 2024 Lok Sabha reference result dataset.',
      },
      'LS-2029': {
        electionId: 'LS-2029',
        status: 'PUBLISHED',
        publishedAt: '2029-05-23T16:00:00.000Z',
        publishedBy: 'ECI-ADMIN-001',
        notes: 'Simulated demonstration results for Lok Sabha 2029.',
      },
      'WB-ASSEMBLY-2029': {
        electionId: 'WB-ASSEMBLY-2029',
        status: 'PUBLISHED',
        publishedAt: '2029-05-23T16:30:00.000Z',
        publishedBy: 'ECI-ADMIN-001',
        notes: 'Simultaneous West Bengal Legislative Assembly 2029 demo results.',
      },
      'DL-ASSEMBLY-2029': {
        electionId: 'DL-ASSEMBLY-2029',
        status: 'PUBLISHED',
        publishedAt: '2029-05-23T17:00:00.000Z',
        publishedBy: 'ECI-ADMIN-001',
        notes: 'Simultaneous Delhi Legislative Assembly 2029 demo results.',
      },
      'MH-ASSEMBLY-2029': {
        electionId: 'MH-ASSEMBLY-2029',
        status: 'DRAFT',
        publishedAt: null,
        publishedBy: 'ECI-ADMIN-001',
        notes: 'Upcoming Maharashtra Assembly 2029 draft results.',
      },
    },
    recentCandidates: ['CAND-LS29-WB-KRN-1', 'CAND-WBA29-KRNU-1'],
    feedback: [
      {
        id: 'FB-SEED-1',
        name: 'S. Venkataraman',
        email: 'venkat.citizen@example.com',
        category: 'Simultaneous Elections UX',
        message:
          'Clear separation between Lok Sabha and State Assembly ballots on the voter dashboard.',
        createdAt: '2026-10-28T09:30:00.000Z',
      },
    ],
  };
}

export function initializeStorageIfNeeded() {
  const currentVersion = getDurableItem(STORAGE_KEYS.VERSION, null);
  const seed = getDefaultSeedSnapshot();

  if (currentVersion !== STORAGE_VERSION) {
    setDurableItem(STORAGE_KEYS.VERSION, STORAGE_VERSION);
    setDurableItem(STORAGE_KEYS.STATES, seed.states);
    setDurableItem(STORAGE_KEYS.DISTRICTS, seed.districts);
    setDurableItem(STORAGE_KEYS.CONSTITUENCIES, seed.constituencies);
    setDurableItem(STORAGE_KEYS.PARTIES, seed.parties);
    setDurableItem(STORAGE_KEYS.ELECTIONS, seed.elections);
    setDurableItem(STORAGE_KEYS.CANDIDATES, seed.candidates);
    setDurableItem(STORAGE_KEYS.VOTERS, seed.voters);
    setDurableItem(STORAGE_KEYS.TALLIES, seed.tallies);
    setDurableItem(STORAGE_KEYS.RESULTS, seed.results);
    setDurableItem(STORAGE_KEYS.ANNOUNCEMENTS, seed.announcements);
    setDurableItem(STORAGE_KEYS.VOTER_NOTIFICATIONS, seed.voterNotifications);
    setDurableItem(STORAGE_KEYS.AUDIT_LOGS, seed.auditLogs);
    setDurableItem(STORAGE_KEYS.RESULT_PUBLICATIONS, seed.resultPublications);
    setDurableItem(STORAGE_KEYS.RECENT_CANDIDATES, seed.recentCandidates);
    setDurableItem(STORAGE_KEYS.FEEDBACK, seed.feedback);
    return seed;
  }

  return {
    states: getDurableItem(STORAGE_KEYS.STATES, seed.states),
    districts: getDurableItem(STORAGE_KEYS.DISTRICTS, seed.districts),
    constituencies: getDurableItem(STORAGE_KEYS.CONSTITUENCIES, seed.constituencies),
    parties: getDurableItem(STORAGE_KEYS.PARTIES, seed.parties),
    elections: getDurableItem(STORAGE_KEYS.ELECTIONS, seed.elections),
    candidates: getDurableItem(STORAGE_KEYS.CANDIDATES, seed.candidates),
    voters: getDurableItem(STORAGE_KEYS.VOTERS, seed.voters),
    tallies: getDurableItem(STORAGE_KEYS.TALLIES, seed.tallies),
    results: getDurableItem(STORAGE_KEYS.RESULTS, seed.results),
    announcements: getDurableItem(STORAGE_KEYS.ANNOUNCEMENTS, seed.announcements),
    voterNotifications: getDurableItem(
      STORAGE_KEYS.VOTER_NOTIFICATIONS,
      seed.voterNotifications
    ),
    auditLogs: getDurableItem(STORAGE_KEYS.AUDIT_LOGS, seed.auditLogs),
    resultPublications: getDurableItem(
      STORAGE_KEYS.RESULT_PUBLICATIONS,
      seed.resultPublications
    ),
    recentCandidates: getDurableItem(
      STORAGE_KEYS.RECENT_CANDIDATES,
      seed.recentCandidates
    ),
    feedback: getDurableItem(STORAGE_KEYS.FEEDBACK, seed.feedback),
  };
}

export function resetAllDemoData() {
  const seed = getDefaultSeedSnapshot();
  setDurableItem(STORAGE_KEYS.VERSION, STORAGE_VERSION);
  setDurableItem(STORAGE_KEYS.STATES, seed.states);
  setDurableItem(STORAGE_KEYS.DISTRICTS, seed.districts);
  setDurableItem(STORAGE_KEYS.CONSTITUENCIES, seed.constituencies);
  setDurableItem(STORAGE_KEYS.PARTIES, seed.parties);
  setDurableItem(STORAGE_KEYS.ELECTIONS, seed.elections);
  setDurableItem(STORAGE_KEYS.CANDIDATES, seed.candidates);
  setDurableItem(STORAGE_KEYS.VOTERS, seed.voters);
  setDurableItem(STORAGE_KEYS.TALLIES, seed.tallies);
  setDurableItem(STORAGE_KEYS.RESULTS, seed.results);
  setDurableItem(STORAGE_KEYS.ANNOUNCEMENTS, seed.announcements);
  setDurableItem(STORAGE_KEYS.VOTER_NOTIFICATIONS, seed.voterNotifications);
  setDurableItem(STORAGE_KEYS.AUDIT_LOGS, seed.auditLogs);
  setDurableItem(STORAGE_KEYS.RESULT_PUBLICATIONS, seed.resultPublications);
  setDurableItem(STORAGE_KEYS.RECENT_CANDIDATES, seed.recentCandidates);
  setDurableItem(STORAGE_KEYS.FEEDBACK, seed.feedback);
  return seed;
}

export const storageService = {
  safeParseJSON,
  getDurableItem,
  setDurableItem,
  getItem: getDurableItem,
  setItem: setDurableItem,
  getSessionItem,
  setSessionItem,
  getDefaultSeedSnapshot,
  initializeStorageIfNeeded,
  resetAllDemoData,
  getAuditLogs: () =>
    getDurableItem(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS),
  saveAuditLogs: (logs) => setDurableItem(STORAGE_KEYS.AUDIT_LOGS, logs),
  getAnnouncements: () =>
    getDurableItem(STORAGE_KEYS.ANNOUNCEMENTS, INITIAL_ANNOUNCEMENTS),
  saveAnnouncements: (announcements) =>
    setDurableItem(STORAGE_KEYS.ANNOUNCEMENTS, announcements),
  getResults: () => getDurableItem(STORAGE_KEYS.RESULTS, INITIAL_RESULTS),
  saveResults: (results) => setDurableItem(STORAGE_KEYS.RESULTS, results),
};

