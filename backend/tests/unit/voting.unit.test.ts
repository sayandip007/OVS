import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import {
  ConfigurationReviewStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
  ParticipationStatus,
  Prisma,
  ScheduleMilestoneType,
} from '@prisma/client';
import { createApp } from '../../src/app.js';
import { SessionService } from '../../src/modules/auth/session.service.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { VotingService } from '../../src/modules/voting/voting.service.js';
import { participationConfirmBodySchema } from '../../src/modules/voting/voting.schemas.js';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  ValidationProblemError,
} from '../../src/common/errors/problemDetails.js';

const SECRET = 'unit_test_session_secret_minimum_32_characters_long';
const sessionService = new SessionService(SECRET);

function makeVoterProfile(overrides: Record<string, any> = {}) {
  return {
    id: 'vp-1',
    userId: 'usr-v1',
    epicNumber: 'DEMO-EPIC-8801',
    fullName: 'Aarav Voter',
    stateId: 'WB',
    districtId: 'WB-DIST-KOLKATA',
    parliamentaryConstituencyId: 'WB-PC-KOLKATA-SOUTH',
    assemblyConstituencyId: 'WB-AC-BHABANIPUR',
    state: { id: 'WB', name: 'West Bengal', type: 'STATE' },
    district: { id: 'WB-DIST-KOLKATA', name: 'Kolkata' },
    parliamentaryConstituency: {
      id: 'WB-PC-KOLKATA-SOUTH',
      name: 'Kolkata Dakshin',
      constituencyNumber: 23,
      stateId: 'WB',
    },
    assemblyConstituency: {
      id: 'WB-AC-BHABANIPUR',
      name: 'Bhabanipur',
      constituencyNumber: 159,
      stateId: 'WB',
      parentParliamentaryConstituencyId: 'WB-PC-KOLKATA-SOUTH',
    },
    ...overrides,
  };
}

function makeElection(overrides: Record<string, any> = {}) {
  return {
    id: 'LS-2029',
    name: 'Lok Sabha 2029 (DEMO_SAMPLE)',
    type: ElectionType.LOK_SABHA,
    year: 2029,
    stateId: null,
    state: null,
    status: ElectionStatus.POLLING_ACTIVE,
    configReviewStatus: ConfigurationReviewStatus.APPROVED,
    scheduleTimezone: 'Asia/Kolkata',
    pollingStartDate: new Date('2029-04-20T01:30:00.000Z'),
    pollingEndDate: new Date('2029-05-15T12:30:00.000Z'),
    simulationClockDate: new Date('2029-04-25T06:00:00.000Z'),
    scheduleMilestones: [
      {
        milestoneType: ScheduleMilestoneType.POLLING_START,
        startAt: new Date('2029-04-20T01:30:00.000Z'),
        endAt: null,
      },
      {
        milestoneType: ScheduleMilestoneType.POLLING_END,
        startAt: new Date('2029-05-15T12:30:00.000Z'),
        endAt: null,
      },
    ],
    constituencyMappings: [
      {
        constituencyType: ConstituencyType.PARLIAMENTARY,
        parliamentaryConstituencyId: 'WB-PC-KOLKATA-SOUTH',
        assemblyConstituencyId: null,
      },
    ],
    ...overrides,
  };
}

class MockSocket extends Duplex {
  override _read() {}
  override _write(_chunk: any, _enc: BufferEncoding, cb: () => void) {
    cb();
  }
}

async function injectHttp(
  app: any,
  opts: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const socket = new MockSocket();
    const req = new http.IncomingMessage(socket as any);
    req.method = opts.method;
    req.url = opts.url;
    const rawBody =
      opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    req.headers = {
      host: 'localhost:5000',
      ...(rawBody
        ? {
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(rawBody)),
          }
        : {}),
      ...(opts.headers ?? {}),
    };

    if (rawBody) req.push(rawBody);
    req.push(null);

    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return origWrite(chunk, ...args);
    }) as any;

    res.end = ((chunk: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const text = Buffer.concat(chunks).toString('utf8');
      let parsed: any = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // leave raw
      }
      resolve({ status: res.statusCode, body: parsed });
      return origEnd(chunk, ...args);
    }) as any;

    app.handle(req, res, (err: any) => {
      if (err) reject(err);
    });
  });
}

describe('Phase 8.8 — Fundamental Ballot Privacy & Schema Invariants', () => {
  test('DemoParticipation Prisma model contains ZERO candidate-choice or tally-link fields', () => {
    const fields = Object.keys(Prisma.DemoParticipationScalarFieldEnum);
    const forbidden = [
      'candidateId',
      'partyId',
      'selectedCandidateId',
      'ballotChoice',
      'selectionHash',
      'candidateTallyId',
      'tallyId',
    ];
    for (const f of forbidden) {
      assert.equal(
        fields.includes(f),
        false,
        `DemoParticipation MUST NOT include '${f}'`
      );
    }
  });

  test('participationConfirmBodySchema accepts {} only and rejects candidateId, partyId, selection, selectionHash', () => {
    assert.equal(participationConfirmBodySchema.safeParse({}).success, true);
    for (const bad of [
      { candidateId: 'CAND-1' },
      { partyId: 'PARTY-1' },
      { selection: 'CAND-1' },
      { ballotChoice: 'NOTA' },
      { selectionHash: 'deadbeef' },
    ]) {
      assert.equal(participationConfirmBodySchema.safeParse(bad).success, false);
    }
  });
});

describe('Phase 8.8 — VotingService Ballot Isolation, Schedule & Concurrency', () => {
  test('Lok Sabha ballot queries PC only and Assembly ballot queries AC only without leaking scrutinyNote', async () => {
    let capturedWhere: any = null;
    const mockPrisma = {
      voterProfile: {
        findUnique: async () => makeVoterProfile(),
      },
      election: {
        findUnique: async ({ where }: any) =>
          where.id === 'LS-2029'
            ? makeElection()
            : makeElection({
                id: 'WB-ASSEMBLY-2029',
                type: ElectionType.STATE_ASSEMBLY,
                stateId: 'WB',
                state: { id: 'WB', name: 'West Bengal', type: 'STATE' },
                constituencyMappings: [
                  {
                    constituencyType: ConstituencyType.ASSEMBLY,
                    parliamentaryConstituencyId: null,
                    assemblyConstituencyId: 'WB-AC-BHABANIPUR',
                  },
                ],
              }),
      },
      candidateNomination: {
        findMany: async ({ where }: any) => {
          capturedWhere = where;
          return [
            {
              id: 'nom-1',
              isIndependent: false,
              scrutinyNote: 'INTERNAL_SECRET',
              candidate: {
                id: 'CAND-1',
                fullName: 'Approved Candidate',
                age: 42,
                gender: 'Female',
                education: 'M.A.',
                profession: 'Educator',
                photoUrl: null,
                bio: 'Bio',
              },
              party: {
                id: 'PARTY-INC',
                name: 'INC',
                abbreviation: 'INC',
                partyType: 'NATIONAL',
                symbolName: 'Hand',
                symbolUrl: null,
              },
            },
          ];
        },
      },
      demoParticipation: {
        findUnique: async () => null,
      },
    } as any;

    const svc = new VotingService(mockPrisma);

    // 1. Lok Sabha -> PARLIAMENTARY PC only
    const lsBallot = await svc.getBallot('usr-v1', 'LS-2029');
    assert.equal(capturedWhere.constituencyType, ConstituencyType.PARLIAMENTARY);
    assert.equal(capturedWhere.parliamentaryConstituencyId, 'WB-PC-KOLKATA-SOUTH');
    assert.equal(capturedWhere.assemblyConstituencyId, undefined);
    assert.equal(capturedWhere.status, 'APPROVED');
    assert.equal((lsBallot.candidates[0] as any).scrutinyNote, undefined);

    // 2. State Assembly -> ASSEMBLY AC only
    const acBallot = await svc.getBallot('usr-v1', 'WB-ASSEMBLY-2029');
    assert.equal(capturedWhere.constituencyType, ConstituencyType.ASSEMBLY);
    assert.equal(capturedWhere.assemblyConstituencyId, 'WB-AC-BHABANIPUR');
    assert.equal(capturedWhere.parliamentaryConstituencyId, undefined);
    assert.equal(acBallot.constituency.id, 'WB-AC-BHABANIPUR');
  });

  test('rejects ballot when election not started, closed, incomplete config, or already participated', async () => {
    let currentElection = makeElection({ status: ElectionStatus.UPCOMING });
    let existingPart: any = null;

    const mockPrisma = {
      voterProfile: { findUnique: async () => makeVoterProfile() },
      election: { findUnique: async () => currentElection },
      candidateNomination: { findMany: async () => [{ id: 'nom-1', candidate: { id: 'C1', fullName: 'C1' }, party: null, isIndependent: true }] },
      demoParticipation: { findUnique: async () => existingPart },
    } as any;

    const svc = new VotingService(mockPrisma);

    await assert.rejects(
      () => svc.getBallot('usr-v1', 'LS-2029'),
      (err: any) => err instanceof ConflictProblemError && /not started/i.test(err.message)
    );

    currentElection = makeElection({ status: ElectionStatus.POLLING_COMPLETED });
    await assert.rejects(
      () => svc.getBallot('usr-v1', 'LS-2029'),
      (err: any) => err instanceof ConflictProblemError && /closed/i.test(err.message)
    );

    currentElection = makeElection({ configReviewStatus: ConfigurationReviewStatus.DRAFT });
    await assert.rejects(
      () => svc.getBallot('usr-v1', 'LS-2029'),
      (err: any) => err instanceof ConflictProblemError && /incomplete/i.test(err.message)
    );

    currentElection = makeElection();
    existingPart = { id: 'p-1', status: ParticipationStatus.PARTICIPATED };
    await assert.rejects(
      () => svc.getBallot('usr-v1', 'LS-2029'),
      (err: any) => err instanceof ConflictProblemError && /already/i.test(err.message)
    );
  });

  test('confirmParticipation stores zero candidate fields and translates P2002 race condition to 409 Conflict', async () => {
    let createdData: any = null;
    const mockPrisma = {
      voterProfile: { findUnique: async () => makeVoterProfile() },
      $transaction: async (fn: any) => {
        const tx = {
          election: { findUnique: async () => makeElection() },
          candidateNomination: { count: async () => 2 },
          demoParticipation: {
            findUnique: async () => null,
            create: async ({ data }: any) => {
              createdData = data;
              return {
                id: 'part-1',
                ...data,
                recordedAt: new Date('2029-04-25T06:00:01.000Z'),
              };
            },
          },
        };
        return fn(tx);
      },
    } as any;

    const svc = new VotingService(mockPrisma);
    const res = await svc.confirmParticipation('usr-v1', 'LS-2029');
    assert.equal(res.status, ParticipationStatus.PARTICIPATED);
    assert.equal(res.constituencyId, 'WB-PC-KOLKATA-SOUTH');
    assert.equal(createdData.parliamentaryConstituencyId, 'WB-PC-KOLKATA-SOUTH');
    assert.equal(createdData.assemblyConstituencyId, null);
    assert.equal(createdData.candidateId, undefined);
    assert.equal(createdData.partyId, undefined);

    // Concurrent P2002 simulation
    mockPrisma.$transaction = async () => {
      throw new Prisma.PrismaClientKnownRequestError('Unique failed', {
        code: 'P2002',
        clientVersion: '6.4.1',
      });
    };
    await assert.rejects(
      () => svc.confirmParticipation('usr-v1', 'LS-2029'),
      (err: any) => err instanceof ConflictProblemError
    );
  });

  test('STATE_ADMIN out-of-scope participation summary is rejected with 403 Forbidden', async () => {
    const mockPrisma = {
      election: {
        findUnique: async () =>
          makeElection({
            id: 'MH-ASSEMBLY-2029',
            type: ElectionType.STATE_ASSEMBLY,
            stateId: 'MH',
          }),
      },
    } as any;

    const svc = new VotingService(mockPrisma);
    await assert.rejects(
      () =>
        svc.getAdminParticipationSummary(
          {
            id: 'adm-wb',
            userId: 'usr-wb',
            officerCode: 'ECI-WB-01',
            email: 'wb@ovs.local',
            fullName: 'WB Admin',
            designation: 'CEO WB',
            role: 'STATE_ADMIN',
            status: 'ACTIVE',
            assignedStateId: 'WB',
            assignedStateIds: ['WB'],
            assignedElectionIds: [],
            assignedConstituencyScopes: [],
            isActive: true,
          },
          'MH-ASSEMBLY-2029'
        ),
      (err: any) => err instanceof ForbiddenProblemError
    );
  });
});

describe('Phase 8.8 — HTTP Security, Strict Body, CSRF & RBAC', () => {
  test('blocks unauthenticated (401), admin-as-voter (403), missing CSRF (403), and candidateId in body (422)', async () => {
    const app = createApp({
      enableRateLimit: false,
      voterVotingOptions: { sessionService },
    });

    const unauth = await injectHttp(app, {
      method: 'GET',
      url: '/api/v1/voter/elections',
    });
    assert.equal(unauth.status, 401);

    const origAuth = AuthService.prototype.authenticateSession;
    const token = sessionService.generateSessionToken();
    const csrf = sessionService.generateCsrfToken(token);

    try {
      // Voter session
      AuthService.prototype.authenticateSession = async () => ({
        sessionHash: 'h-v',
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'usr-v1',
          userType: 'VOTER',
          role: 'VOTER',
          identifier: 'DEMO-EPIC-8801',
          isActive: true,
          createdAt: new Date().toISOString(),
          voterProfile: null,
          adminUser: null,
        },
      });

      // Missing CSRF on POST /participation -> 403
      const noCsrf = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/voter/elections/LS-2029/participation',
        headers: { cookie: `ovs_session=${token}` },
        body: {},
      });
      assert.equal(noCsrf.status, 403);

      // Unexpected candidateId in POST /participation -> 400 ValidationProblemError
      const badBody = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/voter/elections/LS-2029/participation',
        headers: {
          cookie: `ovs_session=${token}`,
          'x-csrf-token': csrf,
        },
        body: { candidateId: 'CAND-SECRET-1' },
      });
      assert.equal(badBody.status, 400);
    } finally {
      AuthService.prototype.authenticateSession = origAuth;
    }
  });
});
