import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CandidateNominationStatus,
  ConstituencyType,
  ResultStatus,
} from '@prisma/client';
import { CountingService } from '../../src/modules/counting/counting.service.js';
import {
  AppProblemError,
  ForbiddenProblemError,
  ValidationProblemError,
} from '../../src/common/errors/problemDetails.js';
import type { SafeAdminUser } from '../../src/modules/auth/auth.types.js';

function makeSuperAdmin(overrides: Partial<SafeAdminUser> = {}): SafeAdminUser {
  return {
    id: 'admin-super-1',
    userId: 'usr-admin-1',
    officerCode: 'ECI-SUPER-01',
    email: 'super@eci.gov.in',
    fullName: 'Chief Election Commissioner',
    designation: 'CEC',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: null,
    assignedStateIds: [],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
    ...overrides,
  };
}

function makeStateAdmin(stateId = 'WB', overrides: Partial<SafeAdminUser> = {}): SafeAdminUser {
  return {
    id: 'admin-state-wb-1',
    userId: 'usr-admin-2',
    officerCode: 'ECI-WB-01',
    email: 'wb.admin@eci.gov.in',
    fullName: 'State Election Commissioner WB',
    designation: 'SEC',
    role: 'STATE_ADMIN',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: stateId,
    assignedStateIds: [stateId],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
    ...overrides,
  };
}

function makeAuditor(overrides: Partial<SafeAdminUser> = {}): SafeAdminUser {
  return {
    id: 'admin-aud-1',
    userId: 'usr-admin-3',
    officerCode: 'ECI-AUD-01',
    email: 'auditor@eci.gov.in',
    fullName: 'Senior Electoral Auditor',
    designation: 'Auditor',
    role: 'READ_ONLY_AUDITOR',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: null,
    assignedStateIds: [],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
    ...overrides,
  };
}

function createMockPrisma() {
  const store = {
    elections: new Map<string, any>(),
    parliamentaryConstituencies: new Map<string, any>(),
    assemblyConstituencies: new Map<string, any>(),
    nominations: new Map<string, any>(),
    sessions: new Map<string, any>(),
    rounds: new Map<string, any>(),
    tallies: new Map<string, any>(),
    tieResolutions: new Map<string, any>(),
    corrections: new Map<string, any>(),
    participations: new Map<string, any>(),
  };

  // Seed baseline election & constituency
  store.elections.set('LS-2029', {
    id: 'LS-2029',
    name: 'Lok Sabha 2029',
    type: 'LOK_SABHA',
    year: 2029,
    stateId: null,
    status: 'POLLING_COMPLETED',
    assignedConstituencies: [
      {
        electionId: 'LS-2029',
        constituencyType: 'PARLIAMENTARY',
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      },
      {
        electionId: 'LS-2029',
        constituencyType: 'PARLIAMENTARY',
        parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
      },
    ],
  });

  store.parliamentaryConstituencies.set('WB-PC-KRISHNANAGAR', {
    id: 'WB-PC-KRISHNANAGAR',
    name: 'Krishnanagar',
    stateId: 'WB',
    constituencyNumber: 12,
  });

  store.parliamentaryConstituencies.set('DL-PC-NEW-DELHI', {
    id: 'DL-PC-NEW-DELHI',
    name: 'New Delhi',
    stateId: 'DL',
    constituencyNumber: 4,
  });

  store.nominations.set('nom-1', {
    id: 'nom-1',
    candidateId: 'CAND-A',
    partyId: 'PARTY-1',
    electionId: 'LS-2029',
    constituencyType: 'PARLIAMENTARY',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    status: CandidateNominationStatus.APPROVED,
  });

  store.nominations.set('nom-2', {
    id: 'nom-2',
    candidateId: 'CAND-B',
    partyId: 'PARTY-2',
    electionId: 'LS-2029',
    constituencyType: 'PARLIAMENTARY',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    status: CandidateNominationStatus.APPROVED,
  });

  store.nominations.set('nom-3', {
    id: 'nom-3',
    candidateId: 'CAND-C',
    partyId: 'PARTY-3',
    electionId: 'LS-2029',
    constituencyType: 'PARLIAMENTARY',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    status: CandidateNominationStatus.APPROVED,
  });

  const mockDb: any = {
    election: {
      findUnique: async ({ where, include }: any) => {
        const el = store.elections.get(where.id);
        if (!el) return null;
        let mappings = el.assignedConstituencies || [];
        if (include?.constituencyMappings?.where) {
          const filter = include.constituencyMappings.where;
          mappings = mappings.filter((m: any) => {
            if (filter.parliamentaryConstituencyId && m.parliamentaryConstituencyId !== filter.parliamentaryConstituencyId) return false;
            if (filter.assemblyConstituencyId && m.assemblyConstituencyId !== filter.assemblyConstituencyId) return false;
            return true;
          });
        }
        return {
          ...el,
          constituencyMappings: mappings,
          _count: { constituencyMappings: (el.assignedConstituencies || []).length },
        };
      },
    },
    parliamentaryConstituency: {
      findUnique: async ({ where }: any) => store.parliamentaryConstituencies.get(where.id) || null,
    },
    assemblyConstituency: {
      findUnique: async ({ where }: any) => store.assemblyConstituencies.get(where.id) || null,
    },
    candidateNomination: {
      findMany: async ({ where }: any) => {
        return Array.from(store.nominations.values()).filter((n) => {
          if (where.candidateId?.in && !where.candidateId.in.includes(n.candidateId)) return false;
          if (where.electionId && n.electionId !== where.electionId) return false;
          if (where.status && n.status !== where.status) return false;
          if (where.parliamentaryConstituencyId && n.parliamentaryConstituencyId !== where.parliamentaryConstituencyId) return false;
          return true;
        });
      },
      findFirst: async ({ where }: any) => {
        const matches = await mockDb.candidateNomination.findMany({ where });
        return matches[0] || null;
      },
    },
    countingSession: {
      findFirst: async ({ where }: any) => {
        for (const s of store.sessions.values()) {
          let match = true;
          if (where.id && s.id !== where.id) match = false;
          if (where.electionId && s.electionId !== where.electionId) match = false;
          if (where.constituencyType && s.constituencyType !== where.constituencyType) match = false;
          if (where.parliamentaryConstituencyId && s.parliamentaryConstituencyId !== where.parliamentaryConstituencyId) match = false;
          if (where.assemblyConstituencyId && s.assemblyConstituencyId !== where.assemblyConstituencyId) match = false;
          if (where.isPublished !== undefined && s.isPublished !== where.isPublished) match = false;
          if (where.status && s.status !== where.status) match = false;
          if (match) return s;
        }
        return null;
      },
      findUnique: async ({ where }: any) => {
        const s = store.sessions.get(where.id);
        if (!s) return null;
        const rounds = Array.from(store.rounds.values()).filter((r) => r.sessionId === s.id);
        const tallies = Array.from(store.tallies.values()).filter((t) => t.sessionId === s.id);
        const tieRes = store.tieResolutions.get(s.id) || null;
        const pc = s.parliamentaryConstituencyId ? store.parliamentaryConstituencies.get(s.parliamentaryConstituencyId) : null;
        return {
          ...s,
          rounds,
          tallies,
          tieResolution: tieRes,
          parliamentaryConstituency: pc,
          assemblyConstituency: null,
          winnerCandidate: s.winnerCandidateId ? { id: s.winnerCandidateId, fullName: `Candidate ${s.winnerCandidateId}`, partyId: 'PARTY-1' } : null,
          runnerUpCandidate: s.runnerUpCandidateId ? { id: s.runnerUpCandidateId, fullName: `Candidate ${s.runnerUpCandidateId}`, partyId: 'PARTY-2' } : null,
          corrections: [],
        };
      },
      findMany: async ({ where }: any) => {
        return Array.from(store.sessions.values()).filter((s) => {
          if (where.isPublished !== undefined && s.isPublished !== where.isPublished) return false;
          if (where.status && s.status !== where.status) return false;
          if (where.electionId && s.electionId !== where.electionId) return false;
          return true;
        }).map((s) => ({
          ...s,
          rounds: Array.from(store.rounds.values()).filter((r) => r.sessionId === s.id),
          tallies: Array.from(store.tallies.values()).filter((t) => t.sessionId === s.id),
          parliamentaryConstituency: store.parliamentaryConstituencies.get(s.parliamentaryConstituencyId),
          assemblyConstituency: null,
          election: store.elections.get(s.electionId),
          winnerCandidate: s.winnerCandidateId ? { id: s.winnerCandidateId, fullName: `Candidate ${s.winnerCandidateId}`, partyId: 'PARTY-1' } : null,
          runnerUpCandidate: s.runnerUpCandidateId ? { id: s.runnerUpCandidateId, fullName: `Candidate ${s.runnerUpCandidateId}`, partyId: 'PARTY-2' } : null,
        }));
      },
      count: async () => store.sessions.size,
      create: async ({ data }: any) => {
        const record = {
          ...data,
          currentRound: data.currentRound || 0,
          totalCountedVotes: data.totalCountedVotes || 0,
          notaVotes: data.notaVotes || 0,
          rejectedVotes: data.rejectedVotes || 0,
          victoryMargin: data.victoryMargin || 0,
          winnerCandidateId: data.winnerCandidateId || null,
          runnerUpCandidateId: data.runnerUpCandidateId || null,
          isPublished: data.isPublished || false,
          publishedAt: data.publishedAt || null,
          publishedByAdminId: data.publishedByAdminId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.sessions.set(record.id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const s = store.sessions.get(where.id);
        if (!s) throw new Error(`Not found ${where.id}`);
        const updated = { ...s, ...data, updatedAt: new Date() };
        store.sessions.set(where.id, updated);
        const rounds = Array.from(store.rounds.values()).filter((r) => r.sessionId === s.id);
        const tallies = Array.from(store.tallies.values()).filter((t) => t.sessionId === s.id);
        return {
          ...updated,
          rounds,
          tallies,
          winnerCandidate: updated.winnerCandidateId ? { id: updated.winnerCandidateId, fullName: `Candidate ${updated.winnerCandidateId}` } : null,
          runnerUpCandidate: updated.runnerUpCandidateId ? { id: updated.runnerUpCandidateId, fullName: `Candidate ${updated.runnerUpCandidateId}` } : null,
        };
      },
    },
    countingRound: {
      create: async ({ data }: any) => {
        const id = `rnd-${Date.now()}-${Math.random()}`;
        const record = { id, ...data };
        store.rounds.set(id, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        return Array.from(store.rounds.values()).filter((r) => r.sessionId === where.sessionId);
      },
      delete: async ({ where }: any) => {
        store.rounds.delete(where.id);
      },
    },
    candidateTally: {
      upsert: async ({ where, update, create }: any) => {
        const key = `${where.sessionId_candidateId.sessionId}_${where.sessionId_candidateId.candidateId}`;
        const existing = store.tallies.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          store.tallies.set(key, updated);
          return updated;
        }
        const record = { id: key, ...create };
        store.tallies.set(key, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        return Array.from(store.tallies.values()).filter((t) => t.sessionId === where.sessionId);
      },
      update: async ({ where, data }: any) => {
        const t = store.tallies.get(where.id || `${where.sessionId_candidateId?.sessionId}_${where.sessionId_candidateId?.candidateId}`);
        if (!t) throw new Error('Tally not found');
        const updated = { ...t, ...data };
        store.tallies.set(t.id, updated);
        return updated;
      },
      updateMany: async ({ where, data }: any) => {
        for (const [k, v] of store.tallies.entries()) {
          if (v.sessionId === where.sessionId) {
            store.tallies.set(k, { ...v, ...data });
          }
        }
      },
    },
    tieResolution: {
      create: async ({ data }: any) => {
        const record = { id: `tie-${Date.now()}`, ...data };
        store.tieResolutions.set(data.sessionId, record);
        return record;
      },
      deleteMany: async ({ where }: any) => {
        store.tieResolutions.delete(where.sessionId);
      },
    },
    resultCorrectionHistory: {
      create: async ({ data }: any) => {
        const record = { id: `corr-${Date.now()}`, ...data };
        store.corrections.set(record.id, record);
        return record;
      },
    },
    demoParticipation: {
      count: async () => store.participations.size,
    },
    $transaction: async (fn: any) => fn(mockDb),
  };

  const mockAudit: any = {
    recordSecurityEvent: async () => {},
  };

  return { mockDb, mockAudit, store };
}

describe('Phase 8.9 CountingService & Independent Results Lifecycle', () => {
  const superAdmin = makeSuperAdmin();
  const stateAdminWb = makeStateAdmin('WB');
  const stateAdminMh = makeStateAdmin('MH');
  const auditor = makeAuditor();

  test('1. Initializes counting session in DRAFT status for assigned constituency', async () => {
    const { mockDb, mockAudit } = createMockPrisma();
    const service = new CountingService(mockDb, mockAudit);

    const session = await service.createCountingSession(
      {
        id: 'RESULT-LS-2029-WB-PC-KRN',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        totalConfiguredRounds: 5,
        totalVoters: 1500000,
      },
      superAdmin
    );

    assert.equal(session.id, 'RESULT-LS-2029-WB-PC-KRN');
    assert.equal(session.status, ResultStatus.DRAFT);
    assert.equal(session.isPublished, false);
    assert.equal(session.totalConfiguredRounds, 5);
  });

  test('2. Rejects session initialization for unassigned constituency or outside jurisdiction', async () => {
    const { mockDb, mockAudit } = createMockPrisma();
    const service = new CountingService(mockDb, mockAudit);

    // Constituency not in election mappings
    await assert.rejects(
      service.createCountingSession(
        {
          electionId: 'LS-2029',
          constituencyType: ConstituencyType.PARLIAMENTARY,
          parliamentaryConstituencyId: 'MH-PC-MUMBAI-SOUTH',
        },
        superAdmin
      ),
      ValidationProblemError
    );

    // State Admin outside jurisdiction (MH admin attempting WB constituency)
    await assert.rejects(
      service.createCountingSession(
        {
          electionId: 'LS-2029',
          constituencyType: ConstituencyType.PARLIAMENTARY,
          parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        },
        stateAdminMh
      ),
      ForbiddenProblemError
    );

    // State Admin within jurisdiction succeeds
    const wbSession = await service.createCountingSession(
      {
        id: 'RESULT-LS-2029-WB-PC-KRN-SEC',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      },
      stateAdminWb
    );
    assert.equal(wbSession.status, ResultStatus.DRAFT);
  });

  test('3. Enforces sequential counting round progression', async () => {
    const { mockDb, mockAudit } = createMockPrisma();
    const service = new CountingService(mockDb, mockAudit);

    const session = await service.createCountingSession(
      {
        id: 'RESULT-TEST-ROUNDS',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        totalConfiguredRounds: 3,
      },
      superAdmin
    );

    // Round 1 must be recorded first
    await assert.rejects(
      service.recordCountingRound(
        session.id,
        { roundNumber: 2, roundVotes: 3000, cumulativeVotes: 3000 },
        superAdmin
      ),
      ValidationProblemError
    );

    // Record round 1 successfully
    const r1 = await service.recordCountingRound(
      session.id,
      { roundNumber: 1, roundVotes: 3000, cumulativeVotes: 3000, leadingCandidateId: 'CAND-A' },
      superAdmin
    );
    assert.equal(r1.roundNumber, 1);

    // Round 2 with decreasing cumulative votes is rejected
    await assert.rejects(
      service.recordCountingRound(
        session.id,
        { roundNumber: 2, roundVotes: 1000, cumulativeVotes: 2500 },
        superAdmin
      ),
      ValidationProblemError
    );

    // Record round 2 successfully
    const r2 = await service.recordCountingRound(
      session.id,
      { roundNumber: 2, roundVotes: 3000, cumulativeVotes: 6000, leadingCandidateId: 'CAND-A' },
      superAdmin
    );
    assert.equal(r2.roundNumber, 2);
  });

  test('4. Independent candidate tallies calculate totals, margin, leader, and detect ties', async () => {
    const { mockDb, mockAudit } = createMockPrisma();
    const service = new CountingService(mockDb, mockAudit);

    const session = await service.createCountingSession(
      {
        id: 'RESULT-TEST-TALLIES',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        totalConfiguredRounds: 2,
      },
      superAdmin
    );

    // Record round 1 & 2
    await service.recordCountingRound(
      session.id,
      { roundNumber: 1, roundVotes: 5000, cumulativeVotes: 5000 },
      superAdmin
    );
    await service.recordCountingRound(
      session.id,
      { roundNumber: 2, roundVotes: 5000, cumulativeVotes: 10000 },
      superAdmin
    );

    // Record clear winner: CAND-A (6000), CAND-B (3500), NOTA (300), Rejected (200) -> Total 10000
    const res1 = await service.recordCandidateTallies(
      session.id,
      {
        tallies: [
          { candidateId: 'CAND-A', votes: 6000 },
          { candidateId: 'CAND-B', votes: 3500 },
        ],
        notaVotes: 300,
        rejectedVotes: 200,
      },
      superAdmin
    );

    assert.equal(res1.totalCountedVotes, 10000);
    assert.equal(res1.winnerCandidateId, 'CAND-A');
    assert.equal(res1.runnerUpCandidateId, 'CAND-B');
    assert.equal(res1.victoryMargin, 2500);
    // All configured rounds completed, so status advances to COUNTING_COMPLETED
    assert.equal(res1.status, ResultStatus.COUNTING_COMPLETED);

    // Test genuine tie detection: CAND-A (4750), CAND-B (4750)
    const { mockDb: mockDbTie, mockAudit: mockAuditTie } = createMockPrisma();
    const serviceTie = new CountingService(mockDbTie, mockAuditTie);

    const tieSession = await serviceTie.createCountingSession(
      {
        id: 'RESULT-TEST-TIED',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        totalConfiguredRounds: 1,
      },
      superAdmin
    );

    await serviceTie.recordCountingRound(
      tieSession.id,
      { roundNumber: 1, roundVotes: 10000, cumulativeVotes: 10000 },
      superAdmin
    );

    const tieResult = await serviceTie.recordCandidateTallies(
      tieSession.id,
      {
        tallies: [
          { candidateId: 'CAND-A', votes: 4750 },
          { candidateId: 'CAND-B', votes: 4750 },
        ],
        notaVotes: 300,
        rejectedVotes: 200,
      },
      superAdmin
    );

    assert.equal(tieResult.status, ResultStatus.TIED);
    assert.equal(tieResult.winnerCandidateId, null);
    assert.equal(tieResult.victoryMargin, 0);
  });

  test('5. Resolves genuine ties via simulated draw of lots and gates unapproved candidates', async () => {
    const { mockDb, mockAudit } = createMockPrisma();
    const service = new CountingService(mockDb, mockAudit);

    const session = await service.createCountingSession(
      {
        id: 'RESULT-TEST-TIEBREAK',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        totalConfiguredRounds: 1,
      },
      superAdmin
    );

    await service.recordCountingRound(
      session.id,
      { roundNumber: 1, roundVotes: 10000, cumulativeVotes: 10000 },
      superAdmin
    );

    await service.recordCandidateTallies(
      session.id,
      {
        tallies: [
          { candidateId: 'CAND-A', votes: 4750 },
          { candidateId: 'CAND-B', votes: 4750 },
        ],
        notaVotes: 300,
        rejectedVotes: 200,
      },
      superAdmin
    );

    // Auditor cannot resolve tie break
    await assert.rejects(
      service.resolveTie(
        session.id,
        {
          selectedWinnerId: 'CAND-A',
          decision: 'SIMULATED_DRAW_WINNER_DECLARED',
          resolutionMethod: 'SIMULATED_DRAW_OF_LOTS',
          justificationNote: 'Simulated tie break draw of lots.',
        },
        auditor
      ),
      ForbiddenProblemError
    );

    // Cannot select a candidate that was not among the top tied candidates
    await assert.rejects(
      service.resolveTie(
        session.id,
        {
          selectedWinnerId: 'CAND-C',
          decision: 'SIMULATED_DRAW_WINNER_DECLARED',
          resolutionMethod: 'SIMULATED_DRAW_OF_LOTS',
          justificationNote: 'Invalid candidate selection.',
        },
        superAdmin
      ),
      ValidationProblemError
    );

    // Valid tie break decision advances session to RESULT_READY_FOR_REVIEW
    const { session: resolvedSession, tieResolution } = await service.resolveTie(
      session.id,
      {
        selectedWinnerId: 'CAND-A',
        decision: 'SIMULATED_DRAW_WINNER_DECLARED',
        resolutionMethod: 'SIMULATED_DRAW_OF_LOTS',
        justificationNote: 'Simulated draw of lots executed with Returning Officer and election agents present.',
      },
      superAdmin
    );

    assert.equal(resolvedSession.winnerCandidateId, 'CAND-A');
    assert.equal(resolvedSession.status, ResultStatus.RESULT_READY_FOR_REVIEW);
    assert.equal(tieResolution.selectedWinnerId, 'CAND-A');
  });

  test('6. Enforces review advancement and result publication gates', async () => {
    const { mockDb, mockAudit } = createMockPrisma();
    const service = new CountingService(mockDb, mockAudit);

    const session = await service.createCountingSession(
      {
        id: 'RESULT-TEST-PUBLISH',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        totalConfiguredRounds: 2,
      },
      superAdmin
    );

    // Cannot publish from DRAFT
    await assert.rejects(
      service.publishResult(session.id, superAdmin),
      AppProblemError
    );

    // Complete rounds & tallies
    await service.recordCountingRound(
      session.id,
      { roundNumber: 1, roundVotes: 5000, cumulativeVotes: 5000 },
      superAdmin
    );
    await service.recordCountingRound(
      session.id,
      { roundNumber: 2, roundVotes: 5000, cumulativeVotes: 10000 },
      superAdmin
    );

    await service.recordCandidateTallies(
      session.id,
      {
        tallies: [
          { candidateId: 'CAND-A', votes: 6000 },
          { candidateId: 'CAND-B', votes: 3500 },
        ],
        notaVotes: 300,
        rejectedVotes: 200,
      },
      superAdmin
    );

    // Session is in COUNTING_COMPLETED. Advance to review
    const reviewed = await service.submitForReview(session.id, superAdmin);
    assert.equal(reviewed.status, ResultStatus.RESULT_READY_FOR_REVIEW);

    // Auditor cannot publish
    await assert.rejects(
      service.publishResult(session.id, auditor),
      ForbiddenProblemError
    );

    // Super Admin publishes result
    const published = await service.publishResult(session.id, superAdmin);
    assert.equal(published.status, ResultStatus.PUBLISHED);
    assert.equal(published.isPublished, true);
    assert.ok(published.publishedAt);
    assert.equal(published.publishedByAdminId, superAdmin.id);
  });

  test('7. Result correction audit trail records immutable previous and corrected state', async () => {
    const { mockDb, mockAudit } = createMockPrisma();
    const service = new CountingService(mockDb, mockAudit);

    const session = await service.createCountingSession(
      {
        id: 'RESULT-TEST-CORRECT',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        totalConfiguredRounds: 1,
      },
      superAdmin
    );

    await service.recordCountingRound(
      session.id,
      { roundNumber: 1, roundVotes: 10000, cumulativeVotes: 10000 },
      superAdmin
    );

    await service.recordCandidateTallies(
      session.id,
      {
        tallies: [
          { candidateId: 'CAND-A', votes: 6000 },
          { candidateId: 'CAND-B', votes: 3500 },
        ],
        notaVotes: 300,
        rejectedVotes: 200,
      },
      superAdmin
    );

    await service.submitForReview(session.id, superAdmin);
    await service.publishResult(session.id, superAdmin);

    // Apply correction: CAND-A had 5900, CAND-B had 3600
    const corrected = await service.correctResult(
      session.id,
      {
        reason: 'Recount audit adjustment following clerical reconciliation notice.',
        candidateVotes: {
          'CAND-A': 5900,
          'CAND-B': 3600,
        },
      },
      superAdmin
    );

    assert.equal(corrected.status, ResultStatus.CORRECTED);
    assert.equal(corrected.totalCountedVotes, 10000);
    assert.equal(corrected.victoryMargin, 2300);
  });

  test('8. Public results API exposes ONLY published results with clear simulation metadata', async () => {
    const { mockDb, mockAudit } = createMockPrisma();
    const service = new CountingService(mockDb, mockAudit);

    // 1 draft session, 1 published session
    const draft = await service.createCountingSession(
      {
        id: 'RESULT-DRAFT-ONLY',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
      },
      superAdmin
    );
    assert.equal(draft.status, ResultStatus.DRAFT);

    const pub = await service.createCountingSession(
      {
        id: 'RESULT-PUB-KRN',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        totalConfiguredRounds: 1,
      },
      superAdmin
    );

    await service.recordCountingRound(
      pub.id,
      { roundNumber: 1, roundVotes: 10000, cumulativeVotes: 10000 },
      superAdmin
    );

    await service.recordCandidateTallies(
      pub.id,
      {
        tallies: [
          { candidateId: 'CAND-A', votes: 6000 },
          { candidateId: 'CAND-B', votes: 3500 },
        ],
        notaVotes: 300,
        rejectedVotes: 200,
      },
      superAdmin
    );

    await service.submitForReview(pub.id, superAdmin);
    await service.publishResult(pub.id, superAdmin);

    // Query public results
    const publicResults = await service.getPublicResults({ electionId: 'LS-2029' });
    assert.equal(publicResults.isSimulated, true);
    assert.ok(publicResults.simulationNotice.includes('DEMO ELECTION SIMULATION'));
    assert.equal(publicResults.items.length, 1);
    assert.equal(publicResults.items[0]!.id, 'RESULT-PUB-KRN');

    // Attempting to query unpublished session directly returns 404
    await assert.rejects(
      service.getPublicResultById('RESULT-DRAFT-ONLY'),
      AppProblemError
    );

    // Single public result query
    const singlePub = await service.getPublicResultById('RESULT-PUB-KRN');
    assert.equal(singlePub.isSimulated, true);
    assert.equal(singlePub.result.id, 'RESULT-PUB-KRN');
  });

  test('9. Strict zero-derivation invariant: Demo counting tallies never derive from DemoParticipation', async () => {
    const { mockDb, mockAudit, store } = createMockPrisma();
    const service = new CountingService(mockDb, mockAudit);

    // Add sample demo participation records (e.g. 50 voters participated)
    for (let i = 1; i <= 50; i++) {
      store.participations.set(`part-${i}`, {
        id: `part-${i}`,
        voterId: `voter-${i}`,
        electionId: 'LS-2029',
        status: 'PARTICIPATED',
      });
    }

    // Tally recording takes explicit synthetic tallies (e.g. 100,000 synthetic votes)
    const session = await service.createCountingSession(
      {
        id: 'RESULT-INDEPENDENT-TEST',
        electionId: 'LS-2029',
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        totalConfiguredRounds: 1,
      },
      superAdmin
    );

    await service.recordCountingRound(
      session.id,
      { roundNumber: 1, roundVotes: 100000, cumulativeVotes: 100000 },
      superAdmin
    );

    const recorded = await service.recordCandidateTallies(
      session.id,
      {
        tallies: [
          { candidateId: 'CAND-A', votes: 60000 },
          { candidateId: 'CAND-B', votes: 35000 },
        ],
        notaVotes: 3000,
        rejectedVotes: 2000,
      },
      superAdmin
    );

    // Recorded totals reflect synthetic input, entirely independent of demo participations count (50)
    assert.equal(recorded.totalCountedVotes, 100000);
    assert.equal(store.participations.size, 50);

    // Election summary reports both counts distinctly without correlation
    await service.submitForReview(session.id, superAdmin);
    await service.publishResult(session.id, superAdmin);

    const summary = await service.getPublicElectionSummary('LS-2029');
    assert.equal(summary.totalCountedVotes, 100000);
    assert.equal(summary.participationTurnoutMetric.recordedVoterParticipations, 50);
  });
});
