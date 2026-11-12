import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import {
  ConfigurationReviewStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
  ScheduleMilestoneStatus,
  ScheduleMilestoneType,
} from '@prisma/client';
import { createApp } from '../../src/app.js';
import { SessionService } from '../../src/modules/auth/session.service.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import type { SafeAdminUser } from '../../src/modules/auth/auth.types.js';
import {
  isValidIanaTimezone,
  validateElectionSchedule,
} from '../../src/modules/elections/election.schedule.validator.js';
import { ElectionConfigService } from '../../src/modules/elections/election.config.service.js';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  ValidationProblemError,
} from '../../src/common/errors/problemDetails.js';

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

function makeMockAuditService() {
  const events: any[] = [];
  return {
    events,
    recordSecurityEvent: async (evt: any) => {
      events.push(evt);
    },
  } as any;
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
        // leave text
      }
      resolve({ status: res.statusCode, body: parsed });
      return origEnd(chunk, ...args);
    }) as any;

    app.handle(req, res, (err: any) => {
      if (err) reject(err);
    });
  });
}

describe('Phase 8.7 — Schedule Validator Unit Tests', () => {
  test('validates IANA timezones accurately and rejects invalid names', () => {
    assert.equal(isValidIanaTimezone('Asia/Kolkata'), true);
    assert.equal(isValidIanaTimezone('UTC'), true);
    assert.equal(isValidIanaTimezone('Mars/Olympus'), false);
    assert.equal(isValidIanaTimezone(''), false);
  });

  test('allows incomplete milestones in draft mode when chronologically ordered', () => {
    const result = validateElectionSchedule(
      [
        {
          milestoneType: ScheduleMilestoneType.NOMINATION_OPEN,
          startAt: '2029-03-20T04:30:00.000Z',
        },
        {
          milestoneType: ScheduleMilestoneType.POLLING_START,
          startAt: '2029-04-20T01:30:00.000Z',
        },
      ],
      'Asia/Kolkata',
      { requireMandatory: false }
    );
    assert.equal(result.valid, true);
    assert.equal(result.issues.length, 0);
  });

  test('flags chronological violation when polling starts before nomination deadline', () => {
    const result = validateElectionSchedule(
      [
        {
          milestoneType: ScheduleMilestoneType.NOMINATION_DEADLINE,
          startAt: '2029-04-25T09:30:00.000Z',
        },
        {
          milestoneType: ScheduleMilestoneType.POLLING_START,
          startAt: '2029-04-20T01:30:00.000Z',
        },
      ],
      'Asia/Kolkata',
      { requireMandatory: false }
    );
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.code === 'MILESTONE_OUT_OF_ORDER'));
  });

  test('flags missing mandatory milestones when requireMandatory=true', () => {
    const result = validateElectionSchedule(
      [
        {
          milestoneType: ScheduleMilestoneType.NOMINATION_OPEN,
          startAt: '2029-03-20T04:30:00.000Z',
        },
      ],
      'Asia/Kolkata',
      { requireMandatory: true }
    );
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.code === 'MISSING_MANDATORY_MILESTONE'));
  });

  test('flags duplicate milestoneType entries', () => {
    const result = validateElectionSchedule(
      [
        {
          milestoneType: ScheduleMilestoneType.NOMINATION_OPEN,
          startAt: '2029-03-20T04:30:00.000Z',
        },
        {
          milestoneType: ScheduleMilestoneType.NOMINATION_OPEN,
          startAt: '2029-03-21T04:30:00.000Z',
        },
      ],
      'Asia/Kolkata',
      { requireMandatory: false }
    );
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.code === 'DUPLICATE_MILESTONE'));
  });
});

describe('Phase 8.7 — ElectionConfigService Business Rules', () => {
  test('previewBulkAssignment detects INVALID_TYPE, CROSS_STATE_MISMATCH, DUPLICATE_IN_BATCH, ALREADY_ASSIGNED without mutating', async () => {
    let createManyCalled = false;
    const mockPrisma = {
      election: {
        findUnique: async () => ({
          id: 'WB-ASM-2030',
          type: ElectionType.STATE_ASSEMBLY,
          stateId: 'WB',
          status: ElectionStatus.DRAFT,
          state: { id: 'WB', name: 'West Bengal' },
        }),
      },
      parliamentaryConstituency: {
        findMany: async () => [{ id: 'WB-PC-01', name: 'Kolkata', stateId: 'WB' }],
      },
      assemblyConstituency: {
        findMany: async () => [
          { id: 'WB-AC-01', name: 'Bhabanipur', stateId: 'WB' },
          { id: 'WB-AC-02', name: 'Rashbehari', stateId: 'WB' },
          { id: 'MH-AC-01', name: 'Colaba', stateId: 'MH' },
        ],
      },
      electionConstituency: {
        findMany: async () => [
          {
            parliamentaryConstituencyId: null,
            assemblyConstituencyId: 'WB-AC-01',
          },
        ],
        createMany: async () => {
          createManyCalled = true;
          return { count: 0 };
        },
      },
    } as any;

    const svc = new ElectionConfigService(mockPrisma, makeMockAuditService());
    const preview = await svc.previewBulkAssignment(
      makeMockAdmin(),
      'WB-ASM-2030',
      ['WB-PC-01', 'MH-AC-01', 'WB-AC-01', 'WB-AC-02', 'WB-AC-02', 'UNKNOWN-AC']
    );

    assert.equal(createManyCalled, false);
    assert.equal(preview.allValid, false);
    assert.equal(preview.validCount, 1);
    assert.equal(preview.invalidCount, 5);
    assert.equal(preview.rows[0]?.code, 'INVALID_TYPE');
    assert.equal(preview.rows[1]?.code, 'CROSS_STATE_MISMATCH');
    assert.equal(preview.rows[2]?.code, 'ALREADY_ASSIGNED');
    assert.equal(preview.rows[3]?.code, 'VALID');
    assert.equal(preview.rows[4]?.code, 'DUPLICATE_IN_BATCH');
    assert.equal(preview.rows[5]?.code, 'NOT_FOUND');
  });

  test('bulkAssignConstituencies rejects entire batch atomically when any constituency is invalid', async () => {
    let txEntered = false;
    const mockPrisma = {
      election: {
        findUnique: async () => ({
          id: 'LS-2030',
          type: ElectionType.LOK_SABHA,
          stateId: null,
          status: ElectionStatus.DRAFT,
          version: 1,
          configReviewStatus: ConfigurationReviewStatus.DRAFT,
          state: null,
        }),
      },
      parliamentaryConstituency: {
        findMany: async () => [{ id: 'WB-PC-01', name: 'Kolkata', stateId: 'WB' }],
      },
      assemblyConstituency: {
        findMany: async () => [{ id: 'WB-AC-01', name: 'Bhabanipur', stateId: 'WB' }],
      },
      electionConstituency: {
        findMany: async () => [],
      },
      $transaction: async () => {
        txEntered = true;
      },
    } as any;

    const svc = new ElectionConfigService(mockPrisma, makeMockAuditService());
    await assert.rejects(
      () =>
        svc.bulkAssignConstituencies(
          makeMockAdmin(),
          'LS-2030',
          { constituencyIds: ['WB-PC-01', 'WB-AC-01'], note: 'bad batch' },
          {}
        ),
      (err: any) => err instanceof ValidationProblemError
    );
    assert.equal(txEntered, false);
  });

  test('removeConstituency blocks removal if candidate nominations reference the constituency', async () => {
    const mockPrisma = {
      election: {
        findUnique: async () => ({
          id: 'WB-ASM-2030',
          type: ElectionType.STATE_ASSEMBLY,
          stateId: 'WB',
          status: ElectionStatus.DRAFT,
          state: { id: 'WB', name: 'West Bengal' },
        }),
      },
      electionConstituency: {
        findFirst: async () => ({
          id: 'map-1',
          electionId: 'WB-ASM-2030',
          constituencyType: ConstituencyType.ASSEMBLY,
          assemblyConstituencyId: 'WB-AC-01',
          parliamentaryConstituencyId: null,
        }),
      },
      candidateNomination: {
        count: async () => 2,
      },
    } as any;

    const svc = new ElectionConfigService(mockPrisma, makeMockAuditService());
    await assert.rejects(
      () => svc.removeConstituency(makeMockAdmin(), 'WB-ASM-2030', 'WB-AC-01', {}),
      (err: any) => err instanceof ConflictProblemError
    );
  });

  test('approveConfiguration enforces separation of duties against self-approval', async () => {
    const mockPrisma = {
      election: {
        findUnique: async () => ({
          id: 'WB-ASM-2030',
          type: ElectionType.STATE_ASSEMBLY,
          stateId: 'WB',
          status: ElectionStatus.DRAFT,
          configReviewStatus: ConfigurationReviewStatus.SUBMITTED_FOR_REVIEW,
          configSubmittedByAdminId: 'adm-1',
          state: { id: 'WB', name: 'West Bengal' },
        }),
      },
    } as any;

    const svc = new ElectionConfigService(mockPrisma, makeMockAuditService());
    await assert.rejects(
      () =>
        svc.approveConfiguration(
          makeMockAdmin({ id: 'adm-1', role: 'SUPER_ADMIN' }),
          'WB-ASM-2030',
          'Trying self-approval',
          {}
        ),
      (err: any) => err instanceof ForbiddenProblemError
    );
  });
});

describe('Phase 8.7 — HTTP RBAC & CSRF Enforcement', () => {
  test('unauthenticated requests return 401 and ELECTION_OFFICER cannot mutate schedule or bulk constituencies (403)', async () => {
    const app = createApp({
      enableRateLimit: false,
      adminElectionsOptions: { sessionSecret: SECRET },
    });

    // 1. Unauthenticated -> 401
    const unauthRes = await injectHttp(app, {
      method: 'GET',
      url: '/api/v1/admin/elections/LS-2029/schedule',
    });
    assert.equal(unauthRes.status, 401);

    const origAuth = AuthService.prototype.authenticateSession;
    const token = sessionService.generateSessionToken();
    const csrfToken = sessionService.generateCsrfToken(token);

    AuthService.prototype.authenticateSession = async () => ({
      sessionHash: 'h-off',
      expiresAt: new Date(Date.now() + 3600_000),
      user: {
        id: 'usr-off',
        userType: 'ADMIN',
        role: 'ELECTION_OFFICER',
        identifier: 'ECI-EO-01',
        isActive: true,
        createdAt: new Date().toISOString(),
        voterProfile: null,
        adminUser: makeMockAdmin({
          id: 'adm-off',
          userId: 'usr-off',
          role: 'ELECTION_OFFICER',
          officerCode: 'ECI-EO-01',
          assignedElectionIds: ['LS-2029'],
        }),
      },
    });

    try {
      // 2. Missing CSRF on POST -> 403
      const noCsrfRes = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/elections/LS-2029/constituencies/bulk',
        headers: {
          cookie: `ovs_session=${token}`,
        },
        body: { constituencyIds: ['WB-PC-01'] },
      });
      assert.equal(noCsrfRes.status, 403);

      // 3. ELECTION_OFFICER with valid CSRF trying PUT /schedule -> 403 RBAC
      const putSchedRes = await injectHttp(app, {
        method: 'PUT',
        url: '/api/v1/admin/elections/LS-2029/schedule',
        headers: {
          cookie: `ovs_session=${token}`,
          'x-csrf-token': csrfToken,
        },
        body: {
          timezone: 'Asia/Kolkata',
          milestones: [
            {
              milestoneType: 'NOMINATION_OPEN',
              startAt: '2029-03-20T04:30:00.000Z',
              status: ScheduleMilestoneStatus.CONFIGURED,
            },
          ],
        },
      });
      assert.equal(putSchedRes.status, 403);

      // 4. ELECTION_OFFICER with valid CSRF trying POST /configuration/approve -> 403 RBAC
      const approveRes = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/elections/LS-2029/configuration/approve',
        headers: {
          cookie: `ovs_session=${token}`,
          'x-csrf-token': csrfToken,
        },
        body: { note: 'attempt' },
      });
      assert.equal(approveRes.status, 403);
    } finally {
      AuthService.prototype.authenticateSession = origAuth;
    }
  });
});
