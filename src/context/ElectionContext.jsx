import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  STORAGE_KEYS,
  METADATA_SOURCES,
  NOTIFICATION_TYPES,
  ELECTION_TYPES,
  RESULT_STATUSES,
} from '../utils/constants';
import { countingService } from '../services/countingService';
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
import {
  validateElectionStatusTransition,
  validateCandidateStatusTransition,
  checkConstituencyModificationImpact,
  canDeleteParty,
  validateElectionSchedule,
  detectScheduleConflicts,
  createSanitizedAuditLogEntry,
} from '../services/adminPermissionService';
import { auditElectionDataIntegrity } from '../services/dataIntegrityService';

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
  const scrutinyDate =
    e.scrutinyDate || e.schedule?.scrutinyDate || nominationEnd;
  const withdrawalDeadline =
    e.withdrawalDeadline || e.schedule?.withdrawalDeadline || scrutinyDate;
  const pollStart =
    e.pollingStartDate || e.pollingDate || e.schedule?.pollingDate || '2029-04-15';
  const pollEnd = e.pollingEndDate || pollStart;
  const countingDate =
    e.countingDate || e.resultDate || e.schedule?.countingDate || '2029-05-20';
  const resultDate = e.resultDate || countingDate || '2029-05-23';

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
    nominationStartDate: nominationStart,
    nominationEndDate: nominationEnd,
    scrutinyDate,
    withdrawalDeadline,
    pollingDate: pollStart,
    pollingStartDate: pollStart,
    pollingEndDate: pollEnd,
    countingDate,
    resultDate,
    lifecycleHistory: Array.isArray(e.lifecycleHistory) ? e.lifecycleHistory : [],
    schedule: {
      gazetteNotification: nominationStart,
      nominationClose: nominationEnd,
      scrutinyDate,
      withdrawalDeadline,
      pollingDate: pollStart,
      pollingEndDate: pollEnd,
      countingDate,
      resultDate,
      ...(e.schedule || {}),
    },
  };
}

function enrichCandidate(c, index, constituencies, tallies = {}) {
  const id = c.id || c.candidateId;
  const photo = c.photograph || c.photoUrl || defaultAvatar;
  const status = c.status || c.approvalStatus || 'APPROVED';
  const constObj = constituencies.find(
    (ct) => (ct.id || ct.constituencyId) === c.constituencyId
  );
  const flatKey = `${c.electionId}::${c.constituencyId}::${id}`;
  const tallyCount =
    c.demoVotes !== undefined
      ? Number(c.demoVotes)
      : tallies?.[flatKey] !== undefined
      ? Number(tallies[flatKey])
      : tallies?.[c.electionId]?.[c.constituencyId]?.[id] !== undefined
      ? Number(tallies[c.electionId][c.constituencyId][id])
      : 0;

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
    publicDeclaration: c.publicDeclaration || '',
    demoVotes: tallyCount,
    createdAt: c.createdAt || '2026-02-10T10:00:00.000Z',
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

  const enrichedCandidates = useMemo(
    () =>
      (store.candidates || []).map((c, idx) =>
        enrichCandidate(c, idx, enrichedConstituencies, normalizedTallies)
      ),
    [store.candidates, enrichedConstituencies, normalizedTallies]
  );

  const enrichedVoters = useMemo(
    () => (store.voters || []).map(enrichVoter),
    [store.voters]
  );

  const participationRecords = useMemo(() => {
    const records = [];
    for (const voter of enrichedVoters) {
      const voterId = voter.id || voter.voterId;
      const electionsMap = voter.elections || {};
      for (const [electionId, entry] of Object.entries(electionsMap)) {
        if (!entry || typeof entry !== 'object') continue;
        const matchedElection = enrichedElections.find(
          (e) => (e.id || e.electionId) === electionId
        );
        const electionType =
          matchedElection?.electionType ||
          (String(electionId).startsWith('LS-')
            ? ELECTION_TYPES.LOK_SABHA
            : ELECTION_TYPES.STATE_ASSEMBLY);
        const constituencyId =
          electionType === ELECTION_TYPES.LOK_SABHA
            ? voter.parliamentaryConstituencyId
            : voter.assemblyConstituencyId;
        const status =
          entry.status || (entry.hasVoted ? 'VOTED' : 'PENDING');

        records.push({
          id: `${voterId}-${electionId}`,
          voterId,
          voterRef: voter.voterRef || voter.epicRef,
          electionId,
          electionType,
          stateId: voter.stateId,
          districtId: voter.districtId,
          parliamentaryConstituencyId: voter.parliamentaryConstituencyId,
          assemblyConstituencyId: voter.assemblyConstituencyId,
          constituencyId,
          status,
          participatedAt: entry.participatedAt || entry.timestamp || null,
          referenceId: entry.referenceId || entry.receiptId || null,
        });
      }
    }
    return records;
  }, [enrichedVoters, enrichedElections]);

  // ================= AUDIT LOGS (APPEND-ONLY) =================
  const auditLogs = useMemo(
    () =>
      (store.auditLogs || []).map((l) => ({
        ...l,
        actionType: l.actionType || l.action || 'ADMIN_ACTION',
        action: l.action || l.actionType || 'ADMIN_ACTION',
        targetEntity: l.targetEntity || l.entityType || 'SYSTEM',
        entityType: l.entityType || l.targetEntity || 'SYSTEM',
        targetId: l.targetId || l.entityId || 'GLOBAL',
        entityId: l.entityId || l.targetId || 'GLOBAL',
        summary: l.summary || l.description || '',
        description: l.description || l.summary || '',
        adminName: l.adminName || l.adminId || 'ECI Officer',
        adminRole: l.adminRole || 'SUPER_ADMIN',
      })),
    [store.auditLogs]
  );

  const appendAuditLog = useCallback(
    (payload) => {
      const entry = createSanitizedAuditLogEntry({
        ...payload,
        existingLogs: store.auditLogs || [],
      });
      const next = [entry, ...(store.auditLogs || [])];
      syncKey(STORAGE_KEYS.AUDIT_LOGS, 'auditLogs', next);
      return entry;
    },
    [store.auditLogs, syncKey]
  );

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
        targetElectionId: payload.targetElectionId || null,
        targetConstituencyId: payload.targetConstituencyId || null,
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
  const [demoLifecycleMode, setDemoLifecycleMode] = useState(false);

  const createElection = useCallback(
    (input, actor = {}) => {
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
          fieldErrors: result.errors,
        };
      }
      const enriched = enrichElection(result.election);
      const next = [enriched, ...store.elections];
      syncKey(STORAGE_KEYS.ELECTIONS, 'elections', next);

      appendAuditLog({
        action: 'ELECTION_CREATED',
        entityType: 'ELECTION',
        entityId: enriched.electionId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Created ${enriched.electionType} election "${enriched.title}" (${enriched.electionId}).`,
      });

      return { ok: true, election: enriched };
    },
    [store.elections, store.constituencies, syncKey, appendAuditLog]
  );

  const updateElection = useCallback(
    (electionId, updates, actor = {}) => {
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
          fieldErrors: result.errors,
        };
      }
      const enriched = enrichElection(result.election);
      const next = store.elections.map((e) =>
        (e.id || e.electionId) === electionId ? enriched : e
      );
      syncKey(STORAGE_KEYS.ELECTIONS, 'elections', next);

      appendAuditLog({
        action: 'ELECTION_UPDATED',
        entityType: 'ELECTION',
        entityId: electionId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Updated configuration for election "${enriched.title}" (${electionId}).`,
      });

      return { ok: true, election: enriched };
    },
    [store.elections, store.constituencies, syncKey, appendAuditLog]
  );

  const transitionElectionStatus = useCallback(
    (electionId, nextStatus, options = {}) => {
      const target = store.elections.find(
        (e) => (e.id || e.electionId) === electionId
      );
      if (!target) {
        return { ok: false, error: 'Election not found.' };
      }

      const check = validateElectionStatusTransition({
        currentStatus: target.status,
        nextStatus,
        confirmCancel: Boolean(
          options.confirmCancel || options.confirmCancellation
        ),
        demoLifecycleOverride:
          options.demoLifecycleOverride !== undefined
            ? options.demoLifecycleOverride
            : options.demoLifecycleMode !== undefined
            ? options.demoLifecycleMode
            : demoLifecycleMode,
      });

      if (!check.ok) {
        return check;
      }

      const historyEntry = {
        status: check.status,
        previousStatus: target.status,
        changedAt: new Date().toISOString(),
        note:
          options.note ||
          `Transitioned from ${target.status} to ${check.status}`,
      };

      const nextElections = store.elections.map((e) =>
        (e.id || e.electionId) === electionId
          ? enrichElection({
              ...e,
              status: check.status,
              lifecycleHistory: [
                historyEntry,
                ...(Array.isArray(e.lifecycleHistory)
                  ? e.lifecycleHistory
                  : []),
              ],
            })
          : e
      );
      syncKey(STORAGE_KEYS.ELECTIONS, 'elections', nextElections);

      const adminActor = options.currentAdmin || options;
      appendAuditLog({
        action: 'ELECTION_STATUS_CHANGED',
        entityType: 'ELECTION',
        entityId: electionId,
        adminId: adminActor.adminId || adminActor.id || 'ECI-ADMIN-001',
        adminName: adminActor.fullName || adminActor.name,
        adminRole: adminActor.adminRole || adminActor.role || 'SUPER_ADMIN',
        description: `Changed election ${electionId} status from ${target.status} to ${check.status}.`,
      });

      return { ok: true, status: check.status };
    },
    [store.elections, demoLifecycleMode, syncKey, appendAuditLog]
  );

  const setElectionStatus = useCallback(
    (electionId, status, options = {}) => {
      return transitionElectionStatus(electionId, status, {
        ...options,
        confirmCancel: true,
        demoLifecycleOverride:
          options.enforceStrictTransitions === true
            ? Boolean(options.demoLifecycleOverride)
            : true,
      });
    },
    [transitionElectionStatus]
  );

  const duplicateElectionAsDraft = useCallback(
    (electionId, actor = {}) => {
      const source = store.elections.find(
        (e) => (e.id || e.electionId) === electionId
      );
      if (!source) {
        return { ok: false, error: 'Source election not found.' };
      }

      const baseId = `${source.id || source.electionId}-DRAFT`;
      let nextId = baseId;
      let seq = 2;
      while (store.elections.some((e) => (e.id || e.electionId) === nextId)) {
        nextId = `${baseId}-${seq}`;
        seq += 1;
      }

      const draftCopy = enrichElection({
        ...source,
        id: nextId,
        electionId: nextId,
        name: `${source.name || source.title} (Draft Copy)`,
        title: `${source.name || source.title} (Draft Copy)`,
        status: 'DRAFT',
        lifecycleHistory: [
          {
            status: 'DRAFT',
            changedAt: new Date().toISOString(),
            note: `Duplicated as draft from ${electionId}`,
          },
        ],
      });

      const next = [draftCopy, ...store.elections];
      syncKey(STORAGE_KEYS.ELECTIONS, 'elections', next);

      appendAuditLog({
        action: 'ELECTION_CREATED',
        entityType: 'ELECTION',
        entityId: nextId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Duplicated election ${electionId} as new draft ${nextId}.`,
      });

      return { ok: true, election: draftCopy };
    },
    [store.elections, syncKey, appendAuditLog]
  );

  const updateElectionSchedule = useCallback(
    (electionId, scheduleUpdates, options = {}) => {
      const target = store.elections.find(
        (e) => (e.id || e.electionId) === electionId
      );
      if (!target) {
        return { ok: false, error: 'Election not found.' };
      }

      const isActiveElection =
        target.status === 'POLLING_ACTIVE' || target.status === 'ACTIVE';
      if (
        isActiveElection &&
        !options.confirmedActiveChange &&
        !options.confirmActiveScheduleChange
      ) {
        return {
          ok: false,
          requiresConfirmation: true,
          error:
            'Modifying the schedule of an active election requires explicit administrative confirmation.',
        };
      }

      const mergedSchedule = {
        nominationStartDate:
          scheduleUpdates.nominationStartDate ?? target.nominationStartDate,
        nominationEndDate:
          scheduleUpdates.nominationEndDate ?? target.nominationEndDate,
        scrutinyDate: scheduleUpdates.scrutinyDate ?? target.scrutinyDate,
        withdrawalDeadline:
          scheduleUpdates.withdrawalDeadline ?? target.withdrawalDeadline,
        pollingStartDate:
          scheduleUpdates.pollingStartDate ??
          scheduleUpdates.pollingDate ??
          target.pollingStartDate,
        pollingEndDate:
          scheduleUpdates.pollingEndDate ??
          scheduleUpdates.pollingStartDate ??
          target.pollingEndDate,
        countingDate: scheduleUpdates.countingDate ?? target.countingDate,
        resultDate: scheduleUpdates.resultDate ?? target.resultDate,
      };

      const check = validateElectionSchedule(mergedSchedule);
      if (!check.isValid) {
        return {
          ok: false,
          errors: Object.values(check.errors),
          fieldErrors: check.errors,
        };
      }

      const updatedElection = enrichElection({
        ...target,
        ...mergedSchedule,
        pollingDate: mergedSchedule.pollingStartDate,
      });

      const conflicts = detectScheduleConflicts(
        updatedElection,
        store.elections
      );

      const next = store.elections.map((e) =>
        (e.id || e.electionId) === electionId ? updatedElection : e
      );
      syncKey(STORAGE_KEYS.ELECTIONS, 'elections', next);

      appendAuditLog({
        action: 'SCHEDULE_MODIFIED',
        entityType: 'SCHEDULE',
        entityId: electionId,
        adminId: options.adminId || 'ECI-ADMIN-001',
        adminRole: options.adminRole || 'SUPER_ADMIN',
        description: `Modified election schedule for ${electionId} (Polling: ${mergedSchedule.pollingStartDate} to ${mergedSchedule.pollingEndDate}).`,
      });

      return {
        ok: true,
        election: updatedElection,
        conflicts,
      };
    },
    [store.elections, syncKey, appendAuditLog]
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
    (stateObj, actor = {}) => {
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

      appendAuditLog({
        action: 'STATE_UPDATED',
        entityType: 'STATE',
        entityId: targetId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Updated State/UT record for ${targetId}.`,
      });

      return stateObj;
    },
    [store.states, syncKey, appendAuditLog]
  );

  const createDistrict = useCallback(
    (input, actor = {}) => {
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
        status: input.status || 'ACTIVE',
        metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
      });
      const next = [...store.districts, record];
      syncKey(STORAGE_KEYS.DISTRICTS, 'districts', next);

      appendAuditLog({
        action: 'DISTRICT_CREATED',
        entityType: 'DISTRICT',
        entityId: id,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Created demo district "${record.name}" (${id}) in ${input.stateId}.`,
      });

      return { ok: true, district: record };
    },
    [store.districts, syncKey, appendAuditLog]
  );

  const upsertDistrict = useCallback(
    (input, actor = {}) => {
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

        appendAuditLog({
          action: 'DISTRICT_UPDATED',
          entityType: 'DISTRICT',
          entityId: targetId,
          adminId: actor.adminId || 'ECI-ADMIN-001',
          adminRole: actor.adminRole || 'SUPER_ADMIN',
          description: `Updated district "${updated.name}" (${targetId}).`,
        });

        return updated;
      }
      const res = createDistrict(input, actor);
      return res.district || input;
    },
    [store.districts, syncKey, createDistrict, appendAuditLog]
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
      const referencedVoters = store.voters.filter(
        (v) => v.districtId === districtId
      );
      const referencedConstituencies = store.constituencies.filter(
        (c) =>
          c.districtId === districtId ||
          (Array.isArray(c.districtIds) && c.districtIds.includes(districtId))
      );
      if (referencedVoters.length > 0 || referencedConstituencies.length > 0) {
        return {
          ok: false,
          error: `Cannot delete district ${districtId}: Referenced by ${referencedConstituencies.length} constituency(ies) and ${referencedVoters.length} voter(s). Deactivate instead.`,
        };
      }
      const next = store.districts.filter(
        (d) => (d.id || d.districtId) !== districtId
      );
      syncKey(STORAGE_KEYS.DISTRICTS, 'districts', next);
      return { ok: true };
    },
    [store.districts, store.voters, store.constituencies, syncKey]
  );

  // ================= CONSTITUENCIES =================
  const checkConstituencyImpact = useCallback(
    (constituencyId, updates = {}) =>
      checkConstituencyModificationImpact({
        constituencyId,
        updates,
        constituencies: store.constituencies,
        voters: store.voters,
        elections: store.elections,
        candidates: store.candidates,
      }),
    [store.constituencies, store.voters, store.elections, store.candidates]
  );

  const createConstituency = useCallback(
    (input, actor = {}) => {
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
          fieldErrors: result.errors,
        };
      }
      const enriched = enrichConstituency({
        ...result.constituency,
        code: input.code || result.constituency.id,
        reservationType: input.reservationType || 'GENERAL',
        status: input.status || 'ACTIVE',
      });
      const next = [...store.constituencies, enriched];
      syncKey(STORAGE_KEYS.CONSTITUENCIES, 'constituencies', next);

      appendAuditLog({
        action: 'CONSTITUENCY_CREATED',
        entityType: 'CONSTITUENCY',
        entityId: enriched.constituencyId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Created ${enriched.constituencyType} constituency "${enriched.name}" (${enriched.constituencyId}).`,
      });

      return { ok: true, constituency: enriched };
    },
    [store.states, store.districts, store.constituencies, syncKey, appendAuditLog]
  );

  const updateConstituency = useCallback(
    (constituencyId, updates, options = {}) => {
      const impact = checkConstituencyImpact(constituencyId, updates);
      if (impact.hasImpact && options.requireImpactConfirmation && !options.confirmedWarning) {
        return {
          ok: false,
          requiresConfirmation: true,
          impact,
          errors: impact.warnings,
        };
      }

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
          fieldErrors: result.errors,
        };
      }
      const enriched = enrichConstituency({
        ...result.constituency,
        status: updates.status || result.constituency.status || 'ACTIVE',
      });
      // Preserve voter constituency mappings untouched (never silently mutate voter mappings)
      const next = store.constituencies.map((c) =>
        (c.id || c.constituencyId) === constituencyId ? enriched : c
      );
      syncKey(STORAGE_KEYS.CONSTITUENCIES, 'constituencies', next);

      appendAuditLog({
        action: 'CONSTITUENCY_UPDATED',
        entityType: 'CONSTITUENCY',
        entityId: constituencyId,
        adminId: options.adminId || 'ECI-ADMIN-001',
        adminRole: options.adminRole || 'SUPER_ADMIN',
        description: `Updated constituency "${enriched.name}" (${constituencyId}).`,
      });

      return { ok: true, constituency: enriched, impact };
    },
    [
      store.states,
      store.districts,
      store.constituencies,
      checkConstituencyImpact,
      syncKey,
      appendAuditLog,
    ]
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
    (input, actor = {}) => {
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
        symbolName: input.symbolName || `${abbr} Symbol (Demo Placeholder)`,
        type: input.type || input.partyType || 'STATE',
        description: input.description ? input.description.trim() : '',
        status: input.status || 'ACTIVE',
        metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
      });
      const next = [...store.parties, record];
      syncKey(STORAGE_KEYS.PARTIES, 'parties', next);

      appendAuditLog({
        action: 'PARTY_CREATED',
        entityType: 'PARTY',
        entityId: id,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Registered political party "${record.name}" (${abbr}).`,
      });

      return { ok: true, party: record };
    },
    [store.parties, syncKey, appendAuditLog]
  );

  const upsertParty = useCallback(
    (input, actor = {}) => {
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

        appendAuditLog({
          action: 'PARTY_UPDATED',
          entityType: 'PARTY',
          entityId: targetId,
          adminId: actor.adminId || 'ECI-ADMIN-001',
          adminRole: actor.adminRole || 'SUPER_ADMIN',
          description: `Updated political party "${updated.name}" (${targetId}).`,
        });

        return updated;
      }
      const res = createParty(input, actor);
      return res.party || enrichParty(input);
    },
    [store.parties, syncKey, createParty, appendAuditLog]
  );

  const updateParty = useCallback(
    (partyId, updates, actor = {}) => {
      const next = store.parties.map((p) =>
        (p.id || p.partyId) === partyId ? enrichParty({ ...p, ...updates }) : p
      );
      syncKey(STORAGE_KEYS.PARTIES, 'parties', next);

      appendAuditLog({
        action: 'PARTY_UPDATED',
        entityType: 'PARTY',
        entityId: partyId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Updated party ${partyId} status/metadata.`,
      });

      return { ok: true };
    },
    [store.parties, syncKey, appendAuditLog]
  );

  const deleteParty = useCallback(
    (partyId, actor = {}) => {
      const check = canDeleteParty(partyId, store.candidates);
      if (!check.canDelete) {
        return {
          ok: false,
          error: check.error,
          referencedCount: check.referencedCount,
        };
      }
      const next = store.parties.filter(
        (p) => (p.id || p.partyId) !== partyId
      );
      syncKey(STORAGE_KEYS.PARTIES, 'parties', next);

      appendAuditLog({
        action: 'PARTY_DELETED',
        entityType: 'PARTY',
        entityId: partyId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Deleted unreferenced demo party ${partyId}.`,
      });

      return { ok: true };
    },
    [store.parties, store.candidates, syncKey, appendAuditLog]
  );

  // ================= CANDIDATES =================
  const createCandidate = useCallback(
    (input, actor = {}) => {
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
          fieldErrors: result.errors,
        };
      }
      const enriched = enrichCandidate(
        {
          ...normalizedInput,
          ...result.candidate,
          createdAt: new Date().toISOString(),
        },
        store.candidates.length,
        enrichedConstituencies
      );
      const next = [...store.candidates, enriched];
      syncKey(STORAGE_KEYS.CANDIDATES, 'candidates', next);

      appendAuditLog({
        action: 'CANDIDATE_REGISTERED',
        entityType: 'CANDIDATE',
        entityId: enriched.candidateId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Registered candidate "${enriched.name}" for ${enriched.constituencyId} in ${enriched.electionId} (${enriched.status}).`,
      });

      return { ok: true, candidate: enriched };
    },
    [
      store.elections,
      store.constituencies,
      store.parties,
      store.candidates,
      enrichedConstituencies,
      syncKey,
      appendAuditLog,
    ]
  );

  const updateCandidate = useCallback(
    (candidateId, updates, actor = {}) => {
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
          fieldErrors: result.errors,
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

      appendAuditLog({
        action: 'CANDIDATE_UPDATED',
        entityType: 'CANDIDATE',
        entityId: candidateId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Updated candidate profile for "${enriched.name}" (${candidateId}).`,
      });

      return { ok: true, candidate: enriched };
    },
    [
      store.elections,
      store.constituencies,
      store.parties,
      store.candidates,
      enrichedConstituencies,
      syncKey,
      appendAuditLog,
    ]
  );

  const transitionCandidateStatus = useCallback(
    (candidateId, nextStatus, actor = {}) => {
      const target = store.candidates.find(
        (c) => (c.id || c.candidateId) === candidateId
      );
      if (!target) {
        return { ok: false, error: 'Candidate not found.' };
      }

      const currentStatus = target.status || target.approvalStatus || 'SUBMITTED';
      const check = validateCandidateStatusTransition(currentStatus, nextStatus, {
        demoLifecycleMode:
          actor?.demoLifecycleMode !== undefined
            ? actor.demoLifecycleMode
            : demoLifecycleMode,
      });
      if (!check.ok) {
        return check;
      }

      const updated = enrichCandidate(
        {
          ...target,
          status: nextStatus,
          approvalStatus: nextStatus,
        },
        0,
        enrichedConstituencies,
        normalizedTallies
      );

      const next = store.candidates.map((c) =>
        (c.id || c.candidateId) === candidateId ? updated : c
      );
      syncKey(STORAGE_KEYS.CANDIDATES, 'candidates', next);

      const auditAction =
        nextStatus === 'APPROVED'
          ? 'CANDIDATE_APPROVED'
          : nextStatus === 'REJECTED'
          ? 'CANDIDATE_REJECTED'
          : 'CANDIDATE_STATUS_CHANGED';

      const adminUser = actor?.currentAdmin || actor || {};
      appendAuditLog({
        action: auditAction,
        entityType: 'CANDIDATE',
        entityId: candidateId,
        adminId: adminUser.adminId || adminUser.id || 'ECI-ADMIN-001',
        adminName: adminUser.fullName || adminUser.name,
        adminRole: adminUser.adminRole || adminUser.role || 'SUPER_ADMIN',
        description: `Candidate "${updated.name}" (${candidateId}) status changed from ${currentStatus} to ${nextStatus}.`,
      });

      return { ok: true, candidate: updated };
    },
    [
      store.candidates,
      enrichedConstituencies,
      normalizedTallies,
      demoLifecycleMode,
      syncKey,
      appendAuditLog,
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

  // ================= ANNOUNCEMENTS =================
  const allAnnouncements = useMemo(
    () =>
      (store.announcements || []).map((a) => ({
        ...a,
        id: a.id || `ANN-${Date.now()}`,
        status: a.status || 'PUBLISHED',
        category: a.category || 'GENERAL_INFO',
        targetAudience: a.targetAudience || 'ALL_VOTERS',
        publicationDate: a.publicationDate || a.date || '2026-10-30',
        date: a.publicationDate || a.date || '2026-10-30',
        message: a.message || a.summary || '',
        summary: a.summary || a.message || '',
      })),
    [store.announcements]
  );

  const publishedAnnouncements = useMemo(
    () => allAnnouncements.filter((a) => a.status === 'PUBLISHED'),
    [allAnnouncements]
  );

  const createAnnouncement = useCallback(
    (input, actor = {}) => {
      if (!input.title || !input.title.trim()) {
        return { ok: false, error: 'Announcement title is required.' };
      }
      const msg = (input.message || input.summary || '').trim();
      if (!msg) {
        return { ok: false, error: 'Announcement content/message is required.' };
      }

      const id =
        input.id ||
        `ANN-${String((store.announcements || []).length + 101).padStart(3, '0')}`;
      const pubDate =
        input.publicationDate ||
        input.date ||
        new Date().toISOString().slice(0, 10);
      const status = input.status || 'DRAFT';

      const resolvedStateId = input.targetStateId || input.stateId || null;
      const resolvedElectionId = input.targetElectionId || input.electionId || null;
      const resolvedConstId =
        input.targetConstituencyId || input.constituencyId || null;

      const record = {
        id,
        title: input.title.trim(),
        message: msg,
        summary: msg,
        category: input.category || 'GENERAL_INFO',
        status,
        publicationDate: pubDate,
        date: pubDate,
        expiryDate: input.expiryDate || '2029-12-31',
        targetAudience: input.targetAudience || 'ALL_VOTERS',
        targetStateId: resolvedStateId,
        stateId: resolvedStateId,
        targetElectionId: resolvedElectionId,
        electionId: resolvedElectionId,
        targetConstituencyId: resolvedConstId,
        constituencyId: resolvedConstId,
        createdAt: new Date().toISOString(),
      };

      const next = [record, ...(store.announcements || [])];
      syncKey(STORAGE_KEYS.ANNOUNCEMENTS, 'announcements', next);

      if (status === 'PUBLISHED') {
        addVoterNotification({
          type: NOTIFICATION_TYPES.GENERAL_ANNOUNCEMENT,
          title: record.title,
          message: record.message,
          targetStateId: record.targetStateId,
          targetElectionId: record.targetElectionId,
          targetConstituencyId: record.targetConstituencyId,
        });
      }

      appendAuditLog({
        action:
          status === 'PUBLISHED'
            ? 'ANNOUNCEMENT_PUBLISHED'
            : 'ANNOUNCEMENT_CREATED',
        entityType: 'ANNOUNCEMENT',
        entityId: id,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `${
          status === 'PUBLISHED' ? 'Published' : 'Saved draft'
        } announcement "${record.title}" (${id}).`,
      });

      return { ok: true, announcement: record };
    },
    [store.announcements, syncKey, addVoterNotification, appendAuditLog]
  );

  const updateAnnouncement = useCallback(
    (announcementId, updates, actor = {}) => {
      const target = (store.announcements || []).find(
        (a) => a.id === announcementId
      );
      if (!target) {
        return { ok: false, error: 'Announcement not found.' };
      }

      const msg =
        updates.message !== undefined
          ? updates.message
          : updates.summary !== undefined
          ? updates.summary
          : target.message || target.summary;

      const updated = {
        ...target,
        ...updates,
        message: msg,
        summary: msg,
        date: updates.publicationDate || updates.date || target.date,
      };

      const next = (store.announcements || []).map((a) =>
        a.id === announcementId ? updated : a
      );
      syncKey(STORAGE_KEYS.ANNOUNCEMENTS, 'announcements', next);

      if (target.status !== 'PUBLISHED' && updated.status === 'PUBLISHED') {
        addVoterNotification({
          type: NOTIFICATION_TYPES.GENERAL_ANNOUNCEMENT,
          title: updated.title,
          message: updated.message,
          targetStateId: updated.targetStateId,
          targetElectionId: updated.targetElectionId,
          targetConstituencyId: updated.targetConstituencyId,
        });
      }

      appendAuditLog({
        action:
          updated.status === 'PUBLISHED'
            ? 'ANNOUNCEMENT_PUBLISHED'
            : 'ANNOUNCEMENT_UPDATED',
        entityType: 'ANNOUNCEMENT',
        entityId: announcementId,
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: `Updated announcement "${updated.title}" (${announcementId}) [${updated.status}].`,
      });

      return { ok: true, announcement: updated };
    },
    [store.announcements, syncKey, addVoterNotification, appendAuditLog]
  );

  // ================= RESULTS & COUNTING MANAGEMENT (PHASE 6) =================
  const results = useMemo(() => store.results || [], [store.results]);

  const resultPublications = useMemo(
    () => store.resultPublications || {},
    [store.resultPublications]
  );

  const createCountingSessionForConstituency = useCallback(
    (payload = {}, actor = {}) => {
      const check = countingService.createCountingSession({
        ...payload,
        elections: store.elections,
        constituencies: store.constituencies,
        candidates: store.candidates,
        parties: store.parties,
        existingResults: store.results || [],
      });
      if (!check.ok) return check;

      const nextResults = [check.result, ...(store.results || [])];
      syncKey(STORAGE_KEYS.RESULTS, 'results', nextResults);

      appendAuditLog({
        action: 'COUNTING_SESSION_CREATED',
        entityType: 'RESULT',
        entityId: check.result.id,
        adminId: actor?.adminId || actor?.id || 'ECI-ADMIN-001',
        adminName: actor?.fullName || actor?.name,
        adminRole: actor?.adminRole || actor?.role || 'SUPER_ADMIN',
        description: `Created simulated counting session ${check.result.id} (${check.result.electionId} — ${check.result.constituencyId}).`,
      });

      return { ok: true, result: check.result };
    },
    [
      store.elections,
      store.constituencies,
      store.candidates,
      store.parties,
      store.results,
      syncKey,
      appendAuditLog,
    ]
  );

  const startConstituencyCounting = useCallback(
    (resultId, actor = {}) => {
      const target = (store.results || []).find(
        (r) => (r.id || r.resultId) === resultId
      );
      if (!target) return { ok: false, error: 'Result session not found.' };

      const res = countingService.startCountingSession(target);
      if (!res.ok) return res;

      const nextResults = (store.results || []).map((r) =>
        (r.id || r.resultId) === resultId ? res.result : r
      );
      syncKey(STORAGE_KEYS.RESULTS, 'results', nextResults);

      appendAuditLog({
        action: 'COUNTING_STARTED',
        entityType: 'RESULT',
        entityId: resultId,
        adminId: actor?.adminId || actor?.id || 'ECI-ADMIN-001',
        adminName: actor?.fullName || actor?.name,
        adminRole: actor?.adminRole || actor?.role || 'SUPER_ADMIN',
        description: `Started simulated counting for ${target.constituencyId} in ${target.electionId}.`,
      });

      return res;
    },
    [store.results, syncKey, appendAuditLog]
  );

  const processConstituencyCountingRound = useCallback(
    (resultId, customRoundData = null, actor = {}) => {
      const target = (store.results || []).find(
        (r) => (r.id || r.resultId) === resultId
      );
      if (!target) return { ok: false, error: 'Result session not found.' };

      const res = countingService.processNextCountingRound(
        target,
        customRoundData
      );
      if (!res.ok) return res;

      const nextResults = (store.results || []).map((r) =>
        (r.id || r.resultId) === resultId ? res.result : r
      );
      syncKey(STORAGE_KEYS.RESULTS, 'results', nextResults);

      appendAuditLog({
        action: 'COUNTING_ROUND_PROCESSED',
        entityType: 'RESULT',
        entityId: resultId,
        adminId: actor?.adminId || actor?.id || 'ECI-ADMIN-001',
        adminName: actor?.fullName || actor?.name,
        adminRole: actor?.adminRole || actor?.role || 'SUPER_ADMIN',
        description: `Processed Round ${res.round.roundNumber} for ${target.constituencyId} (${target.electionId}). Cumulative counted: ${res.result.totalCountedVotes} votes.`,
      });

      return res;
    },
    [store.results, syncKey, appendAuditLog]
  );

  const pauseConstituencyCounting = useCallback(
    (resultId, actor = {}) => {
      const target = (store.results || []).find(
        (r) => (r.id || r.resultId) === resultId
      );
      if (!target) return { ok: false, error: 'Result session not found.' };

      const res = countingService.pauseCountingSession(target);
      if (!res.ok) return res;

      const nextResults = (store.results || []).map((r) =>
        (r.id || r.resultId) === resultId ? res.result : r
      );
      syncKey(STORAGE_KEYS.RESULTS, 'results', nextResults);

      appendAuditLog({
        action: 'COUNTING_PAUSED',
        entityType: 'RESULT',
        entityId: resultId,
        adminId: actor?.adminId || actor?.id || 'ECI-ADMIN-001',
        adminName: actor?.fullName || actor?.name,
        adminRole: actor?.adminRole || actor?.role || 'SUPER_ADMIN',
        description: `Paused counting session for ${target.constituencyId} (${target.electionId}) at Round ${target.currentRound}.`,
      });

      return res;
    },
    [store.results, syncKey, appendAuditLog]
  );

  const resumeConstituencyCounting = useCallback(
    (resultId, actor = {}) => {
      const target = (store.results || []).find(
        (r) => (r.id || r.resultId) === resultId
      );
      if (!target) return { ok: false, error: 'Result session not found.' };

      const res = countingService.resumeCountingSession(target);
      if (!res.ok) return res;

      const nextResults = (store.results || []).map((r) =>
        (r.id || r.resultId) === resultId ? res.result : r
      );
      syncKey(STORAGE_KEYS.RESULTS, 'results', nextResults);

      appendAuditLog({
        action: 'COUNTING_RESUMED',
        entityType: 'RESULT',
        entityId: resultId,
        adminId: actor?.adminId || actor?.id || 'ECI-ADMIN-001',
        adminName: actor?.fullName || actor?.name,
        adminRole: actor?.adminRole || actor?.role || 'SUPER_ADMIN',
        description: `Resumed counting session for ${target.constituencyId} (${target.electionId}).`,
      });

      return res;
    },
    [store.results, syncKey, appendAuditLog]
  );

  const completeConstituencyCounting = useCallback(
    (resultId, options = {}, actor = {}) => {
      const target = (store.results || []).find(
        (r) => (r.id || r.resultId) === resultId
      );
      if (!target) return { ok: false, error: 'Result session not found.' };

      const res = countingService.completeCountingSession(target, {
        autoProcessRemainingRounds: true,
        readyForReview: true,
        ...options,
      });
      if (!res.ok) return res;

      const nextResults = (store.results || []).map((r) =>
        (r.id || r.resultId) === resultId ? res.result : r
      );
      syncKey(STORAGE_KEYS.RESULTS, 'results', nextResults);

      appendAuditLog({
        action: 'COUNTING_COMPLETED',
        entityType: 'RESULT',
        entityId: resultId,
        adminId: actor?.adminId || actor?.id || 'ECI-ADMIN-001',
        adminName: actor?.fullName || actor?.name,
        adminRole: actor?.adminRole || actor?.role || 'SUPER_ADMIN',
        description: `Completed counting for ${target.constituencyId} (${target.electionId}). Status: ${res.result.status}.`,
      });

      return res;
    },
    [store.results, syncKey, appendAuditLog]
  );

  const resetConstituencyCounting = useCallback(
    (resultId, options = {}, actor = {}) => {
      const target = (store.results || []).find(
        (r) => (r.id || r.resultId) === resultId
      );
      if (!target) return { ok: false, error: 'Result session not found.' };

      const res = countingService.resetCountingSession(target, options);
      if (!res.ok) return res;

      const nextResults = (store.results || []).map((r) =>
        (r.id || r.resultId) === resultId ? res.result : r
      );
      syncKey(STORAGE_KEYS.RESULTS, 'results', nextResults);

      appendAuditLog({
        action: 'COUNTING_SESSION_RESET',
        entityType: 'RESULT',
        entityId: resultId,
        adminId: actor?.adminId || actor?.id || 'ECI-ADMIN-001',
        adminName: actor?.fullName || actor?.name,
        adminRole: actor?.adminRole || actor?.role || 'SUPER_ADMIN',
        description: `Reset demo counting session for ${target.constituencyId} (${target.electionId}) back to DRAFT.`,
      });

      return res;
    },
    [store.results, syncKey, appendAuditLog]
  );

  const transitionConstituencyResultStatus = useCallback(
    (resultId, targetStatus, options = {}, actor = {}) => {
      const target = (store.results || []).find(
        (r) => (r.id || r.resultId) === resultId
      );
      if (!target) return { ok: false, error: 'Result session not found.' };

      const adminId = actor?.adminId || actor?.id || 'ECI-ADMIN-001';
      const res = countingService.transitionResultPublicationStatus(
        target,
        targetStatus,
        {
          adminId,
          notes: options?.notes || '',
        }
      );
      if (!res.ok) return res;

      const nextResults = (store.results || []).map((r) =>
        (r.id || r.resultId) === resultId ? res.result : r
      );
      syncKey(STORAGE_KEYS.RESULTS, 'results', nextResults);

      if (targetStatus === RESULT_STATUSES.PUBLISHED) {
        addVoterNotification({
          type: NOTIFICATION_TYPES.RESULT_PUBLISHED,
          title: `Result Declared: ${target.constituencyId} (${target.electionId})`,
          message: `Simulated constituency result for ${target.constituencyId} in ${target.electionId} has been published.`,
          targetElectionId: target.electionId,
          targetConstituencyId: target.constituencyId,
          targetStateId: target.stateId,
        });
      }

      appendAuditLog({
        action:
          targetStatus === RESULT_STATUSES.PUBLISHED
            ? 'CONSTITUENCY_RESULT_PUBLISHED'
            : targetStatus === RESULT_STATUSES.UNPUBLISHED
            ? 'CONSTITUENCY_RESULT_UNPUBLISHED'
            : 'CONSTITUENCY_RESULT_STATUS_CHANGED',
        entityType: 'RESULT',
        entityId: resultId,
        adminId,
        adminName: actor?.fullName || actor?.name,
        adminRole: actor?.adminRole || actor?.role || 'SUPER_ADMIN',
        description: `Updated result status for ${target.constituencyId} (${target.electionId}) to ${targetStatus}.`,
      });

      return res;
    },
    [store.results, syncKey, addVoterNotification, appendAuditLog]
  );

  const correctConstituencyResult = useCallback(
    (resultId, payload = {}, actor = {}) => {
      const target = (store.results || []).find(
        (r) => (r.id || r.resultId) === resultId
      );
      if (!target) return { ok: false, error: 'Result session not found.' };

      const res = countingService.applyAdminResultCorrection(target, {
        ...payload,
        adminId: actor?.adminId || actor?.id || 'ECI-ADMIN-001',
        adminName: actor?.fullName || actor?.name || 'ECI Officer',
      });
      if (!res.ok) return res;

      const nextResults = (store.results || []).map((r) =>
        (r.id || r.resultId) === resultId ? res.result : r
      );
      syncKey(STORAGE_KEYS.RESULTS, 'results', nextResults);

      appendAuditLog({
        action: 'RESULT_CORRECTED',
        entityType: 'RESULT',
        entityId: resultId,
        adminId: actor?.adminId || actor?.id || 'ECI-ADMIN-001',
        adminName: actor?.fullName || actor?.name,
        adminRole: actor?.adminRole || actor?.role || 'SUPER_ADMIN',
        description: `Applied administrative correction to result ${resultId} (${target.constituencyId}). Reason: ${payload.reason}`,
      });

      return res;
    },
    [store.results, syncKey, appendAuditLog]
  );

  const saveDraftResultTally = useCallback(
    (payload = {}, secondArgActor = {}) => {
      const {
        electionId,
        constituencyId: inputConstId,
        candidateId,
        simulatedVotes,
        candidateTallies = {},
        notes = '',
        actor: payloadActor,
      } = payload;

      const actor = payloadActor || secondArgActor || {};
      const matchedCandidate = candidateId
        ? (store.candidates || []).find(
            (c) => (c.id || c.candidateId) === candidateId
          )
        : null;
      const constituencyId =
        inputConstId || matchedCandidate?.constituencyId || '';

      if (!electionId || (!constituencyId && !candidateId)) {
        return { ok: false, error: 'Election and Constituency/Candidate are required.' };
      }

      const resolvedTalliesMap =
        candidateId !== undefined
          ? { ...candidateTallies, [candidateId]: simulatedVotes }
          : candidateTallies;

      const nextTallies = structuredClone(store.tallies || {});
      if (constituencyId) {
        if (!nextTallies[electionId] || typeof nextTallies[electionId] !== 'object') {
          nextTallies[electionId] = {};
        }
        if (!nextTallies[electionId][constituencyId]) {
          nextTallies[electionId][constituencyId] = {};
        }

        for (const [candId, count] of Object.entries(resolvedTalliesMap)) {
          const cleanCount = Math.max(0, Number(count) || 0);
          nextTallies[electionId][constituencyId][candId] = cleanCount;
          nextTallies[`${electionId}::${constituencyId}::${candId}`] = cleanCount;
        }
      }

      const nextCandidates = (store.candidates || []).map((c) => {
        const cid = c.id || c.candidateId;
        if (resolvedTalliesMap[cid] !== undefined) {
          return {
            ...c,
            demoVotes: Math.max(0, Number(resolvedTalliesMap[cid]) || 0),
          };
        }
        return c;
      });

      const nextPubs = {
        ...(store.resultPublications || {}),
        [electionId]: {
          ...(store.resultPublications?.[electionId] || {}),
          electionId,
          status: store.resultPublications?.[electionId]?.status || 'DRAFT',
          updatedAt: new Date().toISOString(),
          notes:
            notes ||
            store.resultPublications?.[electionId]?.notes ||
            'Simulated draft result dataset.',
        },
      };

      storageService.setDurableItem(STORAGE_KEYS.TALLIES, nextTallies);
      storageService.setDurableItem(STORAGE_KEYS.CANDIDATES, nextCandidates);
      storageService.setDurableItem(
        STORAGE_KEYS.RESULT_PUBLICATIONS,
        nextPubs
      );

      setStore((prev) => ({
        ...prev,
        tallies: nextTallies,
        candidates: nextCandidates,
        resultPublications: nextPubs,
      }));

      appendAuditLog({
        action: 'RESULT_DRAFT_SAVED',
        entityType: 'RESULT',
        entityId: candidateId
          ? `${electionId}:${candidateId}`
          : `${electionId}:${constituencyId}`,
        adminId: actor.adminId || actor.id || 'ECI-ADMIN-001',
        adminName: actor.fullName || actor.name,
        adminRole: actor.adminRole || actor.role || 'SUPER_ADMIN',
        description: `Saved simulated draft result tallies for ${
          candidateId || constituencyId
        } in ${electionId}.`,
      });

      return { ok: true };
    },
    [store.tallies, store.candidates, store.resultPublications, appendAuditLog]
  );

  const publishElectionResults = useCallback(
    (electionId, publishStatusOrBool = 'PUBLISHED', notesOrActor = '', actorArg = {}) => {
      if (!electionId) {
        return { ok: false, error: 'Election ID is required.' };
      }

      const publishStatus =
        typeof publishStatusOrBool === 'boolean'
          ? publishStatusOrBool
            ? 'PUBLISHED'
            : 'DRAFT'
          : publishStatusOrBool || 'PUBLISHED';

      const notes = typeof notesOrActor === 'string' ? notesOrActor : '';
      const actor =
        typeof notesOrActor === 'object' && notesOrActor !== null
          ? notesOrActor
          : actorArg || {};

      const nowIso = new Date().toISOString();
      const nextPubs = {
        ...(store.resultPublications || {}),
        [electionId]: {
          electionId,
          status: publishStatus,
          publishedAt: publishStatus === 'PUBLISHED' ? nowIso : null,
          publishedBy: actor.adminId || actor.id || 'ECI-ADMIN-001',
          notes:
            notes ||
            (publishStatus === 'PUBLISHED'
              ? 'Published simulated demonstration result dataset.'
              : 'Unpublished to draft mode.'),
        },
      };

      syncKey(
        STORAGE_KEYS.RESULT_PUBLICATIONS,
        'resultPublications',
        nextPubs
      );

      if (publishStatus === 'PUBLISHED') {
        addVoterNotification({
          type: NOTIFICATION_TYPES.RESULT_PUBLISHED,
          title: `Simulated Results Published: ${electionId}`,
          message: `Demonstration constituency result datasets for ${electionId} have been published in the Results Portal.`,
          targetElectionId: electionId,
        });
      }

      appendAuditLog({
        action:
          publishStatus === 'PUBLISHED'
            ? 'RESULT_PUBLISHED'
            : 'RESULT_UNPUBLISHED',
        entityType: 'RESULT',
        entityId: electionId,
        adminId: actor.adminId || actor.id || 'ECI-ADMIN-001',
        adminName: actor.fullName || actor.name,
        adminRole: actor.adminRole || actor.role || 'SUPER_ADMIN',
        description: `${
          publishStatus === 'PUBLISHED' ? 'Published' : 'Unpublished'
        } simulated result dataset for ${electionId}.`,
      });

      return { ok: true, publication: nextPubs[electionId] };
    },
    [store.resultPublications, syncKey, addVoterNotification, appendAuditLog]
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
        demoReference: result.demoReference,
      };
    },
    [store.voters, store.elections, store.tallies, syncKey, addVoterNotification]
  );

  // ================= FEEDBACK, EXPORT/IMPORT & RESET =================
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

  const exportDemoDatasets = useCallback(() => {
    return {
      exportedAt: new Date().toISOString(),
      version: 'ovs_v3_0_phase7',
      elections: store.elections,
      constituencies: store.constituencies,
      parties: store.parties,
      candidates: store.candidates,
      results: store.results,
      announcements: store.announcements,
      resultPublications: store.resultPublications,
      auditLogs: store.auditLogs,
    };
  }, [store]);

  const importDemoDatasets = useCallback(
    (payload, actor = {}) => {
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Invalid JSON dataset payload.' };
      }
      if (Array.isArray(payload.elections)) {
        syncKey(STORAGE_KEYS.ELECTIONS, 'elections', payload.elections);
      }
      if (Array.isArray(payload.parties)) {
        syncKey(STORAGE_KEYS.PARTIES, 'parties', payload.parties);
      }
      if (Array.isArray(payload.candidates)) {
        syncKey(STORAGE_KEYS.CANDIDATES, 'candidates', payload.candidates);
      }
      if (Array.isArray(payload.results)) {
        syncKey(STORAGE_KEYS.RESULTS, 'results', payload.results);
      }
      if (Array.isArray(payload.announcements)) {
        syncKey(STORAGE_KEYS.ANNOUNCEMENTS, 'announcements', payload.announcements);
      }
      appendAuditLog({
        action: 'DATASET_IMPORTED',
        entityType: 'SYSTEM',
        entityId: 'DEMO_STORE',
        adminId: actor.adminId || 'ECI-ADMIN-001',
        adminRole: actor.adminRole || 'SUPER_ADMIN',
        description: 'Imported demonstration dataset JSON into local store.',
      });
      return { ok: true };
    },
    [syncKey, appendAuditLog]
  );

  const dataIntegrityReport = useMemo(
    () =>
      auditElectionDataIntegrity({
        states: store.states,
        districts: store.districts,
        constituencies: store.constituencies,
        parties: store.parties,
        elections: store.elections,
        candidates: store.candidates,
        voters: store.voters,
        results: store.results,
        announcements: store.announcements,
      }),
    [
      store.states,
      store.districts,
      store.constituencies,
      store.parties,
      store.elections,
      store.candidates,
      store.voters,
      store.results,
      store.announcements,
    ]
  );

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
        participationRecords,
        tallies: normalizedTallies,
        results,
        announcements: publishedAnnouncements,
        allAnnouncements,
        publishedAnnouncements,
        voterNotifications,
        auditLogs,
        resultPublications,
        demoLifecycleMode,
        setDemoLifecycleMode,
        recentCandidates: recentCandidateObjects,
        feedback: normalizedFeedbacks,
        feedbacks: normalizedFeedbacks,
        createElection,
        updateElection,
        setElectionStatus,
        transitionElectionStatus,
        duplicateElectionAsDraft,
        updateElectionSchedule,
        deleteElection,
        updateStateRecord,
        upsertState,
        createDistrict,
        upsertDistrict,
        updateDistrict,
        deleteDistrict,
        createConstituency,
        updateConstituency,
        checkConstituencyImpact,
        deleteConstituency,
        createParty,
        upsertParty,
        updateParty,
        deleteParty,
        createCandidate,
        updateCandidate,
        transitionCandidateStatus,
        deleteCandidate,
        createAnnouncement,
        updateAnnouncement,
        saveDraftResultTally,
        publishElectionResults,
        createCountingSessionForConstituency,
        startConstituencyCounting,
        processConstituencyCountingRound,
        pauseConstituencyCounting,
        resumeConstituencyCounting,
        completeConstituencyCounting,
        resetConstituencyCounting,
        transitionConstituencyResultStatus,
        correctConstituencyResult,
        appendAuditLog,
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
        exportDemoDatasets,
        importDemoDatasets,
        dataIntegrityReport,
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
