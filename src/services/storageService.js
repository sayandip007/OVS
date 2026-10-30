import { STORAGE_KEYS, STORAGE_VERSION } from '../utils/constants';
import { INITIAL_STATES } from '../data/states';
import { INITIAL_DISTRICTS } from '../data/districts';
import { INITIAL_CONSTITUENCIES } from '../data/constituencies';
import { INITIAL_PARTIES } from '../data/parties';
import { INITIAL_ELECTIONS, INITIAL_ANNOUNCEMENTS } from '../data/elections';
import { INITIAL_CANDIDATES, INITIAL_TALLIES } from '../data/candidates';
import { INITIAL_VOTERS } from '../data/voters';

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
    announcements: structuredClone(INITIAL_ANNOUNCEMENTS),
    feedback: [
      {
        id: 'FB-SEED-1',
        name: 'S. Venkataraman',
        email: 'venkat.citizen@example.com',
        category: 'Simultaneous Elections UX',
        message: 'Clear separation between Lok Sabha and State Assembly ballots on the voter dashboard.',
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
    setDurableItem(STORAGE_KEYS.ANNOUNCEMENTS, seed.announcements);
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
    announcements: getDurableItem(STORAGE_KEYS.ANNOUNCEMENTS, seed.announcements),
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
  setDurableItem(STORAGE_KEYS.ANNOUNCEMENTS, seed.announcements);
  setDurableItem(STORAGE_KEYS.FEEDBACK, seed.feedback);
  return seed;
}

export const storageService = {
  safeParseJSON,
  getDurableItem,
  setDurableItem,
  getSessionItem,
  setSessionItem,
  getDefaultSeedSnapshot,
  initializeStorageIfNeeded,
  resetAllDemoData,
};
