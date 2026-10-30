import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  STORAGE_KEYS,
  METADATA_SOURCES,
  NOTIFICATION_TYPES,
} from '../utils/constants';
import { defaultAvatar, eciLogo } from '../assets';
import { storageService } from '../services/storageService';
import {
  createElectionRecord,
  updateElectionRecord,
  recordSimulatedParticipation,
} from '../services/electionService';
import {
  createConstituencyRecord,
  updateConstituencyRecord,
} from '../services/constituencyService';
import {
  createCandidateRecord,
  updateCandidateRecord,
} from '../services/candidateService';
import {
  validateVoterInput,
  validateProfileUpdateInput,
} from '../utils/validation';

const ElectionContext = createContext(null);

const OFFICIAL_SEAT_ALLOCATIONS = {
  AP: { ls: 25, ac: 175, region: 'South' },
  AR: { ls: 2, ac: 60, region: 'North-East' },
  AS: { ls: 14, ac: 126, region: 'North-East' },
  BR: { ls: 40, ac: 243, region: 'East' },
  CG: { ls: 11, ac: 90, region: 'Central' },
  GA: { ls: 2, ac: 40, region: 'West' },
  GJ: { ls: 26, ac: 182, region: 'West' },
  HR: { ls: 10, ac: 90, region: 'North' },
  HP: { ls: 4, ac: 68, region: 'North' },
  JH: { ls: 14, ac: 81, region: 'East' },
  KA: { ls: 28, ac: 224, region: 'South' },
  KL: { ls: 20, ac: 140, region: 'South' },
  MP: { ls: 29, ac: 230, region: 'Central' },
  MH: { ls: 48, ac: 288, region: 'West' },
  MN: { ls: 2, ac: 60, region: 'North-East' },
  ML: { ls: 2, ac: 60, region: 'North-East' },
  MZ: { ls: 1, ac: 40, region: 'North-East' },
  NL: { ls: 1, ac: 60, region: 'North-East' },
  OD: { ls: 21, ac: 147, region: 'East' },
  PB: { ls: 13, ac: 117, region: 'North' },
  RJ: { ls: 25, ac: 200, region: 'North' },
  SK: { ls: 1, ac: 32, region: 'North-East' },
  TN: { ls: 39, ac: 234, region: 'South' },
  TG: { ls: 17, ac: 119, region: 'South' },
  TR: { ls: 2, ac: 60, region: 'North-East' },
  UP: { ls: 80, ac: 403, region: 'North' },
  UK: { ls: 5, ac: 70, region: 'North' },
  WB: { ls: 42, ac: 294, region: 'East' },
  AN: { ls: 1, ac: 0, region: 'Islands' },
  CH: { ls: 1, ac: 0, region: 'North' },
  DN: { ls: 2, ac: 0, region: 'West' },
  DL: { ls: 7, ac: 70, region: 'North' },
  JK: { ls: 5, ac: 90, region: 'North' },
  LA: { ls: 1, ac: 0, region: 'North' },
  LD: { ls: 1, ac: 0, region: 'Islands' },
  PY: { ls: 1, ac: 30, region: 'South' },
};

function enrichState(s) {
  const id = s.id || s.stateId;
  const name = s.name || s.stateName;
  const alloc = OFFICIAL_SEAT_ALLOCATIONS[id] || { ls: 1, ac: 30, region: 'India' };
  const normalizedType =
    s.type === 'UNION_TERRITORY' || s.type === 'UT' ? 'UT' : 'STATE';
  return {
    ...s,
    id,
    stateId: id,
    name,
    stateName: name,
    type: normalizedType,
    totalLokSabhaSeats:
      s.totalLokSabhaSeats !== undefined ? s.totalLokSabhaSeats : alloc.ls,
    totalAssemblySeats:
      s.totalAssemblySeats !== undefined ? s.totalAssemblySeats : alloc.ac,
    region: s.region || alloc.region,
  };
}

function enrichDistrict(d) {
  const id = d.id || d.districtId;
  const name = d.name || d.districtName;
  return {
    ...d,
    id,
    districtId: id,
    name,
    districtName: name,
    districtCode: d.districtCode || id,
    headquarters: d.headquarters || name,
  };
}

function enrichConstituency(c) {
  const id = c.id || c.constituencyId;
  const type = c.type || c.constituencyType;
  const parentPc =
    c.parentParliamentaryConstituencyId || c.parentParliamentaryId || null;
  return {
    ...c,
    id,
    constituencyId: id,
    type,
    constituencyType: type,
    code: c.code || id,
    reservationType: c.reservationType || 'GENERAL',
    electorCount: c.electorCount || (type === 'PARLIAMENTARY' ? 1645200 : 248500),
    parentParliamentaryConstituencyId: parentPc,
    parentParliamentaryId: parentPc,
  };
}

function enrichParty(p) {
  const id = p.id || p.partyId;
  const name = p.name || p.partyName;
  const symbol = p.symbol || p.symbolUrl || eciLogo;
  const type = p.type || p.partyType || 'STATE';
  return {
    ...p,
    id,
    partyId: id,
    name,
    partyName: name,
    symbol,
    symbolUrl: symbol,
    symbolName: p.symbolName || `${p.abbreviation} Official Symbol`,
    type,
    partyType: type,
  };
}

function enrichElection(e) {
  const id = e.id || e.electionId;
  const name = e.name || e.title;
  const type = e.type || e.electionType;
  const nominationStart =
    e.nominationStartDate || e.schedule?.gazetteNotification || '2029-03-01';
  const nominationEnd =
    e.nominationEndDate || e.schedule?.nominationClose || '2029-03-20';
  const pollStart =
    e.pollingDate || e.pollingStartDate || e.schedule?.pollingDate || '2029-04-15';
  const resultDate = e.resultDate || e.schedule?.countingDate || '2029-05-23';

  return {
    ...e,
    id,
    electionId: id,
    name,
    title: name,
    type,
    electionType: type,
    year: e.year || 2029,
    constituencyType:
      e.constituencyType || (type === 'LOK_SABHA' ? 'PARLIAMENTARY' : 'ASSEMBLY'),
    announcementDate: e.announcementDate || nominationStart,
    pollingDate: pollStart,
    pollingStartDate: pollStart,
    pollingEndDate: e.pollingEndDate || pollStart,
    resultDate,
    schedule: {
      gazetteNotification: nominationStart,
      nominationClose: nominationEnd,
      pollingDate: pollStart,
      countingDate: resultDate,
      ...(e.schedule || {}),
    },
  };
}

function enrichCandidate(c, index, constituencies) {
  const id = c.id || c.candidateId;
  const photo = c.photograph || c.photoUrl || defaultAvatar;
  const status = c.status || c.approvalStatus || 'APPROVED';
  const constObj = constituencies.find(
    (ct) => (ct.id || ct.constituencyId) === c.constituencyId
  );
  return {
    ...c,
    id,
    candidateId: id,
    stateId: c.stateId || constObj?.stateId || 'WB',
    districtId: c.districtId || constObj?.districtId || 'NADIA',
    photograph: photo,
    photoUrl: photo,
    status,
    approvalStatus: status,
    age: c.age || 42,
    gender: c.gender || 'General',
    ballotNumber: c.ballotNumber || index + 1,
    manifesto: c.manifesto || c.manifestoSummary || '',
    manifestoSummary: c.manifestoSummary || c.manifesto || '',
  };
}

function enrichVoter(v) {
  const id = v.id || v.voterId;
  const epic = v.epicRef || v.epicReference || v.voterRef;
  const dobVal = v.dateOfBirth || v.dob || '1998-01-01';
  return {
    ...v,
    id,
    voterId: id,
    dateOfBirth: dobVal,
    dob: dobVal,
    epicReference: v.epicReference || epic,
    epicRef: epic,
    voterRef: epic,
    pinCode: v.pinCode || '741101',
    accountStatus: v.accountStatus || 'ACTIVE',
    createdAt: v.createdAt || '2026-01-15T10:00:00.000Z',
    updatedAt: v.updatedAt || '2026-10-25T10:00:00.000Z',
    constituencyHistory: Array.isArray(v.constituencyHistory)
      ? v.constituencyHistory
      : [],
  };
}

/**
 * Pure helper for registering a voter against existing records (used by context & unit tests).
 */
export function registerVoterRecord(
  input,
  existingVoters = [],
  states = [],
  districts = [],
  constituencies = []
) {
  const epicVal = (
    input?.epicReference ||
    input?.epicRef ||
    input?.voterRef ||
    ''
  )
    .trim()
    .toUpperCase();

  const normalizedInput = {
    ...input,
    fullName: input?.fullName ? String(input.fullName).trim() : '',
    dob: input?.dateOfBirth || input?.dob || '',
    dateOfBirth: input?.dateOfBirth || input?.dob || '',
    gender: input?.gender ? String(input.gender).trim() : '',
    email: input?.email ? String(input.email).trim() : '',
    mobile: input?.mobile ? String(input.mobile).trim() : '',
    epicRef: epicVal,
    epicReference: epicVal,
    address: input?.address ? String(input.address).trim() : '',
    pinCode: input?.pinCode ? String(input.pinCode).trim() : '',
    stateId: input?.stateId || '',
    districtId: input?.districtId || '',
    parliamentaryConstituencyId: input?.parliamentaryConstituencyId || '',
    assemblyConstituencyId: input?.assemblyConstituencyId || '',
  };

  const validation = validateVoterInput(
    normalizedInput,
    states,
    districts,
    constituencies
  );
  if (!validation.isValid) {
    return {
      ok: false,
      errors: Array.isArray(validation.errors)
        ? validation.errors
        : Object.values(validation.errors || {}),
      fieldErrors: validation.errors,
    };
  }

  // Prevent duplicate demo identity (EPIC reference or mobile)
  const duplicateEpic = existingVoters.some(
    (v) =>
      (v.epicRef || '').toUpperCase() === epicVal ||
      (v.epicReference || '').toUpperCase() === epicVal ||
      (v.voterRef || '').toUpperCase() === epicVal
  );
  if (duplicateEpic) {
    return {
      ok: false,
      errors: [
        'A demo voter with this EPIC / Voter ID reference already exists in the local store.',
      ],
      fieldErrors: {
        epicRef:
          'A demo voter with this EPIC / Voter ID reference already exists.',
      },
    };
  }

  const nowIso = new Date().toISOString();
  let seq = existingVoters.length + 1;
  let id = `VOTER-${String(seq).padStart(3, '0')}`;
  while (existingVoters.some((v) => (v.id || v.voterId) === id)) {
    seq += 1;
    id = `VOTER-${String(seq).padStart(3, '0')}`;
  }

  const newVoter = enrichVoter({
    id,
    voterId: id,
    fullName: normalizedInput.fullName,
    dateOfBirth: normalizedInput.dateOfBirth,
    dob: normalizedInput.dob,
    gender: normalizedInput.gender,
    email: normalizedInput.email,
    mobile: normalizedInput.mobile,
    epicReference: epicVal,
    epicRef: epicVal,
    voterRef: epicVal,
    address: normalizedInput.address || 'Demo Residential Address',
    pinCode: normalizedInput.pinCode || '700001',
    stateId: normalizedInput.stateId,
    districtId: normalizedInput.districtId,
    parliamentaryConstituencyId: normalizedInput.parliamentaryConstituencyId,
    assemblyConstituencyId: normalizedInput.assemblyConstituencyId,
    accountStatus: 'ACTIVE',
    avatar: input?.avatar || defaultAvatar,
    createdAt: nowIso,
    updatedAt: nowIso,
    constituencyHistory: [
      {
        changedAt: nowIso,
        reason: 'Initial Demo Registration',
        stateId: normalizedInput.stateId,
        districtId: normalizedInput.districtId,
        parliamentaryConstituencyId: normalizedInput.parliamentaryConstituencyId,
        assemblyConstituencyId: normalizedInput.assemblyConstituencyId,
      },
    ],
    elections: {},
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  });

  return { ok: true, voter: newVoter };
}

/**
 * Pure helper for updating a voter profile (used by context & unit tests).
 * Preserves constituency associations unless `allowAdminConstituencyCorrection` is true.
 */
export function updateVoterProfileRecord(
  voterId,
  updates,
  existingVoters = [],
  states = [],
  districts = [],
  constituencies = [],
  options = {}
) {
  const target = existingVoters.find((v) => (v.id || v.voterId) === voterId);
  if (!target) {
    return { ok: false, errors: ['Voter not found.'] };
  }

  const candidateMerged = {
    ...target,
    ...updates,
    dob: updates.dateOfBirth || updates.dob || target.dob || target.dateOfBirth,
    dateOfBirth:
      updates.dateOfBirth || updates.dob || target.dateOfBirth || target.dob,
  };

  // Validate personal & contact fields
  const profileCheck = validateProfileUpdateInput(candidateMerged);
  if (!profileCheck.isValid) {
    return {
      ok: false,
      errors: Object.values(profileCheck.errors),
      fieldErrors: profileCheck.errors,
    };
  }

  const isAttemptingConstituencyChange =
    (updates.stateId && updates.stateId !== target.stateId) ||
    (updates.districtId && updates.districtId !== target.districtId) ||
    (updates.parliamentaryConstituencyId &&
      updates.parliamentaryConstituencyId !==
        target.parliamentaryConstituencyId) ||
    (updates.assemblyConstituencyId &&
      updates.assemblyConstituencyId !== target.assemblyConstituencyId);

  let nextHistory = Array.isArray(target.constituencyHistory)
    ? [...target.constituencyHistory]
    : [];

  if (isAttemptingConstituencyChange) {
    if (!options.allowAdminConstituencyCorrection) {
      return {
        ok: false,
        errors: [
          'Constituency associations cannot be modified directly after registration without using the Demo Administrative Constituency Correction workflow.',
        ],
      };
    }

    const fullGeoCheck = validateVoterInput(
      candidateMerged,
      states,
      districts,
      constituencies
    );
    if (!fullGeoCheck.isValid) {
      return {
        ok: false,
        errors: Object.values(fullGeoCheck.errors),
        fieldErrors: fullGeoCheck.errors,
      };
    }

    nextHistory.unshift({
      changedAt: new Date().toISOString(),
      reason:
        options.correctionReason ||
        'Demo Administrative Constituency Correction',
      previousStateId: target.stateId,
      previousDistrictId: target.districtId,
      previousParliamentaryConstituencyId: target.parliamentaryConstituencyId,
      previousAssemblyConstituencyId: target.assemblyConstituencyId,
      stateId: candidateMerged.stateId,
      districtId: candidateMerged.districtId,
      parliamentaryConstituencyId: candidateMerged.parliamentaryConstituencyId,
      assemblyConstituencyId: candidateMerged.assemblyConstituencyId,
    });
  }

  const merged = enrichVoter({
    ...candidateMerged,
    stateId: isAttemptingConstituencyChange
      ? candidateMerged.stateId
      : target.stateId,
    districtId: isAttemptingConstituencyChange
      ? candidateMerged.districtId
      : target.districtId,
    parliamentaryConstituencyId: isAttemptingConstituencyChange
      ? candidateMerged.parliamentaryConstituencyId
      : target.parliamentaryConstituencyId,
    assemblyConstituencyId: isAttemptingConstituencyChange
      ? candidateMerged.assemblyConstituencyId
      : target.assemblyConstituencyId,
    constituencyHistory: nextHistory,
    updatedAt: new Date().toISOString(),
  });

  return { ok: true, voter: merged };
}

export function ElectionProvider({ children }) {
  const [store, setStore] = useState(() =>
    storageService.initializeStorageIfNeeded()
  );

  const syncKey = useCallback((storageKey, sliceName, nextValue) => {
    storageService.setDurableItem(storageKey, nextValue);
    setStore((prev) => ({
      ...prev,
      [sliceName]: nextValue,
    }));
  }, []);

  const enrichedStates = useMemo(
    () => (store.states || []).map(enrichState),
    [store.states]
  );

  const enrichedDistricts = useMemo(
    () => (store.districts || []).map(enrichDistrict),
    [store.districts]
  );

  const enrichedConstituencies = useMemo(
    () => (store.constituencies || []).map(enrichConstituency),
    [store.constituencies]
  );

  const enrichedParties = useMemo(
    () => (store.parties || []).map(enrichParty),
    [store.parties]
  );

  const enrichedElections = useMemo(
    () => (store.elections || []).map(enrichElection),
    [store.elections]
  );

  const enrichedCandidates = useMemo(
    () =>
      (store.candidates || []).map((c, idx) =>
        enrichCandidate(c, idx, enrichedConstituencies)
      ),
    [store.candidates, enrichedConstituencies]
  );

  const enrichedVoters = useMemo(
    () => (store.voters || []).map(enrichVoter),
    [store.voters]
  );

  const normalizedTallies = useMemo(() => {
    const raw = store.tallies || {};
    const result = { ...raw };
    for (const [key, val] of Object.entries(raw)) {
      if (key.includes('::')) {
        const [elId, constId, candId] = key.split('::');
        if (!result[elId] || typeof result[elId] !== 'object') {
          result[elId] = {};
        }
        if (!result[elId][constId]) {
          result[elId][constId] = {};
        }
        result[elId][constId][candId] = Number(val) || 0;
      }
    }
    return result;
  }, [store.tallies]);

  // ================= VOTER NOTIFICATIONS =================
  const voterNotifications = useMemo(
    () => store.voterNotifications || [],
    [store.voterNotifications]
  );

  const addVoterNotification = useCallback(
    (payload) => {
      const nextItem = {
        id: `VNOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: payload.type || NOTIFICATION_TYPES.GENERAL_ANNOUNCEMENT,
        title: payload.title || 'Portal Update',
        message: payload.message || '',
        timestamp: new Date().toISOString(),
        read: false,
        targetStateId: payload.targetStateId || null,
      };
      const next = [nextItem, ...(store.voterNotifications || [])];
      syncKey(
        STORAGE_KEYS.VOTER_NOTIFICATIONS,
        'voterNotifications',
        next
      );
      return nextItem;
    },
    [store.voterNotifications, syncKey]
  );

  const markNotificationAsRead = useCallback(
    (notificationId) => {
      const next = (store.voterNotifications || []).map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      syncKey(
        STORAGE_KEYS.VOTER_NOTIFICATIONS,
        'voterNotifications',
        next
      );
    },
    [store.voterNotifications, syncKey]
  );

  const markAllNotificationsAsRead = useCallback(() => {
    const next = (store.voterNotifications || []).map((n) => ({
      ...n,
      read: true,
    }));
    syncKey(STORAGE_KEYS.VOTER_NOTIFICATIONS, 'voterNotifications', next);
  }, [store.voterNotifications, syncKey]);

  const clearAllNotifications = useCallback(() => {
    syncKey(STORAGE_KEYS.VOTER_NOTIFICATIONS, 'voterNotifications', []);
  }, [syncKey]);

  // ================= RECENTLY VIEWED CANDIDATES =================
  const recordCandidateView = useCallback(
    (candidateId) => {
      if (!candidateId) return;
      const current = store.recentCandidates || [];
      const next = [
        candidateId,
        ...current.filter((id) => id !== candidateId),
      ].slice(0, 6);
      syncKey(STORAGE_KEYS.RECENT_CANDIDATES, 'recentCandidates', next);
    },
    [store.recentCandidates, syncKey]
  );

  // ================= ELECTIONS =================
  const createElection = useCallback(
    (input) => {
      const normalizedInput = {
        ...input,
        name: input.name || input.title,
        type: input.type || input.electionType,
        pollingStartDate: input.pollingStartDate || input.pollingDate,
        pollingEndDate: input.pollingEndDate || input.pollingDate,
      };
      const result = createElectionRecord(
        normalizedInput,
        store.elections,
        store.constituencies
      );
      if (!result.ok) {
        return {
          ...result,
          errors: Array.isArray(result.errors)
            ? result.errors
            : Object.values(result.errors || {}),
        };
      }
      const enriched = enrichElection(result.election);
      const next = [enriched, ...store.elections];
      syncKey(STORAGE_KEYS.ELECTIONS, 'elections', next);
      return { ok: true, election: enriched };
    },
    [store.elections, store.constituencies, syncKey]
  );

  const updateElection = useCallback(
    (electionId, updates) => {
      const normalizedUpdates = {
        ...updates,
        name: updates.name || updates.title,
        type: updates.type || updates.electionType,
        pollingStartDate: updates.pollingStartDate || updates.pollingDate,
        pollingEndDate: updates.pollingEndDate || updates.pollingDate,
      };
      const result = updateElectionRecord(
        electionId,
        normalizedUpdates,
        store.elections,
        store.constituencies
      );
      if (!result.ok) {
        return {
          ...result,
          errors: Array.isArray(result.errors)
            ? result.errors
            : Object.values(result.errors || {}),
        };
      }
      const enriched = enrichElection(result.election);
      const next = store.elections.map((e) =>
        (e.id || e.electionId) === electionId ? enriched : e
      );
      syncKey(STORAGE_KEYS.ELECTIONS, 'elections', next);
      return { ok: true, election: enriched };
    },
    [store.elections, store.constituencies, syncKey]
  );

  const setElectionStatus = useCallback(
    (electionId, status) => {
      const next = store.elections.map((e) =>
        (e.id || e.electionId) === electionId ? { ...e, status } : e
      );
      syncKey(STORAGE_KEYS.ELECTIONS, 'elections', next);
      return { ok: true };
    },
    [store.elections, syncKey]
  );

  const deleteElection = useCallback(
    (electionId) => {
      const next = store.elections.filter(
        (e) => (e.id || e.electionId) !== electionId
      );
      syncKey(STORAGE_KEYS.ELECTIONS, 'elections', next);
      return { ok: true };
    },
    [store.elections, syncKey]
  );

  // ================= STATES & DISTRICTS =================
  const updateStateRecord = useCallback(
    (stateId, updates) => {
      const next = store.states.map((s) =>
        (s.id || s.stateId) === stateId ? { ...s, ...updates } : s
      );
      syncKey(STORAGE_KEYS.STATES, 'states', next);
      return { ok: true };
    },
    [store.states, syncKey]
  );

  const upsertState = useCallback(
    (stateObj) => {
      const targetId = stateObj.stateId || stateObj.id;
      const next = store.states.map((s) =>
        (s.id || s.stateId) === targetId
          ? {
              ...s,
              ...stateObj,
              id: targetId,
              name: stateObj.stateName || stateObj.name || s.name,
            }
          : s
      );
      syncKey(STORAGE_KEYS.STATES, 'states', next);
      return stateObj;
    },
    [store.states, syncKey]
  );

  const createDistrict = useCallback(
    (input) => {
      const dName = input.name || input.districtName;
      if (!dName || !dName.trim() || !input.stateId) {
        return {
          ok: false,
          errors: { name: 'District name and State are required.' },
        };
      }
      const slug = dName
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-');
      let id = input.districtId || input.id || `${input.stateId}-DIST-${slug}`;
      let counter = 2;
      while (store.districts.some((d) => (d.id || d.districtId) === id)) {
        id = `${input.stateId}-DIST-${slug}-${counter}`;
        counter += 1;
      }
      const record = enrichDistrict({
        id,
        name: dName.trim(),
        stateId: input.stateId,
        districtCode: input.districtCode || id,
        headquarters: input.headquarters || dName.trim(),
        metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
      });
      const next = [...store.districts, record];
      syncKey(STORAGE_KEYS.DISTRICTS, 'districts', next);
      return { ok: true, district: record };
    },
    [store.districts, syncKey]
  );

  const upsertDistrict = useCallback(
    (input) => {
      const targetId = input.districtId || input.id;
      const exists = store.districts.some(
        (d) => (d.id || d.districtId) === targetId
      );
      if (exists) {
        const updated = enrichDistrict({
          ...input,
          id: targetId,
          name: input.districtName || input.name,
        });
        const next = store.districts.map((d) =>
          (d.id || d.districtId) === targetId ? updated : d
        );
        syncKey(STORAGE_KEYS.DISTRICTS, 'districts', next);
        return updated;
      }
      const res = createDistrict(input);
      return res.district || input;
    },
    [store.districts, syncKey, createDistrict]
  );

  const updateDistrict = useCallback(
    (districtId, updates) => {
      const next = store.districts.map((d) =>
        (d.id || d.districtId) === districtId ? { ...d, ...updates } : d
      );
      syncKey(STORAGE_KEYS.DISTRICTS, 'districts', next);
      return { ok: true };
    },
    [store.districts, syncKey]
  );

  const deleteDistrict = useCallback(
    (districtId) => {
      const next = store.districts.filter(
        (d) => (d.id || d.districtId) !== districtId
      );
      syncKey(STORAGE_KEYS.DISTRICTS, 'districts', next);
      return { ok: true };
    },
    [store.districts, syncKey]
  );

  // ================= CONSTITUENCIES =================
  const createConstituency = useCallback(
    (input) => {
      const normalizedInput = {
        ...input,
        type: input.type || input.constituencyType,
      };
      const result = createConstituencyRecord(
        normalizedInput,
        store.states,
        store.districts,
        store.constituencies
      );
      if (!result.ok) {
        return {
          ...result,
          errors: Array.isArray(result.errors)
            ? result.errors
            : Object.values(result.errors || {}),
        };
      }
      const enriched = enrichConstituency({
        ...result.constituency,
        code: input.code || result.constituency.id,
        reservationType: input.reservationType || 'GENERAL',
      });
      const next = [...store.constituencies, enriched];
      syncKey(STORAGE_KEYS.CONSTITUENCIES, 'constituencies', next);
      return { ok: true, constituency: enriched };
    },
    [store.states, store.districts, store.constituencies, syncKey]
  );

  const updateConstituency = useCallback(
    (constituencyId, updates) => {
      const normalizedUpdates = {
        ...updates,
        type: updates.type || updates.constituencyType,
      };
      const result = updateConstituencyRecord(
        constituencyId,
        normalizedUpdates,
        store.states,
        store.districts,
        store.constituencies
      );
      if (!result.ok) {
        return {
          ...result,
          errors: Array.isArray(result.errors)
            ? result.errors
            : Object.values(result.errors || {}),
        };
      }
      const enriched = enrichConstituency(result.constituency);
      const next = store.constituencies.map((c) =>
        (c.id || c.constituencyId) === constituencyId ? enriched : c
      );
      syncKey(STORAGE_KEYS.CONSTITUENCIES, 'constituencies', next);
      return { ok: true, constituency: enriched };
    },
    [store.states, store.districts, store.constituencies, syncKey]
  );

  const deleteConstituency = useCallback(
    (constituencyId) => {
      const next = store.constituencies.filter(
        (c) => (c.id || c.constituencyId) !== constituencyId
      );
      syncKey(STORAGE_KEYS.CONSTITUENCIES, 'constituencies', next);
      return { ok: true };
    },
    [store.constituencies, syncKey]
  );

  // ================= POLITICAL PARTIES =================
  const createParty = useCallback(
    (input) => {
      const pName = input.name || input.partyName;
      if (!pName || !pName.trim() || !input.abbreviation || !input.abbreviation.trim()) {
        return {
          ok: false,
          errors: ['Party name and abbreviation are required.'],
        };
      }
      const abbr = input.abbreviation.trim().toUpperCase();
      let id = input.partyId || input.id || `PARTY-${abbr}`;
      let counter = 2;
      while (store.parties.some((p) => (p.id || p.partyId) === id)) {
        id = `PARTY-${abbr}-${counter}`;
        counter += 1;
      }
      const record = enrichParty({
        id,
        name: pName.trim(),
        abbreviation: abbr,
        symbol: input.symbol || input.symbolUrl || eciLogo,
        symbolName: input.symbolName || `${abbr} Symbol`,
        type: input.type || input.partyType || 'STATE',
        description: input.description ? input.description.trim() : '',
        status: input.status || 'ACTIVE',
        metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
      });
      const next = [...store.parties, record];
      syncKey(STORAGE_KEYS.PARTIES, 'parties', next);
      return { ok: true, party: record };
    },
    [store.parties, syncKey]
  );

  const upsertParty = useCallback(
    (input) => {
      const targetId = input.partyId || input.id;
      const exists = store.parties.some((p) => (p.id || p.partyId) === targetId);
      if (exists) {
        const updated = enrichParty({
          ...input,
          id: targetId,
          name: input.partyName || input.name,
          symbol: input.symbolUrl || input.symbol,
          type: input.partyType || input.type,
        });
        const next = store.parties.map((p) =>
          (p.id || p.partyId) === targetId ? updated : p
        );
        syncKey(STORAGE_KEYS.PARTIES, 'parties', next);
        return updated;
      }
      const res = createParty(input);
      return res.party || enrichParty(input);
    },
    [store.parties, syncKey, createParty]
  );

  const updateParty = useCallback(
    (partyId, updates) => {
      const next = store.parties.map((p) =>
        (p.id || p.partyId) === partyId ? enrichParty({ ...p, ...updates }) : p
      );
      syncKey(STORAGE_KEYS.PARTIES, 'parties', next);
      return { ok: true };
    },
    [store.parties, syncKey]
  );

  // ================= CANDIDATES =================
  const createCandidate = useCallback(
    (input) => {
      const normalizedInput = {
        ...input,
        photograph: input.photograph || input.photoUrl || defaultAvatar,
        manifesto: input.manifesto || input.manifestoSummary || '',
        status: input.status || input.approvalStatus || 'APPROVED',
      };
      const result = createCandidateRecord(
        normalizedInput,
        store.elections,
        store.constituencies,
        store.parties,
        store.candidates
      );
      if (!result.ok) {
        return {
          ...result,
          errors: Array.isArray(result.errors)
            ? result.errors
            : Object.values(result.errors || {}),
        };
      }
      const enriched = enrichCandidate(
        { ...normalizedInput, ...result.candidate },
        store.candidates.length,
        enrichedConstituencies
      );
      const next = [...store.candidates, enriched];
      syncKey(STORAGE_KEYS.CANDIDATES, 'candidates', next);
      return { ok: true, candidate: enriched };
    },
    [
      store.elections,
      store.constituencies,
      store.parties,
      store.candidates,
      enrichedConstituencies,
      syncKey,
    ]
  );

  const updateCandidate = useCallback(
    (candidateId, updates) => {
      const normalizedUpdates = {
        ...updates,
        photograph: updates.photograph || updates.photoUrl,
        manifesto: updates.manifesto || updates.manifestoSummary,
        status: updates.status || updates.approvalStatus,
      };
      const result = updateCandidateRecord(
        candidateId,
        normalizedUpdates,
        store.elections,
        store.constituencies,
        store.parties,
        store.candidates
      );
      if (!result.ok) {
        return {
          ...result,
          errors: Array.isArray(result.errors)
            ? result.errors
            : Object.values(result.errors || {}),
        };
      }
      const enriched = enrichCandidate(
        { ...normalizedUpdates, ...result.candidate },
        0,
        enrichedConstituencies
      );
      const next = store.candidates.map((c) =>
        (c.id || c.candidateId) === candidateId ? enriched : c
      );
      syncKey(STORAGE_KEYS.CANDIDATES, 'candidates', next);
      return { ok: true, candidate: enriched };
    },
    [
      store.elections,
      store.constituencies,
      store.parties,
      store.candidates,
      enrichedConstituencies,
      syncKey,
    ]
  );

  const deleteCandidate = useCallback(
    (candidateId) => {
      const next = store.candidates.filter(
        (c) => (c.id || c.candidateId) !== candidateId
      );
      syncKey(STORAGE_KEYS.CANDIDATES, 'candidates', next);
      return { ok: true };
    },
    [store.candidates, syncKey]
  );

  // ================= VOTERS & PARTICIPATION =================
  const registerVoter = useCallback(
    (input) => {
      const result = registerVoterRecord(
        input,
        store.voters,
        store.states,
        store.districts,
        store.constituencies
      );
      if (!result.ok) return result;

      const next = [...store.voters, result.voter];
      syncKey(STORAGE_KEYS.VOTERS, 'voters', next);

      addVoterNotification({
        type: NOTIFICATION_TYPES.PROFILE_UPDATE,
        title: `Demo Voter Registered: ${result.voter.fullName}`,
        message: `Assigned to Parliamentary Constituency ${result.voter.parliamentaryConstituencyId} and Assembly Constituency ${result.voter.assemblyConstituencyId}.`,
      });

      return result;
    },
    [
      store.voters,
      store.states,
      store.districts,
      store.constituencies,
      syncKey,
      addVoterNotification,
    ]
  );

  const updateVoterProfile = useCallback(
    (voterId, updates, options = {}) => {
      const result = updateVoterProfileRecord(
        voterId,
        updates,
        store.voters,
        store.states,
        store.districts,
        store.constituencies,
        options
      );
      if (!result.ok) return result;

      const next = store.voters.map((v) =>
        (v.id || v.voterId) === voterId ? result.voter : v
      );
      syncKey(STORAGE_KEYS.VOTERS, 'voters', next);

      addVoterNotification({
        type: NOTIFICATION_TYPES.PROFILE_UPDATE,
        title: 'Demo Voter Profile Updated',
        message: `Profile changes saved locally for ${result.voter.fullName} (${result.voter.epicReference}).`,
      });

      return result;
    },
    [
      store.voters,
      store.states,
      store.districts,
      store.constituencies,
      syncKey,
      addVoterNotification,
    ]
  );

  const castSimulatedVote = useCallback(
    ({ voterId, electionId, constituencyId, selectedCandidateIdOrNota }) => {
      const targetVoter = store.voters.find(
        (v) => (v.id || v.voterId) === voterId
      );
      if (!targetVoter) {
        return { ok: false, error: 'Voter profile not found.' };
      }

      const result = recordSimulatedParticipation({
        voter: targetVoter,
        electionId,
        constituencyId,
        selectedCandidateIdOrNota,
        tallies: store.tallies,
      });

      if (!result.ok) return result;

      const nextVoters = store.voters.map((v) =>
        (v.id || v.voterId) === voterId ? enrichVoter(result.voter) : v
      );
      storageService.setDurableItem(STORAGE_KEYS.VOTERS, nextVoters);
      storageService.setDurableItem(STORAGE_KEYS.TALLIES, result.tallies);

      setStore((prev) => ({
        ...prev,
        voters: nextVoters,
        tallies: result.tallies,
      }));

      return { ok: true, voter: enrichVoter(result.voter) };
    },
    [store.voters, store.tallies]
  );

  // Phase 3 helper: Simulate participation status for one election without ballot submission
  const simulateElectionParticipationStatus = useCallback(
    (voterId, electionId) => {
      const targetVoter = store.voters.find(
        (v) => (v.id || v.voterId) === voterId
      );
      if (!targetVoter) {
        return { ok: false, error: 'Voter profile not found.' };
      }
      const targetElection = store.elections.find(
        (e) => (e.id || e.electionId) === electionId
      );
      const result = recordSimulatedParticipation({
        voter: targetVoter,
        electionId,
        election: targetElection,
        tallies: store.tallies,
      });
      if (!result.ok) return result;

      const nextVoters = store.voters.map((v) =>
        (v.id || v.voterId) === voterId ? enrichVoter(result.voter) : v
      );
      syncKey(STORAGE_KEYS.VOTERS, 'voters', nextVoters);

      addVoterNotification({
        type: NOTIFICATION_TYPES.ELECTION_REMINDER,
        title: `Participation Status Updated (${electionId})`,
        message: `Demo participation status for ${
          targetElection?.name || electionId
        } marked as VOTED. Other eligible elections remain unchanged.`,
      });

      return {
        ok: true,
        voter: enrichVoter(result.voter),
        referenceId: result.referenceId,
      };
    },
    [store.voters, store.elections, store.tallies, syncKey, addVoterNotification]
  );

  // ================= FEEDBACK & RESET =================
  const addFeedback = useCallback(
    (input) => {
      const nowIso = new Date().toISOString();
      const record = {
        id: `FB-${Date.now()}`,
        name: input.name.trim(),
        email: input.email.trim(),
        stateId: input.stateId || 'WB',
        category: input.category || 'General Portal Feedback',
        rating: input.rating || '5',
        message: input.message.trim(),
        createdAt: nowIso,
        submittedAt: nowIso,
      };
      const next = [record, ...(store.feedback || [])];
      syncKey(STORAGE_KEYS.FEEDBACK, 'feedback', next);
      return { ok: true, feedback: record };
    },
    [store.feedback, syncKey]
  );

  const resetDemoData = useCallback(() => {
    const fresh = storageService.resetAllDemoData();
    setStore(fresh);
    return fresh;
  }, []);

  const normalizedFeedbacks = useMemo(
    () =>
      (store.feedback || []).map((f) => ({
        ...f,
        submittedAt: f.submittedAt || f.createdAt || new Date().toISOString(),
        stateId: f.stateId || 'IN',
        rating: f.rating || '5',
      })),
    [store.feedback]
  );

  const recentCandidateObjects = useMemo(() => {
    const ids = store.recentCandidates || [];
    return ids
      .map((id) =>
        enrichedCandidates.find((c) => (c.id || c.candidateId) === id)
      )
      .filter(Boolean);
  }, [store.recentCandidates, enrichedCandidates]);

  return (
    <ElectionContext.Provider
      value={{
        ...store,
        states: enrichedStates,
        districts: enrichedDistricts,
        constituencies: enrichedConstituencies,
        parties: enrichedParties,
        elections: enrichedElections,
        candidates: enrichedCandidates,
        voters: enrichedVoters,
        tallies: normalizedTallies,
        voterNotifications,
        recentCandidates: recentCandidateObjects,
        feedback: normalizedFeedbacks,
        feedbacks: normalizedFeedbacks,
        createElection,
        updateElection,
        setElectionStatus,
        deleteElection,
        updateStateRecord,
        upsertState,
        createDistrict,
        upsertDistrict,
        updateDistrict,
        deleteDistrict,
        createConstituency,
        updateConstituency,
        deleteConstituency,
        createParty,
        upsertParty,
        updateParty,
        createCandidate,
        updateCandidate,
        deleteCandidate,
        registerVoter,
        updateVoterProfile,
        castSimulatedVote,
        simulateElectionParticipationStatus,
        addVoterNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearAllNotifications,
        recordCandidateView,
        addFeedback,
        submitFeedback: addFeedback,
        resetDemoData,
        resetDemoEnvironment: resetDemoData,
      }}
    >
      {children}
    </ElectionContext.Provider>
  );
}

export function useElection() {
  const ctx = useContext(ElectionContext);
  if (!ctx) {
    throw new Error('useElection must be used within an ElectionProvider');
  }
  return ctx;
}
