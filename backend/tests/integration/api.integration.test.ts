import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, disconnectDatabase } from '../../src/config/database.js';
import { seedDatabase } from '../../prisma/seed.js';

describe('OVS Phase 8.2 — Live PostgreSQL & Supertest API Integration Suite', () => {
  const app = createApp({
    allowedOrigins: ['http://localhost:3000'],
  });

  before(async () => {
    // Clean any test artifacts while preserving schema and triggers, then seed DEMO_SAMPLE dataset
    await prisma.candidateTally.deleteMany();
    await prisma.countingRound.deleteMany();
    await prisma.resultCorrectionHistory.deleteMany();
    await prisma.tieResolution.deleteMany();
    await prisma.countingSession.deleteMany();
    await prisma.candidateNomination.deleteMany();
    await prisma.electionConstituency.deleteMany();
    await prisma.electionLifecycleHistory.deleteMany();
    await prisma.demoParticipation.deleteMany();
    await prisma.voterNotification.deleteMany();
    await prisma.announcement.deleteMany();
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
      assert.equal(firstRun.candidatesCount, 9);
      assert.equal(firstRun.electionsCount, 2);
      assert.equal(firstRun.electionConstituenciesCount, 10);
      assert.equal(firstRun.nominationsCount, 9);

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
    test('GET /api/v1/elections lists seeded elections and filters by type and stateId', async () => {
      const allRes = await request(app).get('/api/v1/elections');
      assert.equal(allRes.status, 200);
      assert.equal(allRes.body.data.length, 2);

      const stateAssemblyRes = await request(app).get(
        '/api/v1/elections?type=STATE_ASSEMBLY&stateId=WB'
      );
      assert.equal(stateAssemblyRes.status, 200);
      assert.equal(stateAssemblyRes.body.data.length, 1);
      assert.equal(stateAssemblyRes.body.data[0].id, 'WB-ASSEMBLY-2029');
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
      assert.equal(invalidGeoRes.status, 409);
      assert.match(invalidGeoRes.body.detail, /geographic hierarchy/i);
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
});
