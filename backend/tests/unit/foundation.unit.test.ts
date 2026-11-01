import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { parseEnvironment } from '../../src/config/env.js';
import {
  AppProblemError,
  ConflictProblemError,
  ForbiddenOriginProblemError,
  InternalServerProblemError,
  NotFoundProblemError,
  RateLimitProblemError,
  ServiceUnavailableProblemError,
  ValidationProblemError,
  translatePrismaError,
} from '../../src/common/errors/problemDetails.js';
import {
  buildPaginationMeta,
  serializeBigInt,
} from '../../src/common/utils/response.js';
import { paginationQuerySchema } from '../../src/common/middleware/validate.js';
import {
  constituencyIdParamSchema,
  listAssemblyQuerySchema,
  listStatesQuerySchema,
  stateIdParamSchema,
} from '../../src/modules/geography/geography.schemas.js';
import {
  electionIdParamSchema,
  listElectionCandidatesQuerySchema,
  listElectionsQuerySchema,
} from '../../src/modules/elections/elections.schemas.js';
import {
  listPartiesQuerySchema,
  partyIdParamSchema,
} from '../../src/modules/parties/parties.schemas.js';
import {
  DATA_SOURCE_MODES,
  resolveApiBaseUrl,
  resolveDataSourceMode,
} from '../../../src/config/env.js';
import {
  ApiProblemError,
  buildApiUrl,
  createOvsApiClient,
} from '../../../src/services/apiClient.js';

describe('OVS Phase 8.2 — Backend Unit Tests', () => {
  describe('1. Environment Configuration Validation (Zod)', () => {
    const validBaseEnv = {
      NODE_ENV: 'development',
      PORT: '5000',
      DATABASE_URL: 'postgresql://ovs_admin:ovs_secret_dev@localhost:5432/ovs_db?schema=public',
      CLIENT_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000',
      SESSION_SECRET: 'custom_cryptographic_secret_at_least_32_characters',
      LOG_LEVEL: 'info',
    };

    test('accepts valid environment configuration and parses allowedOrigins list', () => {
      const parsed = parseEnvironment(validBaseEnv);
      assert.equal(parsed.NODE_ENV, 'development');
      assert.equal(parsed.PORT, 5000);
      assert.deepEqual(parsed.allowedOrigins, [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]);
      assert.equal(parsed.LOG_LEVEL, 'info');
    });

    test('rejects missing DATABASE_URL with descriptive error', () => {
      assert.throws(
        () =>
          parseEnvironment({
            ...validBaseEnv,
            DATABASE_URL: undefined,
          }),
        /DATABASE_URL/
      );
    });

    test('rejects non-PostgreSQL DATABASE_URL', () => {
      assert.throws(
        () =>
          parseEnvironment({
            ...validBaseEnv,
            DATABASE_URL: 'mysql://localhost:3306/ovs_db',
          }),
        /valid PostgreSQL connection URI/
      );
    });

    test('rejects invalid PORT out of TCP range', () => {
      assert.throws(
        () =>
          parseEnvironment({
            ...validBaseEnv,
            PORT: '70000',
          }),
        /PORT/
      );
    });

    test('rejects malformed CLIENT_ORIGIN URLs', () => {
      assert.throws(
        () =>
          parseEnvironment({
            ...validBaseEnv,
            CLIENT_ORIGIN: 'not-a-valid-origin',
          }),
        /CLIENT_ORIGIN/
      );
    });

    test('rejects SESSION_SECRET shorter than 32 characters', () => {
      assert.throws(
        () =>
          parseEnvironment({
            ...validBaseEnv,
            SESSION_SECRET: 'too_short_secret',
          }),
        /SESSION_SECRET must be at least 32 characters/
      );
    });

    test('rejects insecure placeholder SESSION_SECRET when NODE_ENV=production', () => {
      assert.throws(
        () =>
          parseEnvironment({
            ...validBaseEnv,
            NODE_ENV: 'production',
            SESSION_SECRET: 'dev_session_secret_32_characters_long_min',
          }),
        /Insecure placeholder SESSION_SECRET is strictly forbidden when NODE_ENV=production/
      );
    });
  });

  describe('2. RFC 9457 Problem Details Error Formatting & Prisma Error Translation', () => {
    test('formats ValidationProblemError with invalidParams and requestId', () => {
      const err = new ValidationProblemError('Validation failed', [
        { name: 'stateId', reason: 'stateId must be at least 2 characters' },
      ]);
      const problem = err.toProblemDetails('/api/v1/geography/states/X', 'req-12345');

      assert.equal(problem.type, 'https://ovs.eci.gov.in/errors/validation-failed');
      assert.equal(problem.title, 'Validation Failed');
      assert.equal(problem.status, 400);
      assert.equal(problem.code, 'VALIDATION_FAILED');
      assert.equal(problem.instance, '/api/v1/geography/states/X');
      assert.equal(problem.requestId, 'req-12345');
      assert.deepEqual(problem.invalidParams, [
        { name: 'stateId', reason: 'stateId must be at least 2 characters' },
      ]);
    });

    test('formats NotFoundProblemError, ConflictProblemError, ForbiddenOriginProblemError, RateLimitProblemError, ServiceUnavailableProblemError, and InternalServerProblemError', () => {
      const notFound = new NotFoundProblemError('Election', 'LS-9999').toProblemDetails(
        '/api/v1/elections/LS-9999'
      );
      assert.equal(notFound.status, 404);
      assert.equal(notFound.code, 'RESOURCE_NOT_FOUND');
      assert.match(notFound.detail, /Election 'LS-9999' was not found/);

      const conflict = new ConflictProblemError('Duplicate record').toProblemDetails('/test');
      assert.equal(conflict.status, 409);

      const forbiddenOrigin = new ForbiddenOriginProblemError('https://evil.example').toProblemDetails('/test');
      assert.equal(forbiddenOrigin.status, 403);
      assert.equal(forbiddenOrigin.code, 'CORS_ORIGIN_FORBIDDEN');

      const rateLimited = new RateLimitProblemError().toProblemDetails('/test');
      assert.equal(rateLimited.status, 429);
      assert.equal(rateLimited.code, 'RATE_LIMIT_EXCEEDED');

      const unavailable = new ServiceUnavailableProblemError().toProblemDetails('/health/ready');
      assert.equal(unavailable.status, 503);
      assert.equal(unavailable.code, 'SERVICE_UNAVAILABLE');

      const internal = new InternalServerProblemError().toProblemDetails('/test');
      assert.equal(internal.status, 500);
      assert.equal(internal.code, 'INTERNAL_SERVER_ERROR');
    });

    test('translates Prisma known request errors (P2002, P2003, P2025) into safe AppProblemError instances', () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.4.1',
      });
      const translated2002 = translatePrismaError(p2002);
      assert.ok(translated2002 instanceof AppProblemError);
      assert.equal(translated2002.status, 409);
      assert.equal(translated2002.code, 'UNIQUE_CONSTRAINT_VIOLATION');

      const p2003 = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '6.4.1',
      });
      const translated2003 = translatePrismaError(p2003);
      assert.ok(translated2003 instanceof AppProblemError);
      assert.equal(translated2003.status, 400);

      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '6.4.1',
      });
      const translated2025 = translatePrismaError(p2025);
      assert.ok(translated2025 instanceof AppProblemError);
      assert.equal(translated2025.status, 404);
    });
  });

  describe('3. Zod Request Validation Schemas & Pagination Helpers', () => {
    test('normalizes route parameters to uppercase and enforces length bounds', () => {
      assert.deepEqual(stateIdParamSchema.parse({ stateId: 'wb' }), { stateId: 'WB' });
      assert.deepEqual(
        constituencyIdParamSchema.parse({ constituencyId: 'wb-pc-krishnanagar' }),
        { constituencyId: 'WB-PC-KRISHNANAGAR' }
      );
      assert.deepEqual(electionIdParamSchema.parse({ electionId: 'ls-2029' }), {
        electionId: 'LS-2029',
      });
      assert.deepEqual(partyIdParamSchema.parse({ partyId: 'party-aitc' }), {
        partyId: 'PARTY-AITC',
      });

      assert.throws(() => stateIdParamSchema.parse({ stateId: 'X' }));
    });

    test('validates pagination and filter query schemas', () => {
      const defaultPag = paginationQuerySchema.parse({});
      assert.deepEqual(defaultPag, { page: 1, limit: 50 });

      assert.throws(() => paginationQuerySchema.parse({ page: '0' }));
      assert.throws(() => paginationQuerySchema.parse({ limit: '500' }));

      const statesQuery = listStatesQuerySchema.parse({
        type: 'UNION_TERRITORY',
        search: 'Delhi',
      });
      assert.equal(statesQuery.type, 'UNION_TERRITORY');
      assert.equal(statesQuery.search, 'Delhi');

      const acQuery = listAssemblyQuerySchema.parse({
        districtId: 'nadia',
        parentParliamentaryConstituencyId: 'wb-pc-krishnanagar',
      });
      assert.equal(acQuery.districtId, 'NADIA');
      assert.equal(acQuery.parentParliamentaryConstituencyId, 'WB-PC-KRISHNANAGAR');

      const elecQuery = listElectionsQuerySchema.parse({
        type: 'LOK_SABHA',
        year: '2029',
      });
      assert.equal(elecQuery.type, 'LOK_SABHA');
      assert.equal(elecQuery.year, 2029);

      const candQuery = listElectionCandidatesQuerySchema.parse({});
      assert.equal(candQuery.status, 'APPROVED');

      const partyQuery = listPartiesQuerySchema.parse({ partyType: 'NATIONAL' });
      assert.equal(partyQuery.partyType, 'NATIONAL');
    });

    test('computes pagination metadata and serializes BigInt values safely', () => {
      const meta = buildPaginationMeta(2, 10, 25);
      assert.deepEqual(meta, {
        page: 2,
        limit: 10,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      });

      const payload = serializeBigInt({
        id: 'CAND-1',
        assetsDeclared: BigInt(18500000),
        nested: [{ liabilitiesDeclared: BigInt(1200000) }],
      });
      assert.equal(payload.assetsDeclared, 18500000);
      assert.equal(payload.nested[0]?.liabilitiesDeclared, 1200000);
    });
  });

  describe('4. Frontend Compatibility & Reusable API Client Foundation', () => {
    test('defaults frontend data-source mode to LOCAL_DEMO and supports BACKEND_API override', () => {
      assert.equal(resolveDataSourceMode({}), DATA_SOURCE_MODES.LOCAL_DEMO);
      assert.equal(
        resolveDataSourceMode({ VITE_DATA_SOURCE_MODE: 'BACKEND_API' }),
        DATA_SOURCE_MODES.BACKEND_API
      );
      assert.equal(
        resolveApiBaseUrl({ VITE_API_BASE_URL: 'http://localhost:5000/api/v1/' }),
        'http://localhost:5000/api/v1'
      );
    });

    test('builds clean API URLs with query parameters and maps RFC 9457 Problem Details errors', async () => {
      const url = buildApiUrl('http://localhost:5000/api/v1', '/elections', {
        type: 'LOK_SABHA',
        year: 2029,
        stateId: undefined,
      });
      assert.equal(url, 'http://localhost:5000/api/v1/elections?type=LOK_SABHA&year=2029');

      const mockClient = createOvsApiClient({
        baseUrl: 'http://localhost:5000/api/v1',
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              type: 'https://ovs.eci.gov.in/errors/resource-not-found',
              title: 'Resource Not Found',
              status: 404,
              detail: "Election 'LS-9999' was not found.",
              instance: '/api/v1/elections/LS-9999',
              code: 'RESOURCE_NOT_FOUND',
              requestId: 'req-abc',
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/problem+json' },
            }
          ),
      });

      await assert.rejects(
        () => mockClient.elections.getById('LS-9999'),
        (err: unknown) => {
          assert.ok(err instanceof ApiProblemError);
          assert.equal(err.status, 404);
          assert.equal(err.code, 'RESOURCE_NOT_FOUND');
          assert.equal(err.requestId, 'req-abc');
          return true;
        }
      );
    });
  });
});
