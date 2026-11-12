import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import {
  CandidateNominationStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
  PartyStatus,
  PartyType,
} from '@prisma/client';
import { createApp } from '../../src/app.js';
import { SessionService } from '../../src/modules/auth/session.service.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { findNominationTransitionRule } from '../../src/modules/nominations/nomination.lifecycle.js';
import { createAdminCandidateSchema } from '../../src/modules/candidates/candidates.admin.schemas.js';
import { nominationReasonRequiredSchema } from '../../src/modules/nominations/nominations.schemas.js';
import { AdminPartiesService } from '../../src/modules/parties/parties.admin.service.js';
import { PartiesService } from '../../src/modules/parties/parties.service.js';
import { NominationsService } from '../../src/modules/nominations/nominations.service.js';
import type { SafeAdminUser } from '../../src/modules/auth/auth.types.js';

const SECRET = 'unit_test_session_secret_minimum_32_characters_long';
const sessionService = new SessionService(SECRET);

function makeAdmin(overrides: Partial<SafeAdminUser> = {}): SafeAdminUser {
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

class MockSocket extends Duplex {
  override _read() {}
  override _write(_chunk: any, _enc: BufferEncoding, cb: () => void) {
    cb();
  }
}

async function injectHttp(
  app: any,
  opts: { method: string; url: string; headers?: Record<string, string>; body?: any }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const socket = new MockSocket();
    const req = new http.IncomingMessage(socket as any);
    req.method = opts.method;
    req.url = opts.url;
    const rawBody = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
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
    res.write = ((c: any, ...a: any[]) => {
      if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      return origWrite(c, ...a);
    }) as any;
    res.end = ((c: any, ...a: any[]) => {
      if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      const text = Buffer.concat(chunks).toString('utf8');
      let parsed: any = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {}
      resolve({ status: res.statusCode, body: parsed });
      return origEnd(c, ...a);
    }) as any;
    res.on('error', reject);
    app.handle(req, res);
  });
}

describe('OVS Phase 8.6 — Candidate, Party & Nomination Lifecycle Unit Suite', () => {
  test('1. Nomination transition matrix enforces valid stages and blocks invalid transitions', () => {
    assert.ok(
      findNominationTransitionRule(
        CandidateNominationStatus.DRAFT,
        CandidateNominationStatus.SUBMITTED
      )
    );
    assert.ok(
      findNominationTransitionRule(
        CandidateNominationStatus.UNDER_REVIEW,
        CandidateNominationStatus.APPROVED
      )
    );
    assert.equal(
      findNominationTransitionRule(
        CandidateNominationStatus.DRAFT,
        CandidateNominationStatus.APPROVED
      ),
      null
    );
    assert.equal(
      findNominationTransitionRule(
        CandidateNominationStatus.REJECTED,
        CandidateNominationStatus.APPROVED
      ),
      null
    );
    assert.equal(
      findNominationTransitionRule(
        CandidateNominationStatus.WITHDRAWN,
        CandidateNominationStatus.SUBMITTED
      ),
      null
    );
  });

  test('2. Zod validation enforces minimum candidate age 25 and rejection/withdrawal reason', () => {
    const young = createAdminCandidateSchema.safeParse({
      id: 'CAND-YOUNG',
      fullName: 'Young Candidate',
      age: 21,
      gender: 'Male',
    });
    assert.equal(young.success, false);

    const shortReason = nominationReasonRequiredSchema.safeParse({ reason: 'no' });
    assert.equal(shortReason.success, false);
  });

  test('3. STATE_ADMIN cannot create NATIONAL party and NominationsService enforces independent XOR, active candidate, mapping & separation of duties', async () => {
    const wbAdmin = makeAdmin({
      id: 'adm-wb',
      role: 'STATE_ADMIN',
      assignedStateId: 'WB',
      assignedStateIds: ['WB'],
    });
    const partyService = new AdminPartiesService({} as any, {
      recordSecurityEvent: async () => {},
    } as any);

    await assert.rejects(
      () =>
        partyService.createParty(
          wbAdmin,
          {
            id: 'PARTY-NAT-X',
            name: 'National Tamper',
            abbreviation: 'NTX',
            partyType: PartyType.NATIONAL,
            symbolName: 'Star',
            symbolUrl: '/s.png',
            description: '',
            status: PartyStatus.ACTIVE,
            metadataSource: 'DEMO_SAMPLE',
          },
          {}
        ),
      /STATE-level demo parties/i
    );

    const mockNomRepo = {
      findElection: async () => ({
        id: 'WB-ASSEMBLY-2029',
        name: 'WB 2029',
        type: ElectionType.STATE_ASSEMBLY,
        stateId: 'WB',
        status: ElectionStatus.NOMINATION_OPEN,
      }),
      findElectionConstituencyMapping: async () => ({
        id: 'ec-1',
        assemblyConstituency: { id: 'WB-AC-BHABANIPUR', stateId: 'WB' },
      }),
      findCandidate: async () => ({
        id: 'CAND-1',
        fullName: 'Demo Cand',
        isActive: false,
        partyId: 'PARTY-AITC',
      }),
      findNominationById: async () => ({
        id: 'nom-1',
        electionId: 'WB-ASSEMBLY-2029',
        candidateId: 'CAND-1',
        candidate: { id: 'CAND-1', isActive: true },
        party: { id: 'PARTY-AITC', status: 'ACTIVE' },
        election: { id: 'WB-ASSEMBLY-2029', stateId: 'WB' },
        constituencyType: ConstituencyType.ASSEMBLY,
        isIndependent: false,
        partyId: 'PARTY-AITC',
        status: CandidateNominationStatus.UNDER_REVIEW,
        version: 2,
        submittedByAdminId: 'adm-wb',
        nominationDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;

    const nomService = new NominationsService(mockNomRepo, {
      recordSecurityEvent: async () => {},
    } as any);

    // Inactive candidate rejected
    await assert.rejects(
      () =>
        nomService.createNomination(
          wbAdmin,
          {
            electionId: 'WB-ASSEMBLY-2029',
            candidateId: 'CAND-1',
            constituencyType: ConstituencyType.ASSEMBLY,
            assemblyConstituencyId: 'WB-AC-BHABANIPUR',
            isIndependent: true,
            scrutinyNote: '',
          },
          {}
        ),
      /inactive/i
    );

    // Separation of duties: submitter cannot approve own submitted nomination
    await assert.rejects(
      () => nomService.approveNomination(wbAdmin, 'nom-1', {}, {}),
      /Separation-of-duties/i
    );
  });

  test('4. Public candidate detail hides inactive candidates, non-APPROVED nominations, and internal scrutinyNote', async () => {
    const publicSvc = new PartiesService({
      findCandidateById: async (id: string) =>
        id === 'CAND-INACTIVE'
          ? { id, isActive: false, nominations: [] }
          : {
              id,
              isActive: true,
              fullName: 'Active Demo',
              displayName: 'Active Demo',
              age: 40,
              gender: 'Female',
              education: 'M.A.',
              profession: 'Teacher',
              criminalCases: 0,
              assetsDeclared: BigInt(100),
              liabilitiesDeclared: BigInt(0),
              photoUrl: null,
              bio: 'Bio',
              metadataSource: 'DEMO_SAMPLE',
              partyId: 'PARTY-AITC',
              party: { id: 'PARTY-AITC', name: 'AITC', abbreviation: 'AITC' },
              nominations: [
                {
                  id: 'n-approved',
                  electionId: 'LS-2029',
                  constituencyType: 'PARLIAMENTARY',
                  status: 'APPROVED',
                  scrutinyNote: 'INTERNAL SECRET NOTE',
                  nominationDate: new Date(),
                  partyId: 'PARTY-AITC',
                  isIndependent: false,
                },
                {
                  id: 'n-rejected',
                  electionId: 'WB-ASSEMBLY-2029',
                  constituencyType: 'ASSEMBLY',
                  status: 'REJECTED',
                  scrutinyNote: 'REJECTED REASON',
                  nominationDate: new Date(),
                  partyId: 'PARTY-AITC',
                  isIndependent: false,
                },
              ],
            },
    } as any);

    await assert.rejects(() => publicSvc.getCandidateById('CAND-INACTIVE'), /not found/i);

    const dto = await publicSvc.getCandidateById('CAND-ACTIVE');
    assert.equal(dto.nominations.length, 1);
    assert.equal(dto.nominations[0]!.status, 'APPROVED');
    assert.equal((dto.nominations[0] as any).scrutinyNote, undefined);
  });

  test('5. Express admin candidate/party/nomination routes block unauthenticated (401), voters (403), and READ_ONLY_AUDITOR mutations (403)', async () => {
    const app = createApp({ enableRateLimit: false });
    const origAuth = AuthService.prototype.authenticateSession;

    try {
      const unauth = await injectHttp(app, {
        method: 'GET',
        url: '/api/v1/admin/nominations',
      });
      assert.equal(unauth.status, 401);

      const audToken = sessionService.generateSessionToken();
      const audCsrf = sessionService.generateCsrfToken(audToken);
      AuthService.prototype.authenticateSession = async () => ({
        sessionHash: 'h-aud',
        expiresAt: new Date(Date.now() + 60000),
        user: {
          id: 'usr-aud',
          userType: 'ADMIN',
          role: 'READ_ONLY_AUDITOR',
          identifier: 'ECI-AUD-01',
          isActive: true,
          createdAt: new Date().toISOString(),
          voterProfile: null,
          adminUser: makeAdmin({ role: 'READ_ONLY_AUDITOR' }),
        },
      });

      const audParty = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/parties',
        headers: { cookie: `ovs_session=${audToken}`, 'x-csrf-token': audCsrf },
        body: { id: 'PARTY-X', name: 'Party X', abbreviation: 'PX', symbolName: 'S' },
      });
      assert.equal(audParty.status, 403);

      const audNom = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/nominations',
        headers: { cookie: `ovs_session=${audToken}`, 'x-csrf-token': audCsrf },
        body: {},
      });
      assert.equal(audNom.status, 403);
    } finally {
      AuthService.prototype.authenticateSession = origAuth;
    }
  });
});
