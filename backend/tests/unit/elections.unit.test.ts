import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import { ElectionStatus, ElectionType } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { SessionService } from '../../src/modules/auth/session.service.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import {
  findTransitionRule,
  getAllowedNextStatuses,
  isElectionArchivable,
  isElectionCancellable,
  isElectionMetadataEditable,
} from '../../src/modules/elections/election.lifecycle.js';
import {
  cancelAdminElectionSchema,
  createAdminElectionSchema,
  updateAdminElectionSchema,
} from '../../src/modules/elections/admin.elections.schemas.js';
import { AdminElectionsService } from '../../src/modules/elections/admin.elections.service.js';
import { ElectionsService } from '../../src/modules/elections/elections.service.js';
import type { SafeAdminUser } from '../../src/modules/auth/auth.types.js';

const SECRET = 'unit_test_session_secret_minimum_32_characters_long';
const sessionService = new SessionService(SECRET);

function makeMockAdmin(overrides: Partial<SafeAdminUser> = {}): SafeAdminUser {
  return {
    id: 'adm-1',
    userId: 'usr-1',
    officerCode: 'ECI-SUPER-01',
    email: 'super@ovs-test.local',
    fullName: 'Super Admin',
    designation: 'CEC',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    assignedStateId: null,
    assignedStateIds: [],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
    isActive: true,
    ...overrides,
  };
}

function makeElectionRow(overrides: Record<string, any> = {}) {
  return {
    id: 'WB-TEST-2030',
    name: 'West Bengal Test Assembly 2030 (DEMO_SAMPLE)',
    type: ElectionType.STATE_ASSEMBLY,
    year: 2030,
    stateId: 'WB',
    status: ElectionStatus.DRAFT,
    registrationDeadline: null,
    nominationStartDate: null,
    nominationEndDate: null,
    scrutinyDate: null,
    withdrawalDeadline: null,
    campaignStartDate: null,
    campaignEndDate: null,
    pollingStartDate: new Date('2030-04-20T00:00:00.000Z'),
    pollingEndDate: new Date('2030-05-15T00:00:00.000Z'),
    countingDate: new Date('2030-05-20T00:00:00.000Z'),
    resultDate: new Date('2030-05-22T00:00:00.000Z'),
    simulationClockDate: null,
    demoSandboxMode: 'CONCURRENT_SIMULATION_SANDBOX',
    description: 'Synthetic demo election',
    country: 'India',
    targetJurisdiction: 'West Bengal (WB)',
    version: 1,
    metadataSource: 'DEMO_SAMPLE',
    createdByAdminId: 'adm-1',
    updatedByAdminId: 'adm-1',
    cancelledAt: null,
    cancelledByAdminId: null,
    cancellationReason: null,
    archivedAt: null,
    archivedByAdminId: null,
    archiveNote: null,
    createdAt: new Date('2029-01-01T00:00:00.000Z'),
    updatedAt: new Date('2029-01-01T00:00:00.000Z'),
    state: { id: 'WB', name: 'West Bengal', type: 'STATE' },
    createdByAdmin: {
      id: 'adm-1',
      officerCode: 'ECI-SUPER-01',
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
    updatedByAdmin: {
      id: 'adm-1',
      officerCode: 'ECI-SUPER-01',
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
    cancelledByAdmin: null,
    archivedByAdmin: null,
    _count: {
      constituencyMappings: 0,
      candidateNominations: 0,
      countingSessions: 0,
      lifecycleHistory: 1,
    },
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

    if (rawBody) {
      req.push(rawBody);
    }
    req.push(null);

    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: any, ...args: any[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return origWrite(chunk, ...args);
    }) as any;

    res.end = ((chunk: any, ...args: any[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString('utf8');
      let parsed: any = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // leave text
      }
      resolve({ status: res.statusCode, body: parsed });
      return origEnd(chunk, ...args);
    }) as any;

    res.on('error', reject);
    app.handle(req, res);
  });
}

describe('OVS Phase 8.5 — Election Creation, Lifecycle State Machine, Scoping & Public Visibility Unit Suite', () => {
  describe('1. Lifecycle State Machine Invariants', () => {
    test('permits documented forward progression and blocks invalid/terminal transitions', () => {
      assert.ok(findTransitionRule(ElectionStatus.DRAFT, ElectionStatus.UPCOMING));
      assert.ok(
        findTransitionRule(
          ElectionStatus.POLLING_ACTIVE,
          ElectionStatus.POLLING_COMPLETED
        )
      );
      assert.equal(
        findTransitionRule(ElectionStatus.ARCHIVED, ElectionStatus.DRAFT),
        null
      );
      assert.equal(
        findTransitionRule(ElectionStatus.CANCELLED, ElectionStatus.POLLING_ACTIVE),
        null
      );
      assert.equal(
        findTransitionRule(ElectionStatus.DRAFT, ElectionStatus.RESULTS_DECLARED),
        null
      );

      assert.deepEqual(getAllowedNextStatuses(ElectionStatus.ARCHIVED), []);
      assert.deepEqual(getAllowedNextStatuses(ElectionStatus.CANCELLED), []);
      assert.equal(isElectionMetadataEditable(ElectionStatus.DRAFT), true);
      assert.equal(isElectionMetadataEditable(ElectionStatus.POLLING_ACTIVE), false);
      assert.equal(isElectionMetadataEditable(ElectionStatus.ARCHIVED), false);
      assert.equal(isElectionCancellable(ElectionStatus.RESULTS_DECLARED), false);
      assert.equal(isElectionCancellable(ElectionStatus.UPCOMING), true);
      assert.equal(isElectionArchivable(ElectionStatus.RESULTS_DECLARED), true);
      assert.equal(isElectionArchivable(ElectionStatus.CANCELLED), true);
      assert.equal(isElectionArchivable(ElectionStatus.DRAFT), false);
    });
  });

  describe('2. Strict Zod Validation & Mass-Assignment Prevention', () => {
    test('rejects arbitrary status/type/stateId overrides on PATCH and enforces cancellation reason', () => {
      const badPatch = updateAdminElectionSchema.safeParse({
        name: 'Tampered',
        status: 'POLLING_ACTIVE',
      });
      assert.equal(badPatch.success, false);

      const badCancel = cancelAdminElectionSchema.safeParse({ reason: 'no' });
      assert.equal(badCancel.success, false);

      const goodCreate = createAdminElectionSchema.safeParse({
        id: 'ls-2031',
        name: 'Lok Sabha Demo 2031',
        type: 'LOK_SABHA',
        year: 2031,
      });
      assert.equal(goodCreate.success, true);
      if (goodCreate.success) {
        assert.equal(goodCreate.data.id, 'LS-2031');
      }
    });
  });

  describe('3. Service Layer RBAC, Jurisdiction Scoping, Concurrency & Audit', () => {
    test('STATE_ADMIN cannot create LOK_SABHA or out-of-state elections, and IDOR access is denied', async () => {
      const wbAdmin = makeMockAdmin({
        id: 'adm-wb',
        officerCode: 'ECI-WB-01',
        role: 'STATE_ADMIN',
        assignedStateId: 'WB',
        assignedStateIds: ['WB'],
      });
      const mhElection = makeElectionRow({
        id: 'MH-ASSEMBLY-2030',
        stateId: 'MH',
        targetJurisdiction: 'Maharashtra (MH)',
      });
      const recordedEvents: any[] = [];
      const mockRepo = {
        findStateById: async (id: string) =>
          id === 'WB' ? { id: 'WB', name: 'West Bengal', type: 'STATE' } : null,
        findElectionById: async (id: string) =>
          id === 'MH-ASSEMBLY-2030' ? mhElection : null,
      } as any;
      const mockAudit = {
        recordSecurityEvent: async (evt: any) => {
          recordedEvents.push(evt);
        },
      } as any;

      const service = new AdminElectionsService(mockRepo, mockAudit);

      // STATE_ADMIN denied creating LOK_SABHA
      await assert.rejects(
        () =>
          service.createElection(
            wbAdmin,
            {
              id: 'LS-2031',
              name: 'National LS 2031',
              type: ElectionType.LOK_SABHA,
              year: 2031,
              stateId: null,
              country: 'India',
              description: '',
              initialStatus: 'DRAFT',
              metadataSource: 'DEMO_SAMPLE',
            },
            {}
          ),
        /cannot create national Lok Sabha/i
      );

      // STATE_ADMIN (WB) denied creating MH election
      await assert.rejects(
        () =>
          service.createElection(
            wbAdmin,
            {
              id: 'MH-2031',
              name: 'Maharashtra Demo 2031',
              type: ElectionType.STATE_ASSEMBLY,
              year: 2031,
              stateId: 'MH',
              country: 'India',
              description: '',
              initialStatus: 'DRAFT',
              metadataSource: 'DEMO_SAMPLE',
            },
            {}
          ),
        /outside your assigned state scope/i
      );

      // STATE_ADMIN (WB) IDOR read on MH election denied and audited
      await assert.rejects(
        () => service.getElectionById(wbAdmin, 'MH-ASSEMBLY-2030', { requestId: 'req-1' }),
        /outside your assigned jurisdiction scope/i
      );
      assert.ok(
        recordedEvents.some(
          (e) => e.actionType === 'ELECTION_ACCESS_DENIED' && e.outcome === 'DENIED'
        )
      );
    });

    test('enforces optimistic concurrency conflict (409) and lifecycle protections', async () => {
      const superAdmin = makeMockAdmin();
      const draftRow = makeElectionRow({ status: ElectionStatus.DRAFT, version: 3 });
      const archivedRow = makeElectionRow({ status: ElectionStatus.ARCHIVED, version: 4 });

      const mockRepo = {
        findElectionById: async (id: string) =>
          id === 'ARCHIVED-1' ? archivedRow : draftRow,
      } as any;
      const mockAudit = { recordSecurityEvent: async () => {} } as any;
      const service = new AdminElectionsService(mockRepo, mockAudit);

      // Stale version rejected
      await assert.rejects(
        () =>
          service.updateElectionMetadata(
            superAdmin,
            'WB-TEST-2030',
            { name: 'Updated Name', expectedVersion: 1 },
            {}
          ),
        /Stale election version/i
      );

      // Duplicate transition rejected
      await assert.rejects(
        () =>
          service.transitionStatus(
            superAdmin,
            'WB-TEST-2030',
            { targetStatus: ElectionStatus.DRAFT, note: '' },
            {}
          ),
        /already in status/i
      );

      // Reopening archived election rejected
      await assert.rejects(
        () =>
          service.transitionStatus(
            superAdmin,
            'ARCHIVED-1',
            { targetStatus: ElectionStatus.DRAFT, note: '' },
            {}
          ),
        /Invalid election lifecycle transition/i
      );

      // Archiving draft rejected
      await assert.rejects(
        () =>
          service.archiveElection(
            superAdmin,
            'WB-TEST-2030',
            { note: 'premature' },
            {}
          ),
        /cannot be archived/i
      );
    });
  });

  describe('4. Public Election Visibility & Route Authorization Boundaries', () => {
    test('public ElectionsService hides DRAFT/CANCELLED/ARCHIVED and strips internal metadata', async () => {
      const hiddenDraft = makeElectionRow({
        id: 'DL-DRAFT-2029',
        status: ElectionStatus.DRAFT,
        cancellationReason: 'Internal secret',
      });
      const activePublic = makeElectionRow({
        id: 'LS-2029',
        type: ElectionType.LOK_SABHA,
        stateId: null,
        status: ElectionStatus.POLLING_ACTIVE,
        createdByAdminId: 'internal-admin-uuid',
      });

      const mockRepo = {
        listElections: async () => ({ items: [activePublic], total: 1 }),
        findElectionById: async (id: string) =>
          id === 'DL-DRAFT-2029' ? hiddenDraft : activePublic,
      } as any;

      const publicService = new ElectionsService(mockRepo);
      await assert.rejects(
        () => publicService.getElectionById('DL-DRAFT-2029'),
        /not found/i
      );

      const pub = await publicService.getElectionById('LS-2029');
      assert.equal(pub.id, 'LS-2029');
      assert.equal((pub as any).createdByAdminId, undefined);
      assert.equal((pub as any).version, undefined);
      assert.equal((pub as any).cancellationReason, undefined);
    });

    test('Express routes block unauthenticated (401), voters (403), and READ_ONLY_AUDITOR mutations (403)', async () => {
      const app = createApp({
        enableRateLimit: false,
        adminElectionsOptions: { sessionSecret: SECRET },
      });
      const origAuth = AuthService.prototype.authenticateSession;

      try {
        // 1. Unauthenticated -> 401
        const unauthRes = await injectHttp(app, {
          method: 'GET',
          url: '/api/v1/admin/elections',
        });
        assert.equal(unauthRes.status, 401);

        // 2. Voter attempting POST /api/v1/admin/elections -> 403
        const voterToken = sessionService.generateSessionToken();
        const voterCsrf = sessionService.generateCsrfToken(voterToken);
        AuthService.prototype.authenticateSession = async () => ({
          sessionHash: 'h1',
          expiresAt: new Date(Date.now() + 60000),
          user: {
            id: 'usr-v',
            userType: 'VOTER',
            role: 'VOTER',
            identifier: 'DEMO-EPIC-001',
            isActive: true,
            createdAt: new Date().toISOString(),
            voterProfile: null,
            adminUser: null,
          },
        });

        const voterCreate = await injectHttp(app, {
          method: 'POST',
          url: '/api/v1/admin/elections',
          headers: {
            cookie: `ovs_session=${voterToken}`,
            'x-csrf-token': voterCsrf,
          },
          body: {
            id: 'VOTER-EL-1',
            name: 'Voter Tamper',
            type: 'LOK_SABHA',
            year: 2029,
          },
        });
        assert.equal(voterCreate.status, 403);

        // 3. READ_ONLY_AUDITOR attempting POST /cancel -> 403
        const audToken = sessionService.generateSessionToken();
        const audCsrf = sessionService.generateCsrfToken(audToken);
        AuthService.prototype.authenticateSession = async () => ({
          sessionHash: 'h2',
          expiresAt: new Date(Date.now() + 60000),
          user: {
            id: 'usr-a',
            userType: 'ADMIN',
            role: 'READ_ONLY_AUDITOR',
            identifier: 'ECI-AUD-01',
            isActive: true,
            createdAt: new Date().toISOString(),
            voterProfile: null,
            adminUser: makeMockAdmin({
              id: 'adm-aud',
              officerCode: 'ECI-AUD-01',
              role: 'READ_ONLY_AUDITOR',
            }),
          },
        });

        const audCancel = await injectHttp(app, {
          method: 'POST',
          url: '/api/v1/admin/elections/LS-2029/cancel',
          headers: {
            cookie: `ovs_session=${audToken}`,
            'x-csrf-token': audCsrf,
          },
          body: { reason: 'Auditor attempt to cancel' },
        });
        assert.equal(audCancel.status, 403);
      } finally {
        AuthService.prototype.authenticateSession = origAuth;
      }
    });
  });
});
