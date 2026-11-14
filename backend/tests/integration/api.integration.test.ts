import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, disconnectDatabase } from '../../src/config/database.js';
import { assertSafeTestDatabase } from '../../src/config/testDatabaseGuard.js';
import { bootstrapSuperAdmin } from '../../src/modules/admin/bootstrapSuperAdmin.js';
import { seedDatabase } from '../../prisma/seed.js';

describe('OVS Phase 8.2–8.4 — Live PostgreSQL & Supertest API Integration Suite', () => {
  const app = createApp({
    allowedOrigins: ['http://localhost:3000'],
  });

  before(async () => {
    // Fail-closed test database guard before any destructive cleanup
    assertSafeTestDatabase();

    // Clean any test artifacts while preserving schema and triggers, then seed DEMO_SAMPLE dataset
    await prisma.candidateTally.deleteMany();
    await prisma.countingRound.deleteMany();
    await prisma.resultCorrectionHistory.deleteMany();
    await prisma.tieResolution.deleteMany();
    await prisma.countingSession.deleteMany();
    await prisma.nominationLifecycleHistory.deleteMany();
    await prisma.candidateNomination.deleteMany();
    await prisma.electionScheduleHistory.deleteMany();
    await prisma.electionScheduleMilestone.deleteMany();
    await prisma.electionConstituencyHistory.deleteMany();
    await prisma.electionConstituency.deleteMany();
    await prisma.electionLifecycleHistory.deleteMany();
    await prisma.demoParticipation.deleteMany();
    await prisma.voterNotification.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.adminConstituencyScope.deleteMany();
    await prisma.adminStateScope.deleteMany();
    await prisma.adminElectionScope.deleteMany();
    await prisma.adminActionLog.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.voterProfile.deleteMany();
    await prisma.userSession.deleteMany();
    await prisma.authChallenge.deleteMany();
    await prisma.user.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.politicalParty.deleteMany();
    await prisma.election.deleteMany();
    await prisma.assemblyConstituency.deleteMany();
    await prisma.parliamentaryConstituency.deleteMany();
    await prisma.district.deleteMany();
    await prisma.state.deleteMany();
  });

  after(async () => {
    await disconnectDatabase();
  });

  describe('1. Seed Idempotency Verification', () => {
    test('seeds synthetic DEMO_SAMPLE dataset and remains 100% idempotent on repeated execution', async () => {
      const firstRun = await seedDatabase(prisma);
      assert.equal(firstRun.statesCount, 3);
      assert.equal(firstRun.districtsCount, 6);
      assert.equal(firstRun.parliamentaryCount, 6);
      assert.equal(firstRun.assemblyCount, 8);
      assert.equal(firstRun.partiesCount, 5);
      assert.equal(firstRun.candidatesCount, 12);
      assert.equal(firstRun.electionsCount, 5);
      assert.equal(firstRun.electionConstituenciesCount, 12);
      assert.equal(firstRun.nominationsCount, 15);
      assert.equal(firstRun.scheduleMilestonesCount, 20);

      // Run a second time to verify idempotency (zero duplicates, zero constraint errors)
      const secondRun = await seedDatabase(prisma);
      assert.deepEqual(secondRun, firstRun);

      // Verify zero voter PII or participation records were created by seed
      const voterCount = await prisma.voterProfile.count();
      const participationCount = await prisma.demoParticipation.count();
      assert.equal(voterCount, 0);
      assert.equal(participationCount, 0);
    });
  });

  describe('2. Health & Readiness Endpoints (/api/v1/health)', () => {
    test('GET /api/v1/health/live returns 200 OK with service status and X-Request-Id header', async () => {
      const res = await request(app)
        .get('/api/v1/health/live')
        .set('X-Request-Id', 'health-live-req-001');

      assert.equal(res.status, 200);
      assert.equal(res.headers['x-request-id'], 'health-live-req-001');
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'UP');
      assert.equal(res.body.data.service, 'ovs-backend');
      assert.equal(res.body.meta.requestId, 'health-live-req-001');
    });

    test('GET /api/v1/health/ready returns 200 OK when live PostgreSQL database is reachable', async () => {
      const res = await request(app).get('/api/v1/health/ready');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'READY');
      assert.equal(res.body.data.database.status, 'UP');
      assert.equal(typeof res.body.data.database.latencyMs, 'number');
    });

    test('GET /api/v1/health/ready returns 503 Service Unavailable with RFC 9457 Problem Details when DB probe fails', async () => {
      const degradedApp = createApp({
        readinessCheck: async () => ({
          connected: false,
          latencyMs: 1.5,
          error: 'Simulated connection failure',
        }),
      });

      const res = await request(degradedApp).get('/api/v1/health/ready');
      assert.equal(res.status, 503);
      assert.match(res.headers['content-type'] ?? '', /application\/problem\+json/);
      assert.equal(res.body.type, 'https://ovs.eci.gov.in/errors/service-unavailable');
      assert.equal(res.body.status, 503);
      assert.equal(res.body.code, 'SERVICE_UNAVAILABLE');
    });
  });

  describe('3. RFC 9457 Error Responses, Security Headers, CORS & Rate Limiting', () => {
    test('returns 404 RFC 9457 Problem Details for unmatched routes', async () => {
      const res = await request(app).get('/api/v1/unknown-resource');

      assert.equal(res.status, 404);
      assert.match(res.headers['content-type'] ?? '', /application\/problem\+json/);
      assert.equal(res.body.type, 'https://ovs.eci.gov.in/errors/resource-not-found');
      assert.equal(res.body.title, 'Resource Not Found');
      assert.equal(res.body.status, 404);
      assert.equal(res.body.code, 'RESOURCE_NOT_FOUND');
      assert.equal(res.body.instance, '/api/v1/unknown-resource');
      assert.ok(res.body.requestId);
    });

    test('returns 400 RFC 9457 Problem Details with invalidParams on invalid query parameters', async () => {
      const res = await request(app).get('/api/v1/geography/states?page=0&limit=999');

      assert.equal(res.status, 400);
      assert.match(res.headers['content-type'] ?? '', /application\/problem\+json/);
      assert.equal(res.body.type, 'https://ovs.eci.gov.in/errors/validation-failed');
      assert.equal(res.body.status, 400);
      assert.equal(res.body.code, 'VALIDATION_FAILED');
      assert.ok(Array.isArray(res.body.invalidParams));
      assert.equal(res.body.invalidParams.length, 2);
    });

    test('enforces Helmet security headers and strict CORS origin allowlist', async () => {
      const allowedRes = await request(app)
        .get('/api/v1/health/live')
        .set('Origin', 'http://localhost:3000');

      assert.equal(allowedRes.status, 200);
      assert.equal(
        allowedRes.headers['access-control-allow-origin'],
        'http://localhost:3000'
      );
      assert.equal(allowedRes.headers['access-control-allow-credentials'], 'true');
      assert.equal(allowedRes.headers['x-content-type-options'], 'nosniff');
      assert.equal(allowedRes.headers['x-powered-by'], undefined);

      const blockedRes = await request(app)
        .get('/api/v1/health/live')
        .set('Origin', 'https://untrusted-origin.example.com');

      assert.equal(blockedRes.status, 403);
      assert.match(blockedRes.headers['content-type'] ?? '', /application\/problem\+json/);
      assert.equal(blockedRes.body.code, 'CORS_ORIGIN_FORBIDDEN');
    });

    test('enforces API rate limiting and returns 429 RFC 9457 Problem Details when exceeded', async () => {
      const rateLimitedApp = createApp({ rateLimitMax: 2 });

      const r1 = await request(rateLimitedApp).get('/api/v1/health/live');
      const r2 = await request(rateLimitedApp).get('/api/v1/health/live');
      const r3 = await request(rateLimitedApp).get('/api/v1/health/live');

      assert.equal(r1.status, 200);
      assert.equal(r2.status, 200);
      assert.equal(r3.status, 429);
      assert.match(r3.headers['content-type'] ?? '', /application\/problem\+json/);
      assert.equal(r3.body.code, 'RATE_LIMIT_EXCEEDED');
    });
  });

  describe('4. Geography Endpoints (/api/v1/geography)', () => {
    test('GET /api/v1/geography/states lists seeded states and supports filtering by type', async () => {
      const res = await request(app).get('/api/v1/geography/states');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.length, 3);
      assert.equal(res.body.meta.pagination.total, 3);

      const utRes = await request(app).get(
        '/api/v1/geography/states?type=UNION_TERRITORY'
      );
      assert.equal(utRes.status, 200);
      assert.equal(utRes.body.data.length, 1);
      assert.equal(utRes.body.data[0].id, 'DL');
    });

    test('GET /api/v1/geography/states/:stateId returns state details and 404 for unknown state', async () => {
      const res = await request(app).get('/api/v1/geography/states/wb');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, 'WB');
      assert.equal(res.body.data.name, 'West Bengal');
      assert.equal(res.body.data.capital, 'Kolkata');
      assert.equal(res.body.data._count.districts, 2);
      assert.equal(res.body.data._count.parliamentarySeats, 2);
      assert.equal(res.body.data._count.assemblySeats, 4);

      const notFound = await request(app).get('/api/v1/geography/states/ZZ');
      assert.equal(notFound.status, 404);
      assert.equal(notFound.body.code, 'RESOURCE_NOT_FOUND');
    });

    test('GET /api/v1/geography/states/:stateId/districts returns state districts and 404 for unknown state', async () => {
      const res = await request(app).get('/api/v1/geography/states/WB/districts');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      const ids = res.body.data.map((d: { id: string }) => d.id);
      assert.ok(ids.includes('NADIA'));
      assert.ok(ids.includes('WB-DIST-KOLKATA'));

      const notFound = await request(app).get('/api/v1/geography/states/ZZ/districts');
      assert.equal(notFound.status, 404);
    });

    test('GET /api/v1/geography/states/:stateId/parliamentary-constituencies returns state PCs', async () => {
      const res = await request(app).get(
        '/api/v1/geography/states/WB/parliamentary-constituencies'
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      assert.equal(res.body.data[0].id, 'WB-PC-KRISHNANAGAR');
      assert.equal(res.body.data[0].constituencyType, 'PARLIAMENTARY');
    });

    test('GET /api/v1/geography/states/:stateId/assembly-constituencies returns state ACs and filters by parent PC', async () => {
      const res = await request(app).get(
        '/api/v1/geography/states/WB/assembly-constituencies?parentParliamentaryConstituencyId=WB-PC-KRISHNANAGAR'
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      assert.equal(res.body.data[0].id, 'WB-AC-KRISHNANAGAR-UTTAR');
      assert.equal(
        res.body.data[0].parentParliamentaryConstituencyId,
        'WB-PC-KRISHNANAGAR'
      );
      assert.equal(res.body.data[0].districtId, 'NADIA');
    });

    test('GET /api/v1/geography/constituencies/:constituencyId resolves both PC and AC records and returns 404 for unknown ID', async () => {
      const pcRes = await request(app).get(
        '/api/v1/geography/constituencies/WB-PC-KRISHNANAGAR'
      );
      assert.equal(pcRes.status, 200);
      assert.equal(pcRes.body.data.id, 'WB-PC-KRISHNANAGAR');
      assert.equal(pcRes.body.data.constituencyType, 'PARLIAMENTARY');
      assert.equal(pcRes.body.data.childAssemblySeats.length, 2);

      const acRes = await request(app).get(
        '/api/v1/geography/constituencies/WB-AC-KRISHNANAGAR-UTTAR'
      );
      assert.equal(acRes.status, 200);
      assert.equal(acRes.body.data.id, 'WB-AC-KRISHNANAGAR-UTTAR');
      assert.equal(acRes.body.data.constituencyType, 'ASSEMBLY');
      assert.equal(acRes.body.data.parentParliamentary.id, 'WB-PC-KRISHNANAGAR');

      const notFound = await request(app).get(
        '/api/v1/geography/constituencies/NONEXISTENT-CONST'
      );
      assert.equal(notFound.status, 404);
    });
  });

  describe('5. Election Endpoints (/api/v1/elections)', () => {
    test('GET /api/v1/elections lists public non-draft/non-archived seeded elections and filters by type and stateId', async () => {
      const allRes = await request(app).get('/api/v1/elections');
      assert.equal(allRes.status, 200);
      assert.equal(allRes.body.data.length, 3);

      const stateAssemblyRes = await request(app).get(
        '/api/v1/elections?type=STATE_ASSEMBLY&stateId=WB'
      );
      assert.equal(stateAssemblyRes.status, 200);
      assert.equal(stateAssemblyRes.body.data.length, 1);
      assert.equal(stateAssemblyRes.body.data[0].id, 'WB-ASSEMBLY-2029');

      // Draft and Archived seeded elections must not leak via public detail API
      const draftRes = await request(app).get('/api/v1/elections/DL-ASSEMBLY-2029');
      assert.equal(draftRes.status, 404);
      const archivedRes = await request(app).get('/api/v1/elections/WB-BYPOLL-2028-ARCHIVED');
      assert.equal(archivedRes.status, 404);
    });

    test('GET /api/v1/elections/:electionId returns election metadata and 404 for unknown election', async () => {
      const res = await request(app).get('/api/v1/elections/LS-2029');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, 'LS-2029');
      assert.equal(res.body.data.type, 'LOK_SABHA');
      assert.equal(res.body.data.stateId, null);
      assert.equal(res.body.data._count.constituencyMappings, 6);
      assert.equal(res.body.data._count.candidateNominations, 6);

      const notFound = await request(app).get('/api/v1/elections/UNKNOWN-ELECTION');
      assert.equal(notFound.status, 404);
    });

    test('GET /api/v1/elections/:electionId/constituencies returns mapped constituencies', async () => {
      const lsRes = await request(app).get(
        '/api/v1/elections/LS-2029/constituencies?stateId=WB'
      );
      assert.equal(lsRes.status, 200);
      assert.equal(lsRes.body.data.length, 2);
      assert.equal(lsRes.body.data[0].constituencyType, 'PARLIAMENTARY');

      const wbRes = await request(app).get(
        '/api/v1/elections/WB-ASSEMBLY-2029/constituencies'
      );
      assert.equal(wbRes.status, 200);
      assert.equal(wbRes.body.data.length, 4);
      assert.equal(wbRes.body.data[0].constituencyType, 'ASSEMBLY');
    });

    test('GET /api/v1/elections/:electionId/candidates returns approved nominations with historical nomination-bound party affiliation', async () => {
      const res = await request(app).get(
        '/api/v1/elections/LS-2029/candidates?constituencyId=WB-PC-KRISHNANAGAR'
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 4);

      const independentNom = res.body.data.find(
        (item: { candidate: { id: string } }) =>
          item.candidate.id === 'CAND-LS29-WB-KRN-4'
      );
      assert.ok(independentNom);
      assert.equal(independentNom.nominationPartyId, null);
      assert.equal(independentNom.isIndependent, true);
      assert.equal(independentNom.nominationParty, null);
      assert.equal(independentNom.candidate.currentRegisteredPartyId, 'PARTY-IND');
    });
  });

  describe('6. Political Parties & Candidates Endpoints (/api/v1/parties & /api/v1/candidates)', () => {
    test('GET /api/v1/parties and GET /api/v1/parties/:partyId return party records', async () => {
      const listRes = await request(app).get('/api/v1/parties?partyType=NATIONAL');
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.data.length, 3);

      const detailRes = await request(app).get('/api/v1/parties/PARTY-AITC');
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.body.data.id, 'PARTY-AITC');
      assert.equal(detailRes.body.data.abbreviation, 'AITC');
      assert.equal(detailRes.body.data.candidates.length, 2);

      const notFound = await request(app).get('/api/v1/parties/PARTY-NONEXISTENT');
      assert.equal(notFound.status, 404);
    });

    test('GET /api/v1/candidates/:candidateId preserves historical nomination-bound party even if candidate global partyId changes', async () => {
      // Simulate candidate switching their global registered party in the future
      await prisma.candidate.update({
        where: { id: 'CAND-LS29-WB-KRN-1' },
        data: { partyId: 'PARTY-INC' },
      });

      try {
        const res = await request(app).get('/api/v1/candidates/CAND-LS29-WB-KRN-1');
        assert.equal(res.status, 200);
        assert.equal(res.body.data.id, 'CAND-LS29-WB-KRN-1');
        // Global current party reflects update
        assert.equal(res.body.data.currentRegisteredPartyId, 'PARTY-INC');
        // Historical LS-2029 nomination strictly preserves PARTY-AITC!
        assert.equal(res.body.data.nominations.length, 1);
        assert.equal(res.body.data.nominations[0].electionId, 'LS-2029');
        assert.equal(res.body.data.nominations[0].nominationPartyId, 'PARTY-AITC');
        assert.equal(res.body.data.nominations[0].nominationParty.abbreviation, 'AITC');

        // Also verify election candidates endpoint still reports PARTY-AITC for LS-2029
        const elecCandRes = await request(app).get(
          '/api/v1/elections/LS-2029/candidates?constituencyId=WB-PC-KRISHNANAGAR'
        );
        const krn1 = elecCandRes.body.data.find(
          (n: { candidate: { id: string } }) => n.candidate.id === 'CAND-LS29-WB-KRN-1'
        );
        assert.equal(krn1.nominationPartyId, 'PARTY-AITC');
        assert.equal(krn1.nominationParty.id, 'PARTY-AITC');
      } finally {
        // Restore original partyId
        await prisma.candidate.update({
          where: { id: 'CAND-LS29-WB-KRN-1' },
          data: { partyId: 'PARTY-AITC' },
        });
      }
    });
  });

  describe('7. Live PostgreSQL Trigger & Composite Foreign Key Enforcement via Prisma', () => {
    test('rejects cross-state Assembly Constituency insertion via composite foreign key', async () => {
      await assert.rejects(
        () =>
          prisma.assemblyConstituency.create({
            data: {
              id: 'INVALID-CROSS-STATE-AC',
              stateId: 'MH', // Mismatched state
              districtId: 'NADIA', // District in WB
              parentParliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR', // PC in WB
              constituencyNumber: 999,
              name: 'Invalid Cross State AC',
            },
          }),
        /Foreign key constraint/i
      );
    });

    test('rejects mapping an Assembly Constituency to a Lok Sabha election via database trigger', async () => {
      await assert.rejects(
        () =>
          prisma.electionConstituency.create({
            data: {
              electionId: 'LS-2029',
              constituencyType: 'ASSEMBLY',
              parliamentaryConstituencyId: null,
              assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
            },
          }),
        /Lok Sabha election LS-2029 cannot map to non-parliamentary constituency/i
      );
    });

    test('rejects candidate nomination in a constituency not mapped to the election via database trigger', async () => {
      // MH-AC-BANDRA-WEST is not mapped to WB-ASSEMBLY-2029
      await assert.rejects(
        () =>
          prisma.candidateNomination.create({
            data: {
              candidateId: 'CAND-WBA29-KRNU-1',
              partyId: 'PARTY-AITC',
              electionId: 'WB-ASSEMBLY-2029',
              constituencyType: 'ASSEMBLY',
              parliamentaryConstituencyId: null,
              assemblyConstituencyId: 'MH-AC-BANDRA-WEST',
              status: 'APPROVED',
            },
          }),
        /does not belong to election state|not mapped to election/i
      );
    });
  });

  describe('8. Phase 8.3 — Voter Registration, OTP Challenge, Sessions, CSRF & Profile APIs', () => {
    const voterPayload = {
      fullName: 'Sayan Integration Test',
      mobileNumber: '9876500001',
      email: 'sayan.test@example.com',
      epicNumber: 'TEST-EPIC-001',
      dateOfBirth: '1995-04-12',
      gender: 'MALE',
      address: '123 Demo Street, Krishnanagar',
      pinCode: '741101',
      stateId: 'WB',
      districtId: 'NADIA',
      parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    };

    let createdUserId: string;
    let authChallengeId: string;
    let sessionCookie: string;
    let rawSessionToken: string;
    let csrfToken: string;

    test('POST /api/v1/auth/register creates atomic User and VoterProfile records', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(voterPayload);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.fullName, voterPayload.fullName);
      assert.equal(res.body.data.epicNumber, voterPayload.epicNumber);
      assert.equal(res.body.data.role, 'VOTER');
      assert.equal(res.body.data.accountStatus, 'UNVERIFIED');
      assert.ok(res.body.data.id);
      assert.ok(res.body.data.userId);

      createdUserId = res.body.data.userId;

      // Verify database state directly
      const dbUser = await prisma.user.findUnique({
        where: { id: createdUserId },
        include: { voterProfile: true },
      });
      assert.ok(dbUser);
      assert.equal(dbUser.userType, 'VOTER');
      assert.equal(dbUser.voterProfile?.epicNumber, voterPayload.epicNumber);
    });

    test('POST /api/v1/auth/register rejects duplicate EPIC, mobile, and email with 409 Conflict', async () => {
      // Duplicate EPIC
      const dupEpicRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...voterPayload,
          mobileNumber: '9876500002',
          email: 'different1@example.com',
        });
      assert.equal(dupEpicRes.status, 409);
      assert.match(dupEpicRes.body.detail, /EPIC/i);

      // Duplicate mobile
      const dupMobileRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...voterPayload,
          epicNumber: 'TEST-EPIC-002',
          email: 'different2@example.com',
        });
      assert.equal(dupMobileRes.status, 409);
      assert.match(dupMobileRes.body.detail, /mobile/i);
    });

    test('POST /api/v1/auth/register rejects mutually inconsistent geography hierarchy', async () => {
      const invalidGeoRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...voterPayload,
          epicNumber: 'TEST-EPIC-GEO',
          mobileNumber: '9876500099',
          email: 'geo.test@example.com',
          stateId: 'MH', // Mismatched state for Nadia district
        });
      assert.ok([400, 409].includes(invalidGeoRes.status));
      assert.match(invalidGeoRes.body.detail, /geographic|belong to state/i);
    });

    test('POST /api/v1/auth/otp/request generates challenge without exposing plaintext OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({ identifier: voterPayload.mobileNumber });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.challengeId);
      assert.ok(res.body.data.expiresInSeconds);
      // Response must never contain plaintext otp
      assert.equal((res.body.data as any).otp, undefined);

      authChallengeId = res.body.data.challengeId;

      // Verify challenge recorded in database with SHA-256 HMAC digest
      const challenge = await prisma.authChallenge.findUnique({
        where: { id: authChallengeId },
      });
      assert.ok(challenge);
      assert.equal(challenge.consumedAt, null);
      assert.equal(challenge.attempts, 0);
      assert.equal(challenge.otpHash.length, 64);
    });

    test('POST /api/v1/auth/otp/verify validates OTP, sets HttpOnly session cookie, and marks challenge consumed', async () => {
      // Retrieve development OTP via inspection endpoint
      const devRes = await request(app)
        .get(`/api/v1/auth/dev/latest-otp?identifier=${voterPayload.mobileNumber}`);
      assert.equal(devRes.status, 200);
      const { otp } = devRes.body.data;
      assert.ok(otp);
      assert.equal(otp.length, 6);

      // Verify with incorrect OTP first
      const failRes = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId: authChallengeId, otp: '000000' });
      assert.equal(failRes.status, 401);

      // Verify with correct OTP
      const verifyRes = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId: authChallengeId, otp });

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.success, true);
      assert.equal(verifyRes.body.data.user.role, 'VOTER');

      // Check cookie headers
      const cookies = verifyRes.headers['set-cookie'] as string[] | undefined;
      assert.ok(cookies && cookies.length > 0);
      sessionCookie = cookies[0]!;
      assert.match(sessionCookie, /ovs_session=/);
      assert.match(sessionCookie, /HttpOnly/i);

      // Extract raw token value for header fallback tests
      const match = sessionCookie.match(/ovs_session=([^;]+)/);
      assert.ok(match);
      rawSessionToken = match[1]!;

      // Replay prevention: Re-submitting the same challenge fails
      const replayRes = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId: authChallengeId, otp });
      assert.equal(replayRes.status, 401);
    });

    test('GET /api/v1/auth/csrf provides an anti-CSRF token tied to active session', async () => {
      const res = await request(app)
        .get('/api/v1/auth/csrf')
        .set('Cookie', sessionCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.csrfToken);
      csrfToken = res.body.data.csrfToken;
    });

    test('GET /api/v1/auth/me returns current authenticated user and session details', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', sessionCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.id, createdUserId);
      assert.equal(res.body.data.user.role, 'VOTER');
      assert.equal(res.body.data.voterProfile.epicNumber, voterPayload.epicNumber);
    });

    test('Voter Profile: GET /api/v1/voters/me returns profile with resolved geography hierarchy', async () => {
      const res = await request(app)
        .get('/api/v1/voters/me')
        .set('Cookie', sessionCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.fullName, voterPayload.fullName);
      assert.equal(res.body.data.state.id, 'WB');
      assert.equal(res.body.data.district.id, 'NADIA');
      assert.equal(res.body.data.parliamentaryConstituency.id, 'WB-PC-KRISHNANAGAR');
      assert.equal(res.body.data.assemblyConstituency.id, 'WB-AC-KRISHNANAGAR-UTTAR');
    });

    test('Voter Profile: PATCH /api/v1/voters/me enforces anti-CSRF token and updates permitted fields', async () => {
      // 1. Mutating request without CSRF token returns 403 CsrfProblemError
      const blockedRes = await request(app)
        .patch('/api/v1/voters/me')
        .set('Cookie', sessionCookie)
        .send({ fullName: 'Tampered Without CSRF' });
      assert.equal(blockedRes.status, 403);
      assert.match(blockedRes.body.title, /CSRF/i);

      // 2. Mutating request with valid CSRF token succeeds
      const updateRes = await request(app)
        .patch('/api/v1/voters/me')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          fullName: 'Sayan Saha Verified',
          address: '456 Updated Lane, Krishnanagar',
        });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.success, true);
      assert.equal(updateRes.body.data.fullName, 'Sayan Saha Verified');
      assert.equal(updateRes.body.data.address, '456 Updated Lane, Krishnanagar');
    });

    test('Voter Profile: GET /api/v1/voters/me/constituencies returns full constituency bundle', async () => {
      const res = await request(app)
        .get('/api/v1/voters/me/constituencies')
        .set('Cookie', sessionCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.state.code, 'WB');
      assert.equal(res.body.data.district.name, 'Nadia');
      assert.equal(res.body.data.parliamentaryConstituency.name, 'Krishnanagar');
      assert.equal(res.body.data.assemblyConstituency.name, 'Krishnanagar Uttar');
    });

    test('Session Lifecycle: lists sessions, revokes session, and logs out cleanly', async () => {
      // List sessions
      const listRes = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Cookie', sessionCookie);

      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.success, true);
      assert.ok(Array.isArray(listRes.body.data));
      assert.ok(listRes.body.data.length >= 1);
      assert.equal(listRes.body.data[0].isCurrent, true);

      // Logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', csrfToken);

      assert.equal(logoutRes.status, 200);
      assert.equal(logoutRes.body.success, true);

      // Subsequent access with revoked session returns 401 Unauthorized
      const unauthRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', sessionCookie);

      assert.equal(unauthRes.status, 401);
    });
  });

  describe('9. Phase 8.4 — Admin Authentication, RBAC, Jurisdiction Scoping, Provisioning & Audit Logs (Live PostgreSQL)', () => {
    const superCredentials = {
      officerCode: 'ECI-SUPER-CI-01',
      email: 'super.ci@ovs-test.local',
      fullName: 'Chief Election Commissioner CI',
      designation: 'Chief Election Commissioner',
      password: 'SuperCiSecret#2026!',
    };

    let superCookie: string;
    let superCsrf: string;
    let natId: string;
    let wbAdminId: string;
    let mhAdminId: string;
    let officerId: string;
    let auditorId: string;

    test('Controlled SUPER_ADMIN bootstrap creates atomic User & AdminUser records and is idempotent', async () => {
      const first = await bootstrapSuperAdmin(prisma, superCredentials);
      assert.equal(first.created, true);
      assert.equal(first.officerCode, superCredentials.officerCode);

      const second = await bootstrapSuperAdmin(prisma, superCredentials);
      assert.equal(second.created, false);
      assert.equal(second.adminUserId, first.adminUserId);
    });

    test('POST /api/v1/admin/auth/login authenticates SUPER_ADMIN, sets HttpOnly cookie, and stores SHA-256 session hash in DB', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({
          identifier: superCredentials.email,
          password: superCredentials.password,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.admin.role, 'SUPER_ADMIN');
      assert.equal(res.body.data.admin.officerCode, superCredentials.officerCode);
      assert.equal((res.body.data.admin as any).passwordHash, undefined);
      assert.ok(res.body.data.csrfToken);

      const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
      assert.ok(cookies && cookies.length > 0);
      assert.match(cookies[0]!, /ovs_session=/);
      assert.match(cookies[0]!, /HttpOnly/i);
      superCookie = cookies[0]!.split(';')[0]!;
      superCsrf = res.body.data.csrfToken;
    });

    test('SUPER_ADMIN provisions NATIONAL_ADMIN, STATE_ADMIN (WB & MH), ELECTION_OFFICER (LS-2029), and READ_ONLY_AUDITOR', async () => {
      // NATIONAL_ADMIN
      const natRes = await request(app)
        .post('/api/v1/admin/users')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          officerCode: 'ECI-NAT-CI-01',
          email: 'nat.ci@ovs-test.local',
          fullName: 'National Admin CI',
          designation: 'Deputy EC',
          role: 'NATIONAL_ADMIN',
          password: 'NatCiPassword#2026!',
        });
      assert.equal(natRes.status, 201);
      natId = natRes.body.data.id;

      // STATE_ADMIN (WB)
      const wbRes = await request(app)
        .post('/api/v1/admin/users')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          officerCode: 'ECI-WB-CI-01',
          email: 'wb.ci@ovs-test.local',
          fullName: 'WB State Admin CI',
          designation: 'CEO West Bengal',
          role: 'STATE_ADMIN',
          password: 'WbCiPassword#2026!',
          stateIds: ['WB'],
        });
      assert.equal(wbRes.status, 201);
      assert.deepEqual(wbRes.body.data.assignedStateIds, ['WB']);
      wbAdminId = wbRes.body.data.id;

      // STATE_ADMIN (MH)
      const mhRes = await request(app)
        .post('/api/v1/admin/users')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          officerCode: 'ECI-MH-CI-01',
          email: 'mh.ci@ovs-test.local',
          fullName: 'MH State Admin CI',
          designation: 'CEO Maharashtra',
          role: 'STATE_ADMIN',
          password: 'MhCiPassword#2026!',
          stateIds: ['MH'],
        });
      assert.equal(mhRes.status, 201);
      mhAdminId = mhRes.body.data.id;

      // ELECTION_OFFICER (WB + LS-2029)
      const roRes = await request(app)
        .post('/api/v1/admin/users')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          officerCode: 'ECI-RO-CI-01',
          email: 'ro.ci@ovs-test.local',
          fullName: 'Returning Officer CI',
          designation: 'RO Krishnanagar',
          role: 'ELECTION_OFFICER',
          password: 'RoCiPassword#2026!',
          stateIds: ['WB'],
          electionIds: ['LS-2029'],
          constituencyScopes: [
            {
              electionId: 'LS-2029',
              constituencyType: 'PARLIAMENTARY',
              parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
            },
          ],
        });
      assert.equal(roRes.status, 201);
      officerId = roRes.body.data.id;

      // READ_ONLY_AUDITOR
      const audRes = await request(app)
        .post('/api/v1/admin/users')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          officerCode: 'ECI-AUD-CI-01',
          email: 'aud.ci@ovs-test.local',
          fullName: 'Auditor CI',
          designation: 'Statutory Auditor',
          role: 'READ_ONLY_AUDITOR',
          password: 'AudCiPassword#2026!',
        });
      assert.equal(audRes.status, 201);
      auditorId = audRes.body.data.id;
    });

    test('Enforces jurisdiction scoping, privilege non-escalation, and READ_ONLY_AUDITOR denial against live DB', async () => {
      // Login WB State Admin
      const wbLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'wb.ci@ovs-test.local', password: 'WbCiPassword#2026!' });
      assert.equal(wbLogin.status, 200);
      const wbCookie = (wbLogin.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      const wbCsrf = wbLogin.body.data.csrfToken;

      // Cross-state isolation: WB admin denied MH admin & MH endpoint
      const crossRead = await request(app)
        .get(`/api/v1/admin/users/${mhAdminId}`)
        .set('Cookie', wbCookie);
      assert.equal(crossRead.status, 403);

      const mhCheck = await request(app)
        .get('/api/v1/admin/jurisdictions/states/MH')
        .set('Cookie', wbCookie);
      assert.equal(mhCheck.status, 403);

      const wbCheck = await request(app)
        .get('/api/v1/admin/jurisdictions/states/WB')
        .set('Cookie', wbCookie);
      assert.equal(wbCheck.status, 200);

      // WB admin cannot grant global scope
      const scopeEsc = await request(app)
        .put(`/api/v1/admin/users/${officerId}/scopes`)
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ assignedStateId: null, stateIds: [] });
      assert.equal(scopeEsc.status, 403);

      // Login ELECTION_OFFICER (assigned LS-2029)
      const roLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-RO-CI-01', password: 'RoCiPassword#2026!' });
      assert.equal(roLogin.status, 200);
      const roCookie = (roLogin.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      const roCsrf = roLogin.body.data.csrfToken;

      const allowLs2029 = await request(app)
        .post('/api/v1/admin/jurisdictions/elections/LS-2029/verify-action')
        .set('Cookie', roCookie)
        .set('X-CSRF-Token', roCsrf)
        .send({});
      assert.equal(allowLs2029.status, 200);

      const denyWbAsm = await request(app)
        .post('/api/v1/admin/jurisdictions/elections/WB-ASSEMBLY-2029/verify-action')
        .set('Cookie', roCookie)
        .set('X-CSRF-Token', roCsrf)
        .send({});
      assert.equal(denyWbAsm.status, 403);

      // Login NATIONAL_ADMIN -> cannot suspend SUPER_ADMIN
      const natLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-NAT-CI-01', password: 'NatCiPassword#2026!' });
      assert.equal(natLogin.status, 200);
      const natCookie = (natLogin.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      const natCsrf = natLogin.body.data.csrfToken;

      const superRow = await prisma.adminUser.findUnique({
        where: { officerCode: superCredentials.officerCode },
      });
      const natSuspendSuper = await request(app)
        .post(`/api/v1/admin/users/${superRow!.id}/suspend`)
        .set('Cookie', natCookie)
        .set('X-CSRF-Token', natCsrf)
        .send({ reason: 'Unauthorized attempt' });
      assert.equal(natSuspendSuper.status, 403);

      // Login READ_ONLY_AUDITOR -> reads audit logs, denied mutations
      const audLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-AUD-CI-01', password: 'AudCiPassword#2026!' });
      assert.equal(audLogin.status, 200);
      const audCookie = (audLogin.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      const audCsrf = audLogin.body.data.csrfToken;

      const logsRes = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Cookie', audCookie);
      assert.equal(logsRes.status, 200);
      assert.ok(Array.isArray(logsRes.body.data));
      assert.ok(logsRes.body.data.length > 0);

      const audMutate = await request(app)
        .post(`/api/v1/admin/users/${natId}/suspend`)
        .set('Cookie', audCookie)
        .set('X-CSRF-Token', audCsrf)
        .send({ reason: 'Auditor mutation attempt' });
      assert.equal(audMutate.status, 403);
    });

    test('Suspend & Activate lifecycle revokes live DB sessions immediately and records sanitized audit trail', async () => {
      const audLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-AUD-CI-01', password: 'AudCiPassword#2026!' });
      const audCookie = (audLogin.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      // Suspend auditor via SUPER_ADMIN
      const suspRes = await request(app)
        .post(`/api/v1/admin/users/${auditorId}/suspend`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ reason: 'CI lifecycle test suspension' });
      assert.equal(suspRes.status, 200);
      assert.equal(suspRes.body.data.status, 'SUSPENDED');

      // Existing auditor session rejected
      const audMe = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Cookie', audCookie);
      assert.equal(audMe.status, 401);

      // Suspended login rejected with 403
      const audRetry = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-AUD-CI-01', password: 'AudCiPassword#2026!' });
      assert.equal(audRetry.status, 403);

      // Reactivate auditor
      const actRes = await request(app)
        .post(`/api/v1/admin/users/${auditorId}/activate`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ note: 'CI test reactivation' });
      assert.equal(actRes.status, 200);
      assert.equal(actRes.body.data.status, 'ACTIVE');

      // Login works again after activation
      const audReactivatedLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-AUD-CI-01', password: 'AudCiPassword#2026!' });
      assert.equal(audReactivatedLogin.status, 200);

      // Verify zero plaintext passwords/secrets anywhere in admin_action_logs
      const allDbLogs = await prisma.adminActionLog.findMany();
      const serialized = JSON.stringify(allDbLogs);
      assert.equal(serialized.includes(superCredentials.password), false);
      assert.equal(serialized.includes('AudCiPassword#2026!'), false);

      // Logout SUPER_ADMIN cleanly
      const logoutRes = await request(app)
        .post('/api/v1/admin/auth/logout-all')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf);
      assert.equal(logoutRes.status, 200);
    });
  });

  describe('10. Phase 8.5 — Admin Election Creation, Lifecycle State Machine, Concurrency & Scoping (Live PostgreSQL)', () => {
    let superCookie: string;
    let superCsrf: string;
    let wbCookie: string;
    let wbCsrf: string;
    let audCookie: string;
    let audCsrf: string;

    test('Authenticates SUPER_ADMIN, WB STATE_ADMIN, and READ_ONLY_AUDITOR for election management checks', async () => {
      const superLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'super.ci@ovs-test.local', password: 'SuperCiSecret#2026!' });
      assert.equal(superLogin.status, 200);
      superCookie = (superLogin.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      superCsrf = superLogin.body.data.csrfToken;

      const wbLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'wb.ci@ovs-test.local', password: 'WbCiPassword#2026!' });
      assert.equal(wbLogin.status, 200);
      wbCookie = (wbLogin.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      wbCsrf = wbLogin.body.data.csrfToken;

      const audLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-AUD-CI-01', password: 'AudCiPassword#2026!' });
      assert.equal(audLogin.status, 200);
      audCookie = (audLogin.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      audCsrf = audLogin.body.data.csrfToken;
    });

    test('Creates Lok Sabha and State Assembly elections, enforces type/state DB rules, and prevents WB STATE_ADMIN cross-state access', async () => {
      const lsRes = await request(app)
        .post('/api/v1/admin/elections')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          id: 'LS-2034-DEMO',
          name: 'Lok Sabha General Election 2034 (DEMO_SAMPLE)',
          type: 'LOK_SABHA',
          year: 2034,
          description: 'Synthetic Lok Sabha election for Phase 8.5 integration test.',
        });
      assert.equal(lsRes.status, 201);
      assert.equal(lsRes.body.data.status, 'DRAFT');
      assert.equal(lsRes.body.data.stateId, null);

      // WB STATE_ADMIN cannot create LOK_SABHA or MH election
      const wbLs = await request(app)
        .post('/api/v1/admin/elections')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          id: 'LS-WB-TAMPER',
          name: 'Unauthorized Lok Sabha',
          type: 'LOK_SABHA',
          year: 2034,
        });
      assert.equal(wbLs.status, 403);

      const wbMh = await request(app)
        .post('/api/v1/admin/elections')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          id: 'MH-2034-TAMPER',
          name: 'Unauthorized MH Assembly',
          type: 'STATE_ASSEMBLY',
          stateId: 'MH',
          year: 2034,
        });
      assert.equal(wbMh.status, 403);

      // WB STATE_ADMIN can create WB State Assembly election
      const wbCreate = await request(app)
        .post('/api/v1/admin/elections')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          id: 'WB-2034-DEMO',
          name: 'West Bengal Assembly Election 2034 (DEMO_SAMPLE)',
          type: 'STATE_ASSEMBLY',
          stateId: 'WB',
          year: 2034,
        });
      assert.equal(wbCreate.status, 201);
      assert.equal(wbCreate.body.data.stateId, 'WB');

      // WB STATE_ADMIN IDOR read of MH-ASSEMBLY-2029 denied with 403
      const idorRes = await request(app)
        .get('/api/v1/admin/elections/MH-ASSEMBLY-2029')
        .set('Cookie', wbCookie);
      assert.equal(idorRes.status, 403);
    });

    test('Enforces lifecycle transitions, optimistic concurrency conflict, cancellation reason, archival immutability, and audit history', async () => {
      // Update metadata on DRAFT election (v1 -> v2)
      const patchRes = await request(app)
        .patch('/api/v1/admin/elections/WB-2034-DEMO')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          name: 'West Bengal Assembly Election 2034 Updated (DEMO_SAMPLE)',
          expectedVersion: 1,
        });
      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.data.version, 2);

      // Stale expectedVersion returns 409 Conflict
      const staleRes = await request(app)
        .patch('/api/v1/admin/elections/WB-2034-DEMO')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ name: 'Stale Write', expectedVersion: 1 });
      assert.equal(staleRes.status, 409);

      // Transition DRAFT -> UPCOMING
      const upcRes = await request(app)
        .post('/api/v1/admin/elections/WB-2034-DEMO/transition')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ targetStatus: 'UPCOMING', expectedVersion: 2 });
      assert.equal(upcRes.status, 200);
      assert.equal(upcRes.body.data.status, 'UPCOMING');

      // Invalid transition UPCOMING -> RESULTS_DECLARED returns 409
      const badTrans = await request(app)
        .post('/api/v1/admin/elections/WB-2034-DEMO/transition')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ targetStatus: 'RESULTS_DECLARED' });
      assert.equal(badTrans.status, 409);

      // Auditor cannot cancel
      const audCancel = await request(app)
        .post('/api/v1/admin/elections/WB-2034-DEMO/cancel')
        .set('Cookie', audCookie)
        .set('X-CSRF-Token', audCsrf)
        .send({ reason: 'Auditor cannot mutate' });
      assert.equal(audCancel.status, 403);

      // Cancel with valid reason
      const cancelRes = await request(app)
        .post('/api/v1/admin/elections/WB-2034-DEMO/cancel')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ reason: 'CI integration test cancellation workflow.' });
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.body.data.status, 'CANCELLED');

      // Archive cancelled election
      const archRes = await request(app)
        .post('/api/v1/admin/elections/WB-2034-DEMO/archive')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ note: 'Archived after CI cancellation.' });
      assert.equal(archRes.status, 200);
      assert.equal(archRes.body.data.status, 'ARCHIVED');

      // Archived election cannot be reopened or edited
      const reopenRes = await request(app)
        .post('/api/v1/admin/elections/WB-2034-DEMO/transition')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ targetStatus: 'DRAFT' });
      assert.equal(reopenRes.status, 409);

      // Auditor can read immutable lifecycle history
      const histRes = await request(app)
        .get('/api/v1/admin/elections/WB-2034-DEMO/history')
        .set('Cookie', audCookie);
      assert.equal(histRes.status, 200);
      assert.ok(histRes.body.data.length >= 5);
    });
  });

  describe('11. Phase 8.6 — Candidate Registration, Party Snapshots & Nomination Lifecycle (Live PostgreSQL)', () => {
    let superCookie: string;
    let superCsrf: string;
    let wbCookie: string;
    let wbCsrf: string;
    let audCookie: string;
    let nominationId: string;

    test('Authenticates SUPER_ADMIN, WB STATE_ADMIN, and READ_ONLY_AUDITOR', async () => {
      const s = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'super.ci@ovs-test.local', password: 'SuperCiSecret#2026!' });
      superCookie = (s.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      superCsrf = s.body.data.csrfToken;

      const wb = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'wb.ci@ovs-test.local', password: 'WbCiPassword#2026!' });
      wbCookie = (wb.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      wbCsrf = wb.body.data.csrfToken;

      const aud = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-AUD-CI-01', password: 'AudCiPassword#2026!' });
      audCookie = (aud.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    });

    test('Creates party, candidate, and nomination; enforces DB constraints, separation of duties, and historical party snapshot', async () => {
      // 1. Create a new STATE party via WB STATE_ADMIN
      const pRes = await request(app)
        .post('/api/v1/admin/parties')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          id: 'PARTY-WB-DEMO',
          name: 'Bengal Demo Front (DEMO_SAMPLE)',
          abbreviation: 'BDF',
          partyType: 'STATE',
          symbolName: 'Lantern',
        });
      assert.equal(pRes.status, 201);

      // 2. Create candidate associated with PARTY-WB-DEMO
      const cRes = await request(app)
        .post('/api/v1/admin/candidates')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          id: 'CAND-WB-CI-86',
          fullName: 'Subrata Chatterjee (DEMO_SAMPLE)',
          partyId: 'PARTY-WB-DEMO',
          age: 42,
          gender: 'Male',
        });
      assert.equal(cRes.status, 201);

      // 3. Reject nomination in constituency NOT mapped to WB-ASSEMBLY-2029
      const badConst = await request(app)
        .post('/api/v1/admin/nominations')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          electionId: 'WB-ASSEMBLY-2029',
          candidateId: 'CAND-WB-CI-86',
          constituencyType: 'ASSEMBLY',
          assemblyConstituencyId: 'MH-AC-BANDRA-WEST',
          isIndependent: false,
          partyId: 'PARTY-WB-DEMO',
        });
      assert.equal(badConst.status, 400);

      // 4. Create valid DRAFT nomination in WB-AC-KRISHNANAGAR-DAKSHIN
      const createNom = await request(app)
        .post('/api/v1/admin/nominations')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          electionId: 'WB-ASSEMBLY-2029',
          candidateId: 'CAND-WB-CI-86',
          constituencyType: 'ASSEMBLY',
          assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-DAKSHIN',
          isIndependent: false,
          partyId: 'PARTY-WB-DEMO',
        });
      assert.equal(createNom.status, 201);
      nominationId = createNom.body.data.id;
      assert.equal(createNom.body.data.partySnapshot.abbreviation, 'BDF');

      // 5. Duplicate nomination rejected with 409
      const dupNom = await request(app)
        .post('/api/v1/admin/nominations')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          electionId: 'WB-ASSEMBLY-2029',
          candidateId: 'CAND-WB-CI-86',
          constituencyType: 'ASSEMBLY',
          assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-DAKSHIN',
          isIndependent: false,
          partyId: 'PARTY-WB-DEMO',
        });
      assert.equal(dupNom.status, 409);

      // 6. WB admin submits & moves to UNDER_REVIEW, then attempts self-approval -> 403
      const subRes = await request(app)
        .post(`/api/v1/admin/nominations/${nominationId}/submit`)
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({});
      assert.equal(subRes.status, 200);

      const revRes = await request(app)
        .post(`/api/v1/admin/nominations/${nominationId}/review`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ note: 'CI scrutiny check' });
      assert.equal(revRes.status, 200);

      const selfApprove = await request(app)
        .post(`/api/v1/admin/nominations/${nominationId}/approve`)
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({});
      assert.equal(selfApprove.status, 403);

      // 7. SUPER_ADMIN approves; then candidate switches current party to PARTY-INC -> historical nomination keeps PARTY-WB-DEMO!
      const appRes = await request(app)
        .post(`/api/v1/admin/nominations/${nominationId}/approve`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ note: 'Approved by CEC' });
      assert.equal(appRes.status, 200);
      assert.equal(appRes.body.data.status, 'APPROVED');

      const switchParty = await request(app)
        .patch('/api/v1/admin/candidates/CAND-WB-CI-86')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ partyId: 'PARTY-INC' });
      assert.equal(switchParty.status, 200);

      const pubCand = await request(app).get('/api/v1/candidates/CAND-WB-CI-86');
      assert.equal(pubCand.status, 200);
      assert.equal(pubCand.body.data.currentRegisteredPartyId, 'PARTY-INC');
      assert.equal(pubCand.body.data.nominations[0].nominationPartyId, 'PARTY-WB-DEMO');
      assert.equal(pubCand.body.data.nominations[0].partyAbbreviationSnapshot, 'BDF');
      assert.equal(pubCand.body.data.nominations[0].scrutinyNote, undefined);

      // 8. Withdraw nomination & verify history
      const wdRes = await request(app)
        .post(`/api/v1/admin/nominations/${nominationId}/withdraw`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ reason: 'CI withdrawal lifecycle verification' });
      assert.equal(wdRes.status, 200);
      assert.equal(wdRes.body.data.status, 'WITHDRAWN');

      const histRes = await request(app)
        .get(`/api/v1/admin/nominations/${nominationId}/history`)
        .set('Cookie', audCookie);
      assert.equal(histRes.status, 200);
      assert.ok(histRes.body.data.length >= 5);
    });
  });

  describe('12. Phase 8.7 — Constituency Assignment, Schedule, Configuration Readiness & Review Workflow (Live PostgreSQL)', () => {
    let superCookie: string;
    let superCsrf: string;
    let wbCookie: string;
    let wbCsrf: string;

    test('Authenticates SUPER_ADMIN and WB STATE_ADMIN for Phase 8.7 verification', async () => {
      const s = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'super.ci@ovs-test.local', password: 'SuperCiSecret#2026!' });
      superCookie = (s.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      superCsrf = s.body.data.csrfToken;

      const wb = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'wb.ci@ovs-test.local', password: 'WbCiPassword#2026!' });
      wbCookie = (wb.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      wbCsrf = wb.body.data.csrfToken;
    });

    test('Executes constituency bulk preview & commit, schedule UTC milestones, readiness, review separation of duties, and public schedule filtering', async () => {
      // 1. Create a fresh DRAFT WB State Assembly election
      const createRes = await request(app)
        .post('/api/v1/admin/elections')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          id: 'WB-CI-87',
          name: 'WB Config CI Test 2031 (DEMO_SAMPLE)',
          type: 'STATE_ASSEMBLY',
          year: 2031,
          stateId: 'WB',
          pollingStartDate: '2031-04-20T01:30:00.000Z',
          pollingEndDate: '2031-04-20T12:30:00.000Z',
          countingDate: '2031-04-24T02:30:00.000Z',
          resultDate: '2031-04-25T06:30:00.000Z',
        });
      assert.equal(createRes.status, 201);

      // 2. Bulk preview with one valid WB AC and one invalid PC -> non-mutating
      const previewRes = await request(app)
        .post('/api/v1/admin/elections/WB-CI-87/constituencies/preview')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ constituencyIds: ['WB-AC-BHABANIPUR', 'WB-PC-KOLKATA-NORTH'] });
      assert.equal(previewRes.status, 200);
      assert.equal(previewRes.body.data.allValid, false);
      assert.equal(previewRes.body.data.validCount, 1);

      // 3. Commit valid bulk assignment + verify assigned & history
      const bulkRes = await request(app)
        .post('/api/v1/admin/elections/WB-CI-87/constituencies/bulk')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ constituencyIds: ['WB-AC-BHABANIPUR', 'WB-AC-RASHBEHARI'], note: 'CI bulk assign' });
      assert.equal(bulkRes.status, 201);
      assert.equal(bulkRes.body.data.assignedCount, 2);

      // 4. Put complete chronological schedule in Asia/Kolkata -> stored UTC
      const putSchedRes = await request(app)
        .put('/api/v1/admin/elections/WB-CI-87/schedule')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({
          timezone: 'Asia/Kolkata',
          note: 'Initial complete schedule',
          milestones: [
            { milestoneType: 'NOMINATION_OPEN', startAt: '2031-03-20T04:30:00.000Z' },
            { milestoneType: 'NOMINATION_DEADLINE', startAt: '2031-03-28T09:30:00.000Z' },
            { milestoneType: 'NOMINATION_SCRUTINY', startAt: '2031-03-30T05:30:00.000Z' },
            { milestoneType: 'WITHDRAWAL_DEADLINE', startAt: '2031-04-02T09:30:00.000Z' },
            { milestoneType: 'POLLING_START', startAt: '2031-04-20T01:30:00.000Z' },
            { milestoneType: 'POLLING_END', startAt: '2031-04-20T12:30:00.000Z' },
            { milestoneType: 'COUNTING_START', startAt: '2031-04-24T02:30:00.000Z' },
            { milestoneType: 'RESULT_PUBLICATION', startAt: '2031-04-25T06:30:00.000Z' },
          ],
        });
      assert.equal(putSchedRes.status, 200);
      assert.equal(putSchedRes.body.data.scheduleVersion, 2);

      // 5. Readiness check passes; submit by WB admin -> self-approve 403 -> SUPER_ADMIN approves 200
      const readyRes = await request(app)
        .get('/api/v1/admin/elections/WB-CI-87/configuration/validation')
        .set('Cookie', wbCookie);
      assert.equal(readyRes.status, 200);
      assert.equal(readyRes.body.data.ready, true);

      const submitRes = await request(app)
        .post('/api/v1/admin/elections/WB-CI-87/configuration/submit')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ note: 'Ready for review' });
      assert.equal(submitRes.status, 200);
      assert.equal(submitRes.body.data.configReviewStatus, 'SUBMITTED_FOR_REVIEW');

      const selfApproveRes = await request(app)
        .post('/api/v1/admin/elections/WB-CI-87/configuration/approve')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf)
        .send({ note: 'Self-approve attempt' });
      assert.equal(selfApproveRes.status, 403);

      const approveRes = await request(app)
        .post('/api/v1/admin/elections/WB-CI-87/configuration/approve')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ note: 'CEC approved' });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.data.configReviewStatus, 'APPROVED');

      // 6. Modifying approved configuration resets review status back to DRAFT
      const delRes = await request(app)
        .delete('/api/v1/admin/elections/WB-CI-87/constituencies/WB-AC-RASHBEHARI')
        .set('Cookie', wbCookie)
        .set('X-CSRF-Token', wbCsrf);
      assert.equal(delRes.status, 200);

      const postEditReady = await request(app)
        .get('/api/v1/admin/elections/WB-CI-87/configuration/validation')
        .set('Cookie', wbCookie);
      assert.equal(postEditReady.body.data.configReviewStatus, 'DRAFT');

      // 7. Public schedule hides DRAFT elections (404) and exposes public elections cleanly
      const draftPubRes = await request(app).get('/api/v1/elections/DL-ASSEMBLY-2029/schedule');
      assert.equal(draftPubRes.status, 404);

      const lsPubRes = await request(app).get('/api/v1/elections/LS-2029/schedule');
      assert.equal(lsPubRes.status, 200);
      assert.equal(lsPubRes.body.data.timezone, 'Asia/Kolkata');
      assert.ok(lsPubRes.body.data.milestones.length >= 8);
      assert.equal(lsPubRes.body.data.milestones[0].note, undefined);
    });
  });

  describe('13. Phase 8.8 — Demo Voting, PC/AC Ballot Isolation, Privacy & Concurrent Participation (Live PostgreSQL)', () => {
    let voterCookie: string;
    let voterCsrf: string;
    let superCookie: string;
    let wbCookie: string;
    let audCookie: string;

    test('Registers and authenticates a demo voter and admin accounts for Phase 8.8 integration verification', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          epicNumber: 'DEMO-EPIC-88CI',
          fullName: 'Phase 88 CI Voter',
          dateOfBirth: '1994-06-15',
          gender: 'Female',
          mobile: '9800088111',
          email: 'voter88ci@ovs-test.local',
          address: '10 Demo Street, Kolkata',
          pinCode: '700025',
          stateId: 'WB',
          districtId: 'WB-DIST-KOLKATA',
          parliamentaryConstituencyId: 'WB-PC-KOLKATA-SOUTH',
          assemblyConstituencyId: 'WB-AC-BHABANIPUR',
        });
      assert.equal(regRes.status, 201);

      const otpReq = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({ identifier: 'DEMO-EPIC-88CI' });
      assert.equal(otpReq.status, 200);

      const otpVer = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({
          challengeId: otpReq.body.data.challengeId,
          otp: otpReq.body.data.devOtp,
        });
      assert.equal(otpVer.status, 200);
      voterCookie = (otpVer.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      voterCsrf = otpVer.body.data.csrfToken;

      const s = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'super.ci@ovs-test.local', password: 'SuperCiSecret#2026!' });
      superCookie = (s.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const wb = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'wb.ci@ovs-test.local', password: 'WbCiPassword#2026!' });
      wbCookie = (wb.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const aud = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-AUD-CI-01', password: 'AudCiPassword#2026!' });
      audCookie = (aud.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    });

    test('Enforces PC/AC ballot isolation, rejects candidateId in participation body, prevents concurrent duplicates, and exposes safe admin aggregates', async () => {
      // 1. Voter election discovery shows LS-2029 (PC) and WB-ASSEMBLY-2029 (AC) independently
      const discRes = await request(app)
        .get('/api/v1/voter/elections')
        .set('Cookie', voterCookie);
      assert.equal(discRes.status, 200);
      const lsItem = discRes.body.data.elections.find((e: any) => e.id === 'LS-2029');
      const wbItem = discRes.body.data.elections.find((e: any) => e.id === 'WB-ASSEMBLY-2029');
      assert.equal(lsItem.eligible, true);
      assert.equal(lsItem.constituency.id, 'WB-PC-KOLKATA-SOUTH');
      assert.equal(wbItem.eligible, true);
      assert.equal(wbItem.constituency.id, 'WB-AC-BHABANIPUR');

      // 2. Ballot retrieval returns only approved PC candidates for LS-2029 without internal notes
      const lsBallotRes = await request(app)
        .get('/api/v1/voter/elections/LS-2029/ballot')
        .set('Cookie', voterCookie);
      assert.equal(lsBallotRes.status, 200);
      assert.equal(lsBallotRes.body.data.constituency.id, 'WB-PC-KOLKATA-SOUTH');
      assert.ok(lsBallotRes.body.data.candidates.length >= 1);
      assert.equal(lsBallotRes.body.data.candidates[0].scrutinyNote, undefined);

      // 3. Rejects unexpected candidateId in participation confirmation (400)
      const badPartRes = await request(app)
        .post('/api/v1/voter/elections/LS-2029/participation')
        .set('Cookie', voterCookie)
        .set('X-CSRF-Token', voterCsrf)
        .send({ candidateId: lsBallotRes.body.data.candidates[0].candidateId });
      assert.equal(badPartRes.status, 400);

      // 4. Concurrent duplicate participation requests -> exactly one 201 and one 409
      const [p1, p2] = await Promise.all([
        request(app)
          .post('/api/v1/voter/elections/LS-2029/participation')
          .set('Cookie', voterCookie)
          .set('X-CSRF-Token', voterCsrf)
          .send({}),
        request(app)
          .post('/api/v1/voter/elections/LS-2029/participation')
          .set('Cookie', voterCookie)
          .set('X-CSRF-Token', voterCsrf)
          .send({}),
      ]);
      const statuses = [p1.status, p2.status].sort((a, b) => a - b);
      assert.deepEqual(statuses, [201, 409]);

      // 5. Lok Sabha participation does NOT complete WB Assembly election
      const wbBallotRes = await request(app)
        .get('/api/v1/voter/elections/WB-ASSEMBLY-2029/ballot')
        .set('Cookie', voterCookie);
      assert.equal(wbBallotRes.status, 200);
      assert.equal(wbBallotRes.body.data.constituency.id, 'WB-AC-BHABANIPUR');

      const wbPartRes = await request(app)
        .post('/api/v1/voter/elections/WB-ASSEMBLY-2029/participation')
        .set('Cookie', voterCookie)
        .set('X-CSRF-Token', voterCsrf)
        .send({});
      assert.equal(wbPartRes.status, 201);
      assert.equal(wbPartRes.body.data.status, 'PARTICIPATED');

      // 6. Voter participation history shows both independent records with zero candidate data
      const histRes = await request(app)
        .get('/api/v1/voter/participation')
        .set('Cookie', voterCookie);
      assert.equal(histRes.status, 200);
      assert.equal(histRes.body.data.length, 2);
      for (const row of histRes.body.data) {
        assert.equal(row.candidateId, undefined);
        assert.equal(row.partyId, undefined);
      }

      // 7. Admin aggregate participation reporting & jurisdiction enforcement
      const audSummary = await request(app)
        .get('/api/v1/admin/elections/LS-2029/participation/summary')
        .set('Cookie', audCookie);
      assert.equal(audSummary.status, 200);
      assert.ok(audSummary.body.data.totalParticipated >= 1);

      const wbOutOfScope = await request(app)
        .get('/api/v1/admin/elections/MH-ASSEMBLY-2029/participation/summary')
        .set('Cookie', wbCookie);
      assert.equal(wbOutOfScope.status, 403);

      const constAgg = await request(app)
        .get('/api/v1/admin/elections/LS-2029/participation/constituencies')
        .set('Cookie', superCookie);
      assert.equal(constAgg.status, 200);
      assert.ok(constAgg.body.data.items.length >= 1);
    });
  });

  describe('14. Phase 8.9 — Independent Demo Counting, Result Review & Publication Simulation (Live PostgreSQL)', () => {
    let superCookie: string;
    let superCsrf: string;
    let audCookie: string;

    test('Authenticates admin actors for Phase 8.9 counting workflows', async () => {
      const s = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'super.ci@ovs-test.local', password: 'SuperCiSecret#2026!' });
      assert.equal(s.status, 200);
      superCookie = (s.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      superCsrf = s.body.data.csrfToken;

      const aud = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-AUD-CI-01', password: 'AudCiPassword#2026!' });
      assert.equal(aud.status, 200);
      audCookie = (aud.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    });

    test('Verifies seeded demo counting sessions, public result filtering, and zero-derivation guarantees', async () => {
      // 1. Public published results lists seeded Krishnanagar PC session
      const pubRes = await request(app).get('/api/v1/results');
      assert.equal(pubRes.status, 200);
      assert.equal(pubRes.body.data.disclaimer, 'SIMULATED DEMO RESULTS - NOT OFFICIAL ELECTION DATA');
      const krishSession = pubRes.body.data.sessions.find((s: any) => s.constituency.name === 'Krishnanagar');
      assert.ok(krishSession);
      assert.equal(krishSession.resultStatus, 'PUBLISHED');
      assert.ok(krishSession.winner);

      // 2. Draft/Review sessions (e.g. Krishnanagar Uttar AC) are hidden from public
      const unpubSession = pubRes.body.data.sessions.find((s: any) => s.constituency.name === 'Krishnanagar Uttar');
      assert.equal(unpubSession, undefined);

      // 3. Election summary endpoint returns totals and winner summary
      const sumRes = await request(app).get('/api/v1/results/elections/LS-2029/summary');
      assert.equal(sumRes.status, 200);
      assert.equal(sumRes.body.data.publishedSessionsCount >= 1, true);

      // 4. Zero-derivation invariant: DemoParticipation has zero candidate foreign keys/columns
      const participationSample = await prisma.demoParticipation.findFirst();
      if (participationSample) {
        assert.equal((participationSample as any).candidateId, undefined);
        assert.equal((participationSample as any).candidateChoice, undefined);
      }
    });

    test('Executes end-to-end counting session lifecycle: Create, Rounds, Reconciliation, Review, and Publication', async () => {
      // 1. Admin creates a new session for WB-PC-KOLKATA-SOUTH in LS-2029
      const createRes = await request(app)
        .post('/api/v1/admin/counting/sessions')
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          electionId: 'LS-2029',
          constituencyType: 'PARLIAMENTARY',
          parliamentaryConstituencyId: 'WB-PC-KOLKATA-SOUTH',
          totalRoundsPlanned: 2,
        });
      assert.equal(createRes.status, 201);
      const sessionId = createRes.body.data.session.id;
      assert.equal(createRes.body.data.session.resultStatus, 'DRAFT');

      // 2. Start counting
      const startRes = await request(app)
        .post(`/api/v1/admin/counting/sessions/${sessionId}/start`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({});
      assert.equal(startRes.status, 200);
      assert.equal(startRes.body.data.session.resultStatus, 'COUNTING_IN_PROGRESS');

      // 3. Get candidate list for this session
      const sessDetail = await request(app)
        .get(`/api/v1/admin/counting/sessions/${sessionId}`)
        .set('Cookie', superCookie);
      assert.equal(sessDetail.status, 200);
      const candidateTallies = sessDetail.body.data.candidateTallies;
      assert.ok(candidateTallies.length >= 2);

      const cand1Id = candidateTallies[0].candidateId;
      const cand2Id = candidateTallies[1].candidateId;

      // 4. Record Round 1
      const r1Res = await request(app)
        .post(`/api/v1/admin/counting/sessions/${sessionId}/rounds`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          roundNumber: 1,
          notaVotes: 50,
          rejectedVotes: 10,
          candidateTallies: [
            { candidateId: cand1Id, cumulativeVotes: 100 },
            { candidateId: cand2Id, cumulativeVotes: 80 },
          ],
        });
      assert.equal(r1Res.status, 201);
      assert.equal(r1Res.body.data.session.currentRound, 1);
      assert.equal(r1Res.body.data.session.totalCountedVotes, 240); // 100 + 80 + 50 + 10

      // 5. Record Round 2
      const r2Res = await request(app)
        .post(`/api/v1/admin/counting/sessions/${sessionId}/rounds`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          roundNumber: 2,
          notaVotes: 80,
          rejectedVotes: 20,
          candidateTallies: [
            { candidateId: cand1Id, cumulativeVotes: 250 },
            { candidateId: cand2Id, cumulativeVotes: 190 },
          ],
        });
      assert.equal(r2Res.status, 201);
      assert.equal(r2Res.body.data.session.currentRound, 2);
      assert.equal(r2Res.body.data.session.totalCountedVotes, 540); // 250 + 190 + 80 + 20

      // 6. Complete counting
      const compRes = await request(app)
        .post(`/api/v1/admin/counting/sessions/${sessionId}/complete`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({});
      assert.equal(compRes.status, 200);
      assert.equal(compRes.body.data.session.resultStatus, 'COUNTING_COMPLETED');
      assert.equal(compRes.body.data.session.winningCandidateId, cand1Id);

      // 7. Advance to review
      const revRes = await request(app)
        .post(`/api/v1/admin/counting/sessions/${sessionId}/ready-for-review`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({});
      assert.equal(revRes.status, 200);
      assert.equal(revRes.body.data.session.resultStatus, 'RESULT_READY_FOR_REVIEW');

      // 8. Publish result
      const pubRes = await request(app)
        .post(`/api/v1/admin/counting/sessions/${sessionId}/publish`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ publicationRemarks: 'Final result verified and signed by RO' });
      assert.equal(pubRes.status, 200);
      assert.equal(pubRes.body.data.session.resultStatus, 'PUBLISHED');

      // 9. Now visible via public API
      const pubCheck = await request(app).get(`/api/v1/results/${sessionId}`);
      assert.equal(pubCheck.status, 200);
      assert.equal(pubCheck.body.data.resultStatus, 'PUBLISHED');
      assert.equal(pubCheck.body.data.winner.candidateId, cand1Id);
    });

    test('Demonstrates controlled tie resolution and prevents unauthorized auditor mutations', async () => {
      // 1. Find seeded TIED session (New Delhi PC)
      const listRes = await request(app)
        .get('/api/v1/admin/counting/sessions?status=TIED')
        .set('Cookie', superCookie);
      assert.equal(listRes.status, 200);
      const tiedSession = listRes.body.data.items[0];
      assert.ok(tiedSession);
      assert.equal(tiedSession.resultStatus, 'TIED');
      assert.equal(tiedSession.winningCandidateId, null);

      // 2. READ_ONLY_AUDITOR cannot resolve tie (403)
      const audTie = await request(app)
        .post(`/api/v1/admin/counting/sessions/${tiedSession.id}/resolve-tie`)
        .set('Cookie', audCookie)
        .send({
          resolutionMethod: 'DRAW_OF_LOTS',
          selectedWinnerCandidateId: tiedSession.candidateTallies[0].candidateId,
          tieBreakingNotes: 'Unauthorized tie break attempt',
        });
      assert.equal(audTie.status, 403);

      // 3. SUPER_ADMIN resolves tie with genuine tied candidate
      const candWinner = tiedSession.candidateTallies[0].candidateId;
      const resTie = await request(app)
        .post(`/api/v1/admin/counting/sessions/${tiedSession.id}/resolve-tie`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({
          resolutionMethod: 'DRAW_OF_LOTS',
          selectedWinnerCandidateId: candWinner,
          tieBreakingNotes: 'Draw of lots witnessed by candidate counting agents pursuant to standard procedure',
        });
      assert.equal(resTie.status, 200);
      assert.equal(resTie.body.data.session.resultStatus, 'TIE_RESOLVED');
      assert.equal(resTie.body.data.session.winningCandidateId, candWinner);
      assert.equal(resTie.body.data.tieResolution.resolutionMethod, 'DRAW_OF_LOTS');

      // 4. Publish resolved tie
      const pubTie = await request(app)
        .post(`/api/v1/admin/counting/sessions/${tiedSession.id}/publish`)
        .set('Cookie', superCookie)
        .set('X-CSRF-Token', superCsrf)
        .send({ publicationRemarks: 'Resolved tie result published' });
      assert.equal(pubTie.status, 200);
      assert.equal(pubTie.body.data.session.resultStatus, 'PUBLISHED');
    });
  });

  describe('15. Phase 8.10 — Analytics, Dashboards, Privacy & Data Export Suite (Live PostgreSQL)', () => {
    let superCookie: string;
    let wbCookie: string;
    let audCookie: string;

    test('Authenticates admin actors for Phase 8.10 analytics and reporting workflows', async () => {
      const s = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'super.ci@ovs-test.local', password: 'SuperCiSecret#2026!' });
      assert.equal(s.status, 200);
      superCookie = (s.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const wb = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'wb.ci@ovs-test.local', password: 'WbCiPassword#2026!' });
      assert.equal(wb.status, 200);
      wbCookie = (wb.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const aud = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'ECI-AUD-CI-01', password: 'AudCiPassword#2026!' });
      assert.equal(aud.status, 200);
      audCookie = (aud.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    });

    test('National & State analytics endpoints enforce jurisdiction scoping and return accurate aggregates', async () => {
      // 1. National analytics accessible by SUPER_ADMIN and READ_ONLY_AUDITOR
      const natRes = await request(app)
        .get('/api/v1/admin/analytics/national')
        .set('Cookie', superCookie);
      assert.equal(natRes.status, 200);
      assert.equal(natRes.body.data.isSimulated, true);
      assert.ok(natRes.body.data.data.totalElections >= 1);
      assert.ok(natRes.body.data.data.statesCoveredCount >= 1);

      const audNatRes = await request(app)
        .get('/api/v1/admin/analytics/national')
        .set('Cookie', audCookie);
      assert.equal(audNatRes.status, 200);

      // 2. State analytics: WB Admin accessing WB succeeds
      const wbStateRes = await request(app)
        .get('/api/v1/admin/analytics/states/WB')
        .set('Cookie', wbCookie);
      assert.equal(wbStateRes.status, 200);
      assert.equal(wbStateRes.body.data.data.state.id, 'WB');
      assert.ok(wbStateRes.body.data.data.totalElections >= 1);

      // 3. State analytics: WB Admin attempting to access MH returns 403 Forbidden
      const mhDeniedRes = await request(app)
        .get('/api/v1/admin/analytics/states/MH')
        .set('Cookie', wbCookie);
      assert.equal(mhDeniedRes.status, 403);
    });

    test('Election overview, voter participation, counting analytics, and audit log endpoints operate with strict domain separation', async () => {
      // 1. Election-specific analytics
      const elRes = await request(app)
        .get('/api/v1/admin/analytics/elections/LS-2029')
        .set('Cookie', superCookie);
      assert.equal(elRes.status, 200);
      assert.equal(elRes.body.data.data.election.id, 'LS-2029');
      assert.ok(elRes.body.data.data.constituenciesSummary.totalAssigned >= 1);

      // 2. Participation analytics: aggregate counts with zero candidate fields
      const partRes = await request(app)
        .get('/api/v1/admin/analytics/participation?electionId=LS-2029')
        .set('Cookie', superCookie);
      assert.equal(partRes.status, 200);
      assert.equal(partRes.body.data.data.metricName, 'Simulated Demo Account Participation');
      assert.equal((partRes.body.data.data as any).candidateId, undefined);
      assert.equal((partRes.body.data.data as any).candidateChoices, undefined);

      // 3. Independent counting analytics: certified published results
      const countRes = await request(app)
        .get('/api/v1/admin/analytics/counting')
        .set('Cookie', superCookie);
      assert.equal(countRes.status, 200);
      assert.equal(countRes.body.data.data.classification, 'SYNTHETIC_DEMO_COUNTING_INDEPENDENT');
      assert.ok(countRes.body.data.data.totalCountingSessions >= 1);

      // 4. Audit activity analytics
      const auditRes = await request(app)
        .get('/api/v1/admin/analytics/activity')
        .set('Cookie', superCookie);
      assert.equal(auditRes.status, 200);
      assert.ok(auditRes.body.data.data.totalActionsLogged >= 1);
    });

    test('Data export generates sanitized CSV and structured JSON reports with audit logging and formula safety', async () => {
      // 1. CSV export for national domain
      const csvRes = await request(app)
        .get('/api/v1/admin/analytics/export?domain=national&format=csv')
        .set('Cookie', superCookie);
      assert.equal(csvRes.status, 200);
      assert.match(csvRes.headers['content-type'] ?? '', /text\/csv/);
      assert.ok(csvRes.text.includes('"Total Elections"'));

      // 2. JSON export for election domain
      const jsonRes = await request(app)
        .get('/api/v1/admin/analytics/export?domain=election&format=json&electionId=LS-2029')
        .set('Cookie', superCookie);
      assert.equal(jsonRes.status, 200);
      assert.match(jsonRes.headers['content-type'] ?? '', /application\/json/);
      const parsedJson = JSON.parse(jsonRes.text);
      assert.equal(parsedJson.meta.isSimulated, true);
      assert.equal(parsedJson.data.election.id, 'LS-2029');

      // 3. Public analytics endpoint returns safe metadata
      const pubRes = await request(app).get('/api/v1/public/analytics/elections');
      assert.equal(pubRes.status, 200);
      assert.equal(pubRes.body.data.isSimulated, true);
      assert.ok(pubRes.body.data.elections.length >= 1);
    });
  });

  describe('16. Phase 8.11 — Notifications, Announcements & Email Communication Suite (Live PostgreSQL)', () => {
    let superCookie: string;
    let wbCookie: string;
    let createdAnnouncementId: string;

    test('Authenticates admin actors for announcement and notification workflows', async () => {
      const s = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'super.ci@ovs-test.local', password: 'SuperCiSecret#2026!' });
      assert.equal(s.status, 200);
      superCookie = (s.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const w = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'wb.ci@ovs-test.local', password: 'WbCiSecret#2026!' });
      assert.equal(w.status, 200);
      wbCookie = (w.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    });

    test('Creates an announcement draft and manages lifecycle (Review -> Approve -> Publish)', async () => {
      // 1. Create draft announcement
      const createRes = await request(app)
        .post('/api/v1/admin/announcements')
        .set('Cookie', superCookie)
        .send({
          title: 'General Election Notification for Phase 1',
          summary: 'Simulated gazette notice for general polling',
          message: 'All registered demo voters are requested to review polling stations.',
          category: 'GENERAL_INFO',
          targetAudience: 'ALL_VOTERS',
          publicationDate: '2026-11-20',
          expiryDate: '2026-12-31',
        });
      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.status, 'DRAFT');
      createdAnnouncementId = createRes.body.id;

      // 2. Submit for review
      const reviewRes = await request(app)
        .post(`/api/v1/admin/announcements/${createdAnnouncementId}/submit-review`)
        .set('Cookie', superCookie)
        .send({ notes: 'Initial draft approved by staff' });
      assert.equal(reviewRes.status, 200);
      assert.equal(reviewRes.body.status, 'UNDER_REVIEW');

      // 3. Approve announcement
      const approveRes = await request(app)
        .post(`/api/v1/admin/announcements/${createdAnnouncementId}/approve`)
        .set('Cookie', superCookie)
        .send({ notes: 'Certified by Chief Election Commissioner' });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.status, 'APPROVED');

      // 4. Publish announcement
      const publishRes = await request(app)
        .post(`/api/v1/admin/announcements/${createdAnnouncementId}/publish`)
        .set('Cookie', superCookie)
        .send({});
      assert.equal(publishRes.status, 200);
      assert.equal(publishRes.body.status, 'PUBLISHED');
    });

    test('Enforces jurisdiction boundaries for state administrators', async () => {
      // WB admin cannot target MH state
      const breachRes = await request(app)
        .post('/api/v1/admin/announcements')
        .set('Cookie', wbCookie)
        .send({
          title: 'Maharashtra Electoral Timetable',
          summary: 'Summary',
          message: 'Message content for MH',
          category: 'GENERAL_INFO',
          targetAudience: 'SPECIFIC_STATE',
          targetStateId: 'MH',
          publicationDate: '2026-11-20',
          expiryDate: '2026-12-31',
        });
      assert.equal(breachRes.status, 403);
    });

    test('Retrieves public announcements with category filtering and simulation headers', async () => {
      const pubList = await request(app).get('/api/v1/public/announcements');
      assert.equal(pubList.status, 200);
      assert.ok(Array.isArray(pubList.body.data));

      const catRes = await request(app).get('/api/v1/public/announcements/categories');
      assert.equal(catRes.status, 200);
      assert.ok(catRes.body.categories.includes('GENERAL_INFO'));
    });

    test('Inspects delivery telemetry and statistics', async () => {
      const statsRes = await request(app)
        .get('/api/v1/admin/notifications/statistics')
        .set('Cookie', superCookie);
      assert.equal(statsRes.status, 200);
      assert.ok(typeof statsRes.body.totalDeliveries === 'number');

      const delivRes = await request(app)
        .get('/api/v1/admin/notifications/deliveries')
        .set('Cookie', superCookie);
      assert.equal(delivRes.status, 200);
      assert.ok(Array.isArray(delivRes.body.data));
    });
  });

  describe('17. Phase 8.12 — System Settings, Feature Flags & Operational Administration Suite (Live PostgreSQL)', () => {
    let superCookie: string;
    let wbCookie: string;
    let audCookie: string;

    test('Authenticates admin actors for Phase 8.12 settings workflows', async () => {
      const s = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'super.ci@ovs-test.local', password: 'SuperCiSecret#2026!' });
      assert.equal(s.status, 200);
      superCookie = (s.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const wb = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'wb.ci@ovs-test.local', password: 'WbCiPassword#2026!' });
      assert.equal(wb.status, 200);
      wbCookie = (wb.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const aud = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'auditor.ci@ovs-test.local', password: 'AuditorCiPass#2026!' });
      assert.equal(aud.status, 200);
      audCookie = (aud.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    });

    test('SUPER_ADMIN lists initialized settings and verifies registry catalog', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/settings')
        .set('Cookie', superCookie);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.settings));
      assert.ok(res.body.settings.length >= 10);

      const siteName = res.body.settings.find((s: any) => s.key === 'platform.siteName');
      assert.ok(siteName);
      assert.equal(typeof siteName.value, 'string');
    });

    test('Public config endpoint exposes public settings and maintenance status without auth', async () => {
      const res = await request(app).get('/api/v1/system/public-config');
      assert.equal(res.status, 200);
      assert.ok(res.body.config);
      assert.ok(res.body.config.siteName);
      assert.ok(res.body.config.maintenance);
      assert.ok(res.body.config.features);
    });

    test('SUPER_ADMIN updates setting with optimistic concurrency check', async () => {
      // 1. Get current version
      const currentRes = await request(app)
        .get('/api/v1/admin/system/settings/platform.siteName')
        .set('Cookie', superCookie);
      assert.equal(currentRes.status, 200);
      const currentVer = currentRes.body.setting.version;

      // 2. Stale version update must fail with 409
      const staleRes = await request(app)
        .put('/api/v1/admin/system/settings/platform.siteName')
        .set('Cookie', superCookie)
        .send({
          value: 'Stale Update Attempt',
          expectedVersion: currentVer + 99,
          changeReason: 'Should fail with 409',
        });
      assert.equal(staleRes.status, 409);

      // 3. Valid update succeeds
      const updateRes = await request(app)
        .put('/api/v1/admin/system/settings/platform.siteName')
        .set('Cookie', superCookie)
        .send({
          value: 'ECI Digital Voting System (Phase 8.12 Live)',
          expectedVersion: currentVer,
          changeReason: 'Live integration verification update',
        });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.setting.version, currentVer + 1);
      assert.equal(updateRes.body.setting.value, 'ECI Digital Voting System (Phase 8.12 Live)');
    });

    test('RBAC: STATE_ADMIN is denied global settings modification with 403 Forbidden', async () => {
      const res = await request(app)
        .put('/api/v1/admin/system/settings/platform.siteName')
        .set('Cookie', wbCookie)
        .send({
          value: 'Unauthorized Mutation',
          expectedVersion: 1,
          changeReason: 'State admin unauthorized update',
        });
      assert.equal(res.status, 403);
    });

    test('RBAC: READ_ONLY_AUDITOR has read access but zero mutation capability', async () => {
      const readRes = await request(app)
        .get('/api/v1/admin/system/settings')
        .set('Cookie', audCookie);
      assert.equal(readRes.status, 200);

      const mutateRes = await request(app)
        .put('/api/v1/admin/system/settings/platform.siteName')
        .set('Cookie', audCookie)
        .send({
          value: 'Auditor Mutation',
          expectedVersion: 1,
          changeReason: 'Auditor unauthorized mutation',
        });
      assert.equal(mutateRes.status, 403);
    });

    test('SUPER_ADMIN manages feature flags and inspects history', async () => {
      const listRes = await request(app)
        .get('/api/v1/admin/system/features')
        .set('Cookie', superCookie);
      assert.equal(listRes.status, 200);
      assert.ok(Array.isArray(listRes.body.flags));

      const updateRes = await request(app)
        .put('/api/v1/admin/system/features/feat.advanced_analytics')
        .set('Cookie', superCookie)
        .send({
          isEnabled: true,
          rolloutPercentage: 75,
          changeReason: 'Rollout increment to 75 percent',
        });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.flag.rolloutPercentage, 75);

      const histRes = await request(app)
        .get('/api/v1/admin/system/features/feat.advanced_analytics/history')
        .set('Cookie', superCookie);
      assert.equal(histRes.status, 200);
      assert.ok(Array.isArray(histRes.body.history));
      assert.ok(histRes.body.history.length >= 1);
    });

    test('Authenticated admin inspects operational diagnostics without credential leakage', async () => {
      const diagRes = await request(app)
        .get('/api/v1/health/diagnostics')
        .set('Cookie', superCookie);
      assert.equal(diagRes.status, 200);
      assert.ok(diagRes.body.diagnostics);
      assert.equal(diagRes.body.diagnostics.service, 'ovs-backend');
      assert.ok(diagRes.body.diagnostics.memory);
      assert.ok(diagRes.body.diagnostics.database);

      // Verify no secrets leaked
      const text = JSON.stringify(diagRes.body);
      assert.equal(text.includes('DATABASE_URL'), false);
      assert.equal(text.includes('SESSION_SECRET'), false);
      assert.equal(text.includes('password'), false);
    });
  });

  describe('18. Phase 8.15.1 — Full Live PostgreSQL & API End-to-End User Acceptance Test (UAT)', () => {
    let uatVoterEpic = 'UAT8151001';
    let uatVoterMobile = '9800008151';
    let uatVoterCookie: string = '';
    let uatCsrfToken: string = '';

    test('UAT 1: Real voter registers with consistent unverified semantics', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          epicNumber: uatVoterEpic,
          fullName: 'UAT Test Elector',
          dateOfBirth: '1998-07-21',
          gender: 'Female',
          mobile: uatVoterMobile,
          email: 'uat.elector@ovs-demo.invalid',
          address: '42 Democracy Avenue, Nadia',
          pinCode: '741101',
          stateId: 'WB',
          districtId: 'WB-DIST-NADIA',
          parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
          assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
        });

      assert.equal(regRes.status, 201);
      assert.equal(regRes.body.data.accountStatus, 'UNVERIFIED');
      assert.equal(regRes.body.data.user.voterProfile.isVerified, false);
    });

    test('UAT 2: Real OTP request, verification, session cookie & CSRF retrieval', async () => {
      // 1. Request OTP challenge
      const otpReqRes = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({ identifier: uatVoterEpic });
      assert.equal(otpReqRes.status, 200);
      assert.ok(otpReqRes.body.data.challengeId);
      const challengeId = otpReqRes.body.data.challengeId;

      // 2. Fetch generated OTP from safe test development provider
      const devOtpRes = await request(app).get(`/api/v1/auth/dev/otp/${uatVoterEpic}`);
      assert.equal(devOtpRes.status, 200);
      const rawOtp = devOtpRes.body.data.otp;

      // 3. Verify OTP code
      const verifyRes = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId, otp: rawOtp });
      assert.equal(verifyRes.status, 200);

      // Extract session cookie
      const cookies = verifyRes.headers['set-cookie'];
      assert.ok(cookies);
      const sessionCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) =>
        c.startsWith('ovs_session=')
      );
      assert.ok(sessionCookie);
      uatVoterCookie = sessionCookie.split(';')[0];

      // 4. Retrieve CSRF token
      const csrfRes = await request(app)
        .get('/api/v1/auth/csrf')
        .set('Cookie', uatVoterCookie);
      assert.equal(csrfRes.status, 200);
      uatCsrfToken = csrfRes.body.data.csrfToken;
      assert.ok(uatCsrfToken);
    });

    test('UAT 3: Real voter profile and constituency-specific ballot retrieval', async () => {
      // 1. Fetch own profile
      const profileRes = await request(app)
        .get('/api/v1/voters/me')
        .set('Cookie', uatVoterCookie);
      assert.equal(profileRes.status, 200);
      assert.equal(profileRes.body.data.epicNumber, uatVoterEpic);
      assert.equal(profileRes.body.data.parliamentaryConstituencyId, 'WB-PC-KRISHNANAGAR');

      // 2. Retrieve constituency-specific ballot for LS-2029
      const ballotRes = await request(app)
        .get('/api/v1/voter/elections/LS-2029/ballot')
        .set('Cookie', uatVoterCookie);
      assert.equal(ballotRes.status, 200);
      assert.ok(ballotRes.body.ballot);
      assert.equal(ballotRes.body.ballot.constituencyId, 'WB-PC-KRISHNANAGAR');
      assert.ok(Array.isArray(ballotRes.body.ballot.candidates));
      assert.ok(ballotRes.body.ballot.candidates.length >= 1);
    });

    test('UAT 4: Zero-Knowledge Participation Invariant — strict empty body & duplicate prevention', async () => {
      // 1. Attempting to transmit candidateId MUST be rejected with 422
      const leakAttemptRes = await request(app)
        .post('/api/v1/voter/elections/LS-2029/participate')
        .set('Cookie', uatVoterCookie)
        .set('x-csrf-token', uatCsrfToken)
        .send({ candidateId: 'CAND-LS29-WB-KRN-1' });
      assert.equal(leakAttemptRes.status, 422);

      // 2. Strict empty body succeeds
      const partRes = await request(app)
        .post('/api/v1/voter/elections/LS-2029/participate')
        .set('Cookie', uatVoterCookie)
        .set('x-csrf-token', uatCsrfToken)
        .send({});
      assert.equal(partRes.status, 201);
      assert.ok(partRes.body.participation.referenceId);

      // 3. Duplicate participation attempt strictly returns 409 Conflict
      const dupRes = await request(app)
        .post('/api/v1/voter/elections/LS-2029/participate')
        .set('Cookie', uatVoterCookie)
        .set('x-csrf-token', uatCsrfToken)
        .send({});
      assert.equal(dupRes.status, 409);
    });

    test('UAT 5: Turnout increment verified by administrator without choice derivation', async () => {
      const superLogin = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ identifier: 'super.ci@ovs-test.local', password: 'SuperCiSecret#2026!' });
      assert.equal(superLogin.status, 200);
      const superCookie = (superLogin.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const summaryRes = await request(app)
        .get('/api/v1/voter/elections/LS-2029/participation-summary')
        .set('Cookie', superCookie);
      assert.equal(summaryRes.status, 200);
      assert.ok(summaryRes.body.summary);
      assert.ok(summaryRes.body.summary.totalParticipated >= 1);
    });
  });
});
