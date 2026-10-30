import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  STORAGE_KEYS,
  METADATA_SOURCES,
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
import { validateVoterInput } from '../utils/validation';

const ElectionContext = createContext(null);

// Official Lok Sabha & Assembly seat counts for all 36 States/UTs
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
  const normalizedType = s.type === 'UNION_TERRITORY' || s.type === 'UT' ? 'UT' : 'STATE';
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
  return {
    ...c,
    id,
    constituencyId: id,
    type,
    constituencyType: type,
    code: c.code || id,
    reservationType: c.reservationType || 'GENERAL',
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
  return {
    ...e,
    id,
    electionId: id,
    name,
    title: name,
    type,
    electionType: type,
    constituencyType:
      e.constituencyType || (type === 'LOK_SABHA' ? 'PARLIAMENTARY' : 'ASSEMBLY'),
    announcementDate: e.announcementDate || e.nominationStartDate || '2029-03-01',
    pollingDate: e.pollingDate || e.pollingStartDate || '2029-04-15',
    pollingStartDate: e.pollingStartDate || e.pollingDate || '2029-04-15',
    pollingEndDate: e.pollingEndDate || e.pollingDate || '2029-05-15',
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
  const epic = v.epicRef || v.voterRef;
  return {
    ...v,
    id,
    voterId: id,
    epicRef: epic,
    voterRef: epic,
  };
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

  // Nested tallies lookup: supports both flat 'electionId::constituencyId::candId' and nested tallies[electionId][constituencyId][candId]
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
      const normalizedInput = {
        ...input,
        epicRef: (input.epicRef || input.voterRef || '').trim().toUpperCase(),
      };
      const validation = validateVoterInput(
        normalizedInput,
        store.states,
        store.districts,
        store.constituencies
      );
      if (!validation.isValid) {
        return {
          ok: false,
          errors: Array.isArray(validation.errors)
            ? validation.errors
            : Object.values(validation.errors || {}),
        };
      }

      const epicUpper = normalizedInput.epicRef;
      if (
        store.voters.some(
          (v) => (v.epicRef || v.voterRef || '').toUpperCase() === epicUpper
        )
      ) {
        return {
          ok: false,
          errors: [
            'A voter with this EPIC reference already exists in the electoral roll.',
          ],
        };
      }

      const id = `VOTER-${String(store.voters.length + 1).padStart(3, '0')}`;
      const newVoter = enrichVoter({
        id,
        fullName: normalizedInput.fullName.trim(),
        dob: normalizedInput.dob,
        gender: normalizedInput.gender || 'General',
        epicRef: epicUpper,
        stateId: normalizedInput.stateId,
        districtId: normalizedInput.districtId,
        parliamentaryConstituencyId: normalizedInput.parliamentaryConstituencyId,
        assemblyConstituencyId: normalizedInput.assemblyConstituencyId,
        email: normalizedInput.email ? normalizedInput.email.trim() : '',
        mobile: String(normalizedInput.mobile).trim(),
        address: normalizedInput.address ? normalizedInput.address.trim() : '',
        avatar: normalizedInput.avatar || defaultAvatar,
        elections: {},
        metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
      });

      const next = [...store.voters, newVoter];
      syncKey(STORAGE_KEYS.VOTERS, 'voters', next);
      return { ok: true, voter: newVoter };
    },
    [store.states, store.districts, store.constituencies, store.voters, syncKey]
  );

  const updateVoterProfile = useCallback(
    (voterId, updates) => {
      const target = store.voters.find(
        (v) => (v.id || v.voterId) === voterId
      );
      if (!target) {
        return { ok: false, errors: ['Voter not found.'] };
      }

      const merged = enrichVoter({ ...target, ...updates });
      const next = store.voters.map((v) =>
        (v.id || v.voterId) === voterId ? merged : v
      );
      syncKey(STORAGE_KEYS.VOTERS, 'voters', next);
      return { ok: true, voter: merged };
    },
    [store.voters, syncKey]
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
        addFeedback,
        submitFeedback: addFeedback,
        resetDemoData,
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
