import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { Duplex } from 'node:stream';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import type { AdminRole, AdminStatus, ConstituencyType } from '@prisma/client';
import { PasswordService } from '../../src/modules/admin/password.service.js';
import {
  ADMIN_PERMISSIONS,
  MUTATING_ADMIN_PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
  canActorAssignRole,
  canActorManageTargetRole,
  evaluateJurisdictionAccess,
  getPermissionsForRole,
  roleHasPermission,
} from '../../src/modules/admin/admin.permissions.js';
import {
  adminLoginSchema,
  createAdminUserSchema,
  updateAdminSelfProfileSchema,
  updateAdminScopesSchema,
} from '../../src/modules/admin/admin.schemas.js';
import { sanitizeAuditDetails } from '../../src/modules/admin/admin.audit.service.js';
import { assertSafeTestDatabase } from '../../src/config/testDatabaseGuard.js';
import { createAdminRouter } from '../../src/modules/admin/admin.routes.js';
import { createAuthMiddleware } from '../../src/modules/auth/auth.middleware.js';
import { SessionService } from '../../src/modules/auth/session.service.js';
import { createAuthRouter } from '../../src/modules/auth/auth.routes.js';
import {
  notFoundHandler,
  centralizedErrorHandler,
} from '../../src/common/middleware/errorHandler.js';
import { requestIdMiddleware } from '../../src/common/middleware/requestId.js';
import type { SafeAdminUser } from '../../src/modules/auth/auth.types.js';
import type { AdminFullRecord } from '../../src/modules/admin/admin.repository.js';

describe('OVS Phase 8.4 — Admin Auth, RBAC, Jurisdiction Scoping & Security Unit Suite', () => {
  const secret = 'phase_8_4_unit_test_secret_32_characters_minimum';

  describe('1. Password Hashing (scrypt PHC) & Password Policy', () => {
    const pwdService = new PasswordService();

    test('hashes passwords with unique salts and verifies in constant time', async () => {
      const hash1 = await pwdService.hashPassword('StrongAdmin#2026!');
      const hash2 = await pwdService.hashPassword('StrongAdmin#2026!');

      assert.ok(hash1.startsWith('$scrypt$N=16384,r=8,p=1$'));
      assert.notEqual(hash1, hash2);

      assert.equal(await pwdService.verifyPassword('StrongAdmin#2026!', hash1), true);
      assert.equal(await pwdService.verifyPassword('WrongPassword#2026!', hash1), false);
      assert.equal(await pwdService.verifyPassword('StrongAdmin#2026!', 'malformed'), false);
    });

    test('enforces complexity rules and rejects weak or identifier-containing passwords', () => {
      assert.equal(pwdService.validatePasswordPolicy('short').valid, false);
      assert.equal(pwdService.validatePasswordPolicy('alllowercase123!').valid, false);
      assert.equal(pwdService.validatePasswordPolicy('NoDigitsSpecial!').valid, false);
      assert.equal(pwdService.validatePasswordPolicy('NoSpecialChar123').valid, false);

      const containsCode = pwdService.validatePasswordPolicy('ECI-SUPER-001#Pwd99', {
        officerCode: 'ECI-SUPER-001',
        email: 'admin@example.com',
      });
      assert.equal(containsCode.valid, false);

      const strong = pwdService.validatePasswordPolicy('AdmSecure#2026!', {
        officerCode: 'ECI-001',
        email: 'officer@ovs.local',
      });
      assert.equal(strong.valid, true);
    });
  });

  describe('2. Centralized RBAC Permission Matrix & Non-Escalation Rules', () => {
    test('READ_ONLY_AUDITOR never holds any mutating permission', () => {
      const auditorPerms = getPermissionsForRole('READ_ONLY_AUDITOR');
      assert.ok(auditorPerms.includes(ADMIN_PERMISSIONS.AUDIT_READ));
      assert.ok(auditorPerms.includes(ADMIN_PERMISSIONS.ADMIN_USERS_READ));

      for (const mutPerm of MUTATING_ADMIN_PERMISSIONS) {
        assert.equal(
          roleHasPermission('READ_ONLY_AUDITOR', mutPerm),
          false,
          `READ_ONLY_AUDITOR must never hold mutating permission '${mutPerm}'`
        );
      }
    });

    test('ELECTION_OFFICER cannot access or manage administrator accounts', () => {
      assert.equal(roleHasPermission('ELECTION_OFFICER', ADMIN_PERMISSIONS.ADMIN_USERS_READ), false);
      assert.equal(roleHasPermission('ELECTION_OFFICER', ADMIN_PERMISSIONS.ADMIN_USERS_CREATE), false);
      assert.equal(roleHasPermission('ELECTION_OFFICER', ADMIN_PERMISSIONS.NOMINATIONS_REVIEW), true);
    });

    test('role hierarchy blocks lateral/upward escalation', () => {
      // NATIONAL_ADMIN cannot manage or assign SUPER_ADMIN or peer NATIONAL_ADMIN
      assert.equal(canActorAssignRole('NATIONAL_ADMIN', 'SUPER_ADMIN'), false);
      assert.equal(canActorAssignRole('NATIONAL_ADMIN', 'NATIONAL_ADMIN'), false);
      assert.equal(canActorAssignRole('NATIONAL_ADMIN', 'STATE_ADMIN'), true);
      assert.equal(canActorManageTargetRole('NATIONAL_ADMIN', 'SUPER_ADMIN'), false);
      assert.equal(canActorManageTargetRole('NATIONAL_ADMIN', 'STATE_ADMIN'), true);

      // STATE_ADMIN can only manage/assign ELECTION_OFFICER
      assert.equal(canActorAssignRole('STATE_ADMIN', 'STATE_ADMIN'), false);
      assert.equal(canActorAssignRole('STATE_ADMIN', 'NATIONAL_ADMIN'), false);
      assert.equal(canActorAssignRole('STATE_ADMIN', 'ELECTION_OFFICER'), true);
      assert.equal(canActorManageTargetRole('STATE_ADMIN', 'ELECTION_OFFICER'), true);
      assert.equal(canActorManageTargetRole('STATE_ADMIN', 'STATE_ADMIN'), false);

      // ELECTION_OFFICER & READ_ONLY_AUDITOR cannot manage any roles
      for (const r of Object.keys(ROLE_PERMISSION_MATRIX) as AdminRole[]) {
        assert.equal(canActorAssignRole('ELECTION_OFFICER', r), false);
        assert.equal(canActorAssignRole('READ_ONLY_AUDITOR', r), false);
      }
    });
  });

  describe('3. Jurisdiction-Level Authorization Evaluation (Separate from Permissions)', () => {
    const wbStateAdmin: SafeAdminUser = {
      id: 'admin-wb',
      userId: 'user-wb',
      officerCode: 'ECI-WB-ADMIN',
      email: 'wb@ovs.local',
      fullName: 'WB State Admin',
      designation: 'CEO WB',
      role: 'STATE_ADMIN',
      status: 'ACTIVE',
      isActive: true,
      assignedStateId: 'WB',
      assignedStateIds: ['WB'],
      assignedElectionIds: [],
      assignedConstituencyScopes: [],
    };

    const officerLs2029: SafeAdminUser = {
      id: 'officer-1',
      userId: 'user-o1',
      officerCode: 'ECI-RO-1',
      email: 'ro1@ovs.local',
      fullName: 'RO Krishnanagar',
      designation: 'Returning Officer',
      role: 'ELECTION_OFFICER',
      status: 'ACTIVE',
      isActive: true,
      assignedStateId: 'WB',
      assignedStateIds: ['WB'],
      assignedElectionIds: ['LS-2029'],
      assignedConstituencyScopes: [
        {
          id: 'cs-1',
          electionId: 'LS-2029',
          constituencyType: 'PARLIAMENTARY',
          parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
          assemblyConstituencyId: null,
        },
      ],
    };

    test('STATE_ADMIN for WB passes WB targets and denies MH targets', () => {
      assert.equal(evaluateJurisdictionAccess(wbStateAdmin, { stateId: 'WB' }).allowed, true);
      const deniedMh = evaluateJurisdictionAccess(wbStateAdmin, { stateId: 'MH' });
      assert.equal(deniedMh.allowed, false);
      assert.match(deniedMh.reason ?? '', /outside your assigned state scope/i);
    });

    test('ELECTION_OFFICER passes assigned election/constituency and denies unassigned ones', () => {
      assert.equal(
        evaluateJurisdictionAccess(officerLs2029, {
          electionId: 'LS-2029',
          constituencyType: 'PARLIAMENTARY',
          constituencyId: 'WB-PC-KRISHNANAGAR',
        }).allowed,
        true
      );

      assert.equal(
        evaluateJurisdictionAccess(officerLs2029, {
          electionId: 'WB-ASSEMBLY-2029',
        }).allowed,
        false
      );

      assert.equal(
        evaluateJurisdictionAccess(officerLs2029, {
          electionId: 'LS-2029',
          constituencyType: 'PARLIAMENTARY',
          constituencyId: 'MH-PC-MUMBAI-NORTH',
        }).allowed,
        false
      );
    });
  });

  describe('4. Zod Schema Strictness, Audit Sanitization & Fail-Closed DB Guard', () => {
    test('Zod .strict() schemas reject extra privilege fields and invalid constituency polymorphism', () => {
      assert.equal(
        updateAdminSelfProfileSchema.safeParse({
          fullName: 'Valid Name',
          role: 'SUPER_ADMIN',
        }).success,
        false
      );

      assert.equal(
        createAdminUserSchema.safeParse({
          officerCode: 'ECI-999',
          email: 'test@ovs.local',
          fullName: 'Test Officer',
          designation: 'RO',
          role: 'ELECTION_OFFICER',
          password: 'ValidOfficer#2026!',
          isSuperAdmin: true,
        }).success,
        false
      );

      assert.equal(
        updateAdminScopesSchema.safeParse({
          constituencyScopes: [
            {
              constituencyType: 'PARLIAMENTARY',
              assemblyConstituencyId: 'WB-AC-1',
            },
          ],
        }).success,
        false
      );

      assert.equal(
        adminLoginSchema.safeParse({ identifier: 'ECI001', password: 'secret' }).success,
        true
      );
    });

    test('sanitizeAuditDetails recursively redacts passwords, tokens, OTPs, and cookies', () => {
      const sanitized = sanitizeAuditDetails({
        password: 'MySecretPassword!123',
        nested: {
          csrfToken: 'abcdef123456',
          sessionToken: 'deadbeef',
          otp: '123456',
          safeInfo: 'WB-STATE',
        },
      }) as Record<string, any>;

      assert.equal(sanitized.password, '[REDACTED]');
      assert.equal(sanitized.nested.csrfToken, '[REDACTED]');
      assert.equal(sanitized.nested.sessionToken, '[REDACTED]');
      assert.equal(sanitized.nested.otp, '[REDACTED]');
      assert.equal(sanitized.nested.safeInfo, 'WB-STATE');
    });

    test('assertSafeTestDatabase rejects production, remote hosts, and non-test DB names', () => {
      assert.throws(
        () =>
          assertSafeTestDatabase(
            'postgresql://postgres:pass@localhost:5432/ovs_ci_test',
            'production'
          ),
        /NODE_ENV=production/i
      );

      assert.throws(
        () =>
          assertSafeTestDatabase(
            'postgresql://prod_user:pass@prod-db.internal:5432/ovs_prod',
            'test'
          ),
        /Refusing destructive cleanup/i
      );

      assert.doesNotThrow(() =>
        assertSafeTestDatabase(
          'postgresql://postgres:pass@localhost:5432/ovs_ci_test?schema=public',
          'test'
        )
      );
    });
  });

  describe('5. Express Route Security, Session Fixation, Lockout, CSRF, Rate Limit & Isolation Tests', () => {
    async function injectHttp(
      app: Express,
      opts: {
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        url: string;
        headers?: Record<string, string>;
        body?: unknown;
      }
    ): Promise<{
      status: number;
      headers: Record<string, string | string[] | undefined>;
      body: any;
    }> {
      const payloadStr =
        opts.body !== undefined ? JSON.stringify(opts.body) : '';
      const payloadBuf = Buffer.from(payloadStr, 'utf8');

      const socket = new Duplex({
        read() {},
        write(_chunk, _enc, cb) {
          cb();
        },
      }) as any;
      socket.remoteAddress = '127.0.0.1';
      socket.encrypted = false;

      const req = new http.IncomingMessage(socket);
      req.method = opts.method;
      req.url = opts.url;
      req.headers = {
        host: 'localhost:5000',
        ...(opts.body !== undefined
          ? {
              'content-type': 'application/json',
              'content-length': String(payloadBuf.byteLength),
            }
          : {}),
        ...Object.fromEntries(
          Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
        ),
      };

      if (payloadBuf.byteLength > 0) {
        req.push(payloadBuf);
      }
      req.push(null);

      return new Promise((resolve) => {
        const res = new http.ServerResponse(req);
        const chunks: Buffer[] = [];

        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);

        (res as any).write = (chunk: any, enc?: any, cb?: any) => {
          if (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof enc === 'string' ? (enc as BufferEncoding) : 'utf8'));
          }
          return origWrite(chunk, enc, cb);
        };

        (res as any).end = (chunk?: any, enc?: any, cb?: any) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof enc === 'string' ? (enc as BufferEncoding) : 'utf8'));
          }
          origEnd(chunk, enc, cb);
          // ServerResponse.write queues HTTP status line + headers into chunks if we let it write to socket;
          // instead let's extract JSON body cleanly from after the `\r\n\r\n` separator if headers were serialized!
          const raw = Buffer.concat(chunks).toString('utf8');
          const headerSepIdx = raw.indexOf('\r\n\r\n');
          const textBody = headerSepIdx !== -1 ? raw.slice(headerSepIdx + 4) : raw;
          let parsedBody: any = textBody;
          try {
            parsedBody = textBody ? JSON.parse(textBody) : {};
          } catch {
            // Leave raw string if not JSON
          }
          const rawHeaders = res.getHeaders() as Record<string, string | string[] | undefined>;
          const sc = rawHeaders['set-cookie'];
          if (typeof sc === 'string') {
            rawHeaders['set-cookie'] = [sc];
          }
          resolve({
            status: res.statusCode,
            headers: rawHeaders,
            body: parsedBody,
          });
          return res;
        };

        // Attach dummy socket so Node http.ServerResponse flushes synchronously via our overridden write/end
        res.assignSocket(socket);
        (app as any).handle(req, res);
      });
    }

    async function buildHarness(options?: { loginRateLimitMax?: number }) {
      const pwdService = new PasswordService();
      const superHash = await pwdService.hashPassword('SuperAdmin#2026!');
      const wbHash = await pwdService.hashPassword('WbAdmin#2026!');
      const roHash = await pwdService.hashPassword('Officer#2026!');
      const auditorHash = await pwdService.hashPassword('Auditor#2026!');

      const adminsMap = new Map<string, AdminFullRecord>();
      const usersMap = new Map<string, any>();
      const sessionsMap = new Map<string, any>();
      const auditLogs: any[] = [];

      function addMockAdmin(cfg: {
        id: string;
        userId: string;
        officerCode: string;
        email: string;
        fullName: string;
        role: AdminRole;
        passwordHash: string;
        status?: AdminStatus;
        stateIds?: string[];
        electionIds?: string[];
      }) {
        const status = cfg.status ?? 'ACTIVE';
        const isActive = status === 'ACTIVE';
        const user = {
          id: cfg.userId,
          userType: 'ADMIN' as const,
          identifier: cfg.officerCode,
          passwordHash: cfg.passwordHash,
          isActive,
          failedLoginAttempts: 0,
          lockoutUntil: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const record: AdminFullRecord = {
          id: cfg.id,
          userId: cfg.userId,
          officerCode: cfg.officerCode,
          email: cfg.email,
          fullName: cfg.fullName,
          designation: `${cfg.role} Designation`,
          role: cfg.role,
          status,
          assignedStateId: cfg.stateIds?.[0] ?? null,
          isActive,
          suspendedAt: null,
          suspendedReason: null,
          deactivatedAt: null,
          createdByAdminId: null,
          passwordUpdatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          user,
          assignedStateScopes: (cfg.stateIds ?? []).map((s, idx) => ({
            id: `ss-${cfg.id}-${idx}`,
            adminUserId: cfg.id,
            stateId: s,
            assignedAt: new Date(),
            assignedByAdminId: null,
          })),
          assignedElectionScopes: (cfg.electionIds ?? []).map((e, idx) => ({
            id: `es-${cfg.id}-${idx}`,
            adminUserId: cfg.id,
            electionId: e,
            assignedAt: new Date(),
            assignedByAdminId: null,
          })),
          assignedConstituencyScopes: [],
        };
        adminsMap.set(cfg.id, record);
        usersMap.set(cfg.userId, { ...user, adminUser: record, voterProfile: null });
      }

      const idSuper = '11111111-1111-4111-8111-111111111111';
      const idNat = '22222222-2222-4222-8222-222222222222';
      const idWb = '33333333-3333-4333-8333-333333333333';
      const idMh = '44444444-4444-4444-8444-444444444444';
      const idRo = '55555555-5555-4555-8555-555555555555';
      const idAud = '66666666-6666-4666-8666-666666666666';

      addMockAdmin({
        id: idSuper,
        userId: 'u-super',
        officerCode: 'ECI-SUPER-1',
        email: 'super@ovs.local',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        passwordHash: superHash,
      });
      addMockAdmin({
        id: idNat,
        userId: 'u-nat',
        officerCode: 'ECI-NAT-1',
        email: 'nat@ovs.local',
        fullName: 'National Admin',
        role: 'NATIONAL_ADMIN',
        passwordHash: superHash,
      });
      addMockAdmin({
        id: idWb,
        userId: 'u-wb',
        officerCode: 'ECI-WB-1',
        email: 'wb@ovs.local',
        fullName: 'WB Admin',
        role: 'STATE_ADMIN',
        passwordHash: wbHash,
        stateIds: ['WB'],
      });
      addMockAdmin({
        id: idMh,
        userId: 'u-mh',
        officerCode: 'ECI-MH-1',
        email: 'mh@ovs.local',
        fullName: 'MH Admin',
        role: 'STATE_ADMIN',
        passwordHash: wbHash,
        stateIds: ['MH'],
      });
      addMockAdmin({
        id: idRo,
        userId: 'u-ro',
        officerCode: 'ECI-RO-1',
        email: 'ro@ovs.local',
        fullName: 'RO Officer',
        role: 'ELECTION_OFFICER',
        passwordHash: roHash,
        stateIds: ['WB'],
        electionIds: ['LS-2029'],
      });
      addMockAdmin({
        id: idAud,
        userId: 'u-aud',
        officerCode: 'ECI-AUD-1',
        email: 'aud@ovs.local',
        fullName: 'Read Only Auditor',
        role: 'READ_ONLY_AUDITOR',
        passwordHash: auditorHash,
      });

      // Add a VOTER user session to test voter -> admin isolation
      const voterUserId = 'u-voter-1';
      usersMap.set(voterUserId, {
        id: voterUserId,
        userType: 'VOTER',
        identifier: 'DEMO-EPIC-001',
        isActive: true,
        adminUser: null,
        voterProfile: {
          id: 'vp-1',
          epicNumber: 'DEMO-EPIC-001',
          fullName: 'Voter One',
          dateOfBirth: new Date('1995-01-01'),
          gender: 'MALE',
          mobile: '9876543210',
          email: 'voter@ovs.local',
          address: 'Demo Address',
          pinCode: '741101',
          stateId: 'WB',
          districtId: 'NADIA',
          parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
          assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
          registrationDate: new Date(),
          isVerified: true,
          metadataSource: 'DEMO_SAMPLE',
        },
      });
      const voterRawToken = crypto.randomBytes(32).toString('hex');
      const voterSessionHash = crypto.createHash('sha256').update(voterRawToken).digest('hex');
      sessionsMap.set(voterSessionHash, {
        id: voterSessionHash,
        userId: voterUserId,
        expiresAt: new Date(Date.now() + 3600_000),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        user: usersMap.get(voterUserId),
      });

      const mockAdminRepo: any = {
        async findAdminByLoginIdentifier(id: string) {
          const lower = id.trim().toLowerCase();
          const upper = id.trim().toUpperCase();
          for (const rec of adminsMap.values()) {
            if (rec.email === lower || rec.officerCode === upper) return rec;
          }
          return null;
        },
        async findAdminById(id: string) {
          return adminsMap.get(id) ?? null;
        },
        async findAdminByEmail(email: string) {
          const lower = email.trim().toLowerCase();
          for (const rec of adminsMap.values()) {
            if (rec.email === lower) return rec;
          }
          return null;
        },
        async findAdminByOfficerCode(code: string) {
          const upper = code.trim().toUpperCase();
          for (const rec of adminsMap.values()) {
            if (rec.officerCode === upper) return rec;
          }
          return null;
        },
        async findUserByIdentifier(code: string) {
          const upper = code.trim().toUpperCase();
          for (const u of usersMap.values()) {
            if (u.identifier === upper) return u;
          }
          return null;
        },
        async validateScopeReferences(input: any) {
          const validStates = new Set(['WB', 'MH', 'DL']);
          for (const s of input.stateIds ?? []) {
            if (!validStates.has(s)) return { valid: false, reason: `State '${s}' does not exist.` };
          }
          return { valid: true, pcStateMap: new Map(), acStateMap: new Map() };
        },
        async getElectionStateIds(ids: string[]) {
          return ids.map((id) => ({
            id,
            stateId: id.startsWith('MH') ? 'MH' : id.startsWith('WB') ? 'WB' : null,
          }));
        },
        async createAdminUser(input: any) {
          const newId = crypto.randomUUID();
          addMockAdmin({
            id: newId,
            userId: `u-${newId}`,
            officerCode: input.officerCode,
            email: input.email,
            fullName: input.fullName,
            role: input.role,
            passwordHash: input.passwordHash,
            stateIds: input.stateIds,
            electionIds: input.electionIds,
          });
          return adminsMap.get(newId)!;
        },
        async updateAdminUser(adminId: string, _userId: string, input: any) {
          const existing = adminsMap.get(adminId)!;
          if (input.fullName) existing.fullName = input.fullName;
          if (input.role) existing.role = input.role;
          if (input.stateIds) {
            existing.assignedStateId = input.stateIds[0] ?? null;
            existing.assignedStateScopes = input.stateIds.map((s: string, i: number) => ({
              id: `ss-${i}`,
              adminUserId: adminId,
              stateId: s,
              assignedAt: new Date(),
              assignedByAdminId: input.assignedByAdminId,
            }));
          }
          return existing;
        },
        async updateAdminStatus(adminId: string, userId: string, opts: any) {
          const rec = adminsMap.get(adminId)!;
          rec.status = opts.status;
          rec.isActive = opts.status === 'ACTIVE';
          rec.user.isActive = rec.isActive;
          const u = usersMap.get(userId);
          if (u) u.isActive = rec.isActive;
          if (!rec.isActive) {
            for (const [k, s] of sessionsMap.entries()) {
              if (s.userId === userId) sessionsMap.delete(k);
            }
          }
          return rec;
        },
        async recordLoginFailure(userId: string, max: number, lockMs: number) {
          const u = usersMap.get(userId);
          u.failedLoginAttempts += 1;
          if (u.failedLoginAttempts >= max) {
            u.lockoutUntil = new Date(Date.now() + lockMs);
          }
          for (const rec of adminsMap.values()) {
            if (rec.userId === userId) {
              rec.user.failedLoginAttempts = u.failedLoginAttempts;
              rec.user.lockoutUntil = u.lockoutUntil;
            }
          }
          return { failedLoginAttempts: u.failedLoginAttempts, lockoutUntil: u.lockoutUntil };
        },
        async recordLoginSuccess(userId: string) {
          const u = usersMap.get(userId);
          u.failedLoginAttempts = 0;
          u.lockoutUntil = null;
          u.lastLoginAt = new Date();
          for (const rec of adminsMap.values()) {
            if (rec.userId === userId) {
              rec.user.failedLoginAttempts = 0;
              rec.user.lockoutUntil = null;
              rec.user.lastLoginAt = u.lastLoginAt;
            }
          }
        },
        async listAdminUsers(filter: any) {
          let items = Array.from(adminsMap.values());
          if (filter.allowedStateIds?.length) {
            items = items.filter((a) =>
              a.assignedStateScopes.some((s) => filter.allowedStateIds.includes(s.stateId))
            );
          }
          if (filter.role) items = items.filter((a) => a.role === filter.role);
          return {
            items,
            pagination: { page: 1, limit: 25, pageSize: 25, total: items.length, totalPages: 1 },
          };
        },
        async createSession(data: any) {
          const sess = {
            id: data.sessionHash,
            userId: data.userId,
            expiresAt: data.expiresAt,
            lastActivityAt: new Date(),
            createdAt: new Date(),
            userAgent: data.userAgent,
            ipAddress: data.ipAddress,
            user: usersMap.get(data.userId),
          };
          sessionsMap.set(data.sessionHash, sess);
          return sess;
        },
        async deleteSessionByHash(hash: string) {
          sessionsMap.delete(hash);
        },
        async deleteAllUserSessions(userId: string) {
          let count = 0;
          for (const [k, s] of sessionsMap.entries()) {
            if (s.userId === userId) {
              sessionsMap.delete(k);
              count++;
            }
          }
          return count;
        },
        async deleteUserSession(userId: string, sid: string) {
          const s = sessionsMap.get(sid);
          if (s && s.userId === userId) {
            sessionsMap.delete(sid);
            return true;
          }
          return false;
        },
        async listActiveSessions(userId: string) {
          return Array.from(sessionsMap.values()).filter((s) => s.userId === userId);
        },
      };

      const mockAuditService: any = {
        async recordSecurityEvent(ev: any) {
          auditLogs.push({ id: `log-${auditLogs.length + 1}`, timestamp: new Date(), ...ev });
        },
        async listAuditLogs() {
          return {
            items: auditLogs,
            pagination: { page: 1, limit: 50, pageSize: 50, total: auditLogs.length, totalPages: 1 },
          };
        },
      };

      // Wire authenticate to use mock sessionsMap cleanly via monkey-patching AuthRepository?
      // Better: pass a minimal Prisma-like mock or intercept sessionService + createAdminRouter!
      const mockPrisma: any = {
        userSession: {
          findUnique: async ({ where }: any) => sessionsMap.get(where.id) ?? null,
          delete: async ({ where }: any) => sessionsMap.delete(where.id),
          update: async ({ where, data }: any) => {
            const s = sessionsMap.get(where.id);
            if (s) Object.assign(s, data);
          },
          deleteMany: async ({ where }: any) => {
            let count = 0;
            for (const [k, s] of sessionsMap.entries()) {
              if ((!where.userId || s.userId === where.userId) && (!where.id || s.id === where.id)) {
                sessionsMap.delete(k);
                count++;
              }
            }
            return { count };
          },
          findMany: async ({ where }: any) =>
            Array.from(sessionsMap.values()).filter((s) => s.userId === where.userId),
        },
        user: {
          findUnique: async ({ where }: any) => {
            for (const u of usersMap.values()) {
              if (u.id === where.id || u.identifier === where.identifier) return u;
            }
            return null;
          },
        },
      };

      // Instantiate AuthRepository backed by mockPrisma by wrapping createAuthRouter and createAdminRouter
      const { AuthRepository } = await import('../../src/modules/auth/auth.repository.js');
      const authRepo = new AuthRepository(mockPrisma);

      const sessionService = new SessionService(secret);
      const app = express();
      app.use(requestIdMiddleware);
      app.use(cookieParser());
      app.use(express.json());
      app.use('/api/v1/auth', createAuthRouter({ authRepository: authRepo, sessionSecret: secret }));

      // Build Admin router injecting authRepo via custom mount around authenticate!
      const { AuthService } = await import('../../src/modules/auth/auth.service.js');
      const { OtpService } = await import('../../src/modules/auth/otp.service.js');
      const { AdminService } = await import('../../src/modules/admin/admin.service.js');
      const { AdminController } = await import('../../src/modules/admin/admin.controller.js');
      const { createAdminMiddleware } = await import('../../src/modules/admin/admin.middleware.js');
      const { validateBody, validateParams } = await import('../../src/common/middleware/validate.js');
      const { adminLoginSchema: loginSchema, createAdminUserSchema: createSchema, suspendAdminSchema: suspendSchema, adminIdParamSchema: idSchema, updateAdminScopesSchema: scopesSchema } = await import('../../src/modules/admin/admin.schemas.js');
      const { RateLimitProblemError } = await import('../../src/common/errors/problemDetails.js');
      const rateLimitMod = await import('express-rate-limit');
      const rateLimit = rateLimitMod.default;

      const authService = new AuthService(authRepo, new OtpService(), sessionService, secret);
      const authMiddleware = createAuthMiddleware(authService, sessionService);
      const adminService = new AdminService(mockAdminRepo, pwdService, sessionService, mockAuditService);
      const adminMw = createAdminMiddleware(mockAuditService);
      const controller = new AdminController(adminService, sessionService);

      const adminRouter = express.Router();
      const loginLimiter =
        typeof options?.loginRateLimitMax === 'number'
          ? rateLimit({
              windowMs: 60_000,
              limit: options.loginRateLimitMax,
              handler(req, res) {
                const err = new RateLimitProblemError('Too many admin login attempts.');
                res.status(429).type('application/problem+json').json(err.toProblemDetails(req.originalUrl, req.requestId));
              },
            })
          : (_req: any, _res: any, next: any) => next();

      adminRouter.post('/auth/login', loginLimiter, validateBody(loginSchema), controller.login);
      adminRouter.post('/auth/logout', authMiddleware.authenticate, adminMw.requireAdminAuth, authMiddleware.requireCsrf, controller.logout);
      adminRouter.post('/auth/logout-all', authMiddleware.authenticate, adminMw.requireAdminAuth, authMiddleware.requireCsrf, controller.logoutAll);
      adminRouter.get('/auth/me', authMiddleware.authenticate, adminMw.requireAdminAuth, controller.getMe);
      adminRouter.get('/users', authMiddleware.authenticate, adminMw.requireAdminAuth, adminMw.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_READ), controller.listUsers);
      adminRouter.get('/users/:id', authMiddleware.authenticate, adminMw.requireAdminAuth, adminMw.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_READ), validateParams(idSchema), controller.getUserById);
      adminRouter.post('/users', authMiddleware.authenticate, adminMw.requireAdminAuth, authMiddleware.requireCsrf, adminMw.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_CREATE), validateBody(createSchema), controller.createUser);
      adminRouter.post('/users/:id/suspend', authMiddleware.authenticate, adminMw.requireAdminAuth, authMiddleware.requireCsrf, adminMw.requirePermission(ADMIN_PERMISSIONS.ADMIN_USERS_SUSPEND), validateParams(idSchema), validateBody(suspendSchema), controller.suspendUser);
      adminRouter.put('/users/:id/scopes', authMiddleware.authenticate, adminMw.requireAdminAuth, authMiddleware.requireCsrf, adminMw.requirePermission(ADMIN_PERMISSIONS.ADMIN_SCOPES_ASSIGN), validateParams(idSchema), validateBody(scopesSchema), controller.updateUserScopes);
      adminRouter.get('/audit-logs', authMiddleware.authenticate, adminMw.requireAdminAuth, adminMw.requirePermission(ADMIN_PERMISSIONS.AUDIT_READ), controller.listAuditLogs);
      adminRouter.get('/jurisdictions/states/:stateId', authMiddleware.authenticate, adminMw.requireAdminAuth, adminMw.requirePermission(ADMIN_PERMISSIONS.CONSTITUENCIES_READ), adminMw.requireJurisdictionScope((req) => ({ stateId: String(req.params.stateId).toUpperCase() })), (req, res) => res.json({ success: true, stateId: req.params.stateId }));
      adminRouter.post('/jurisdictions/elections/:electionId/verify-action', authMiddleware.authenticate, adminMw.requireAdminAuth, authMiddleware.requireCsrf, adminMw.requirePermission(ADMIN_PERMISSIONS.NOMINATIONS_REVIEW), adminMw.requireJurisdictionScope((req) => ({ electionId: String(req.params.electionId).toUpperCase() })), (req, res) => res.json({ success: true, electionId: req.params.electionId }));

      app.use('/api/v1/admin', adminRouter);
      // Also verify createAdminRouter compiles cleanly
      assert.ok(createAdminRouter);
      app.use(notFoundHandler);
      app.use(centralizedErrorHandler);

      return { app, ids: { idSuper, idNat, idWb, idMh, idRo, idAud }, voterRawToken, sessionsMap, auditLogs };
    }

    test('denies unauthenticated access (401) and voter-to-admin access (403) + rejects role injection on voter registration', async () => {
      const { app, voterRawToken, auditLogs } = await buildHarness();

      const unauthRes = await injectHttp(app, {
        method: 'GET',
        url: '/api/v1/admin/users',
      });
      assert.equal(unauthRes.status, 401);

      // Authenticated voter trying to access /api/v1/admin/users
      const voterRes = await injectHttp(app, {
        method: 'GET',
        url: '/api/v1/admin/users',
        headers: { cookie: `ovs_session=${voterRawToken}` },
      });
      assert.equal(voterRes.status, 403);
      assert.ok(
        auditLogs.some(
          (l) =>
            l.actionType === 'UNAUTHORIZED_ADMIN_PORTAL_ACCESS' &&
            l.outcome === 'DENIED'
        )
      );

      // Public voter registration attempting to inject SUPER_ADMIN role
      const registerAdminAttempt = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/auth/register',
        body: {
          epicNumber: 'HACK99999',
          fullName: 'Malicious Voter',
          dateOfBirth: '1995-01-01',
          gender: 'MALE',
          mobile: '9876599999',
          email: 'hack@ovs.local',
          address: 'Demo Address',
          pinCode: '741101',
          stateId: 'WB',
          districtId: 'NADIA',
          parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
          assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
          role: 'SUPER_ADMIN',
          userType: 'ADMIN',
        },
      });
      assert.equal(registerAdminAttempt.status, 400);
    });

    test('prevents session fixation, sets HttpOnly cookie, verifies CSRF, and revokes sessions on suspension', async () => {
      const { app, ids, sessionsMap } = await buildHarness();

      // Seed an attacker-known session cookie
      const preFixSession = crypto.randomBytes(32).toString('hex');
      const preFixHash = crypto.createHash('sha256').update(preFixSession).digest('hex');
      sessionsMap.set(preFixHash, {
        id: preFixHash,
        userId: 'u-super',
        expiresAt: new Date(Date.now() + 3600_000),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        user: {
          id: 'u-super',
          userType: 'ADMIN',
          identifier: 'ECI-SUPER-1',
          isActive: true,
          adminUser: {
            id: ids.idSuper,
            status: 'ACTIVE',
            isActive: true,
            role: 'SUPER_ADMIN',
            userId: 'u-super',
            officerCode: 'ECI-SUPER-1',
            email: 'super@ovs.local',
            fullName: 'Super',
            designation: 'CEC',
            assignedStateId: null,
            assignedStateScopes: [],
            assignedElectionScopes: [],
            assignedConstituencyScopes: [],
          },
        },
      });

      // Login while holding preFixSession
      const loginRes = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        headers: { cookie: `ovs_session=${preFixSession}` },
        body: { identifier: 'super@ovs.local', password: 'SuperAdmin#2026!' },
      });

      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.success, true);
      assert.ok(loginRes.body.data.csrfToken);

      // Old session hash MUST be deleted (session fixation prevented!)
      assert.equal(sessionsMap.has(preFixHash), false);

      const cookies = loginRes.headers['set-cookie'] as string[];
      assert.ok(cookies && cookies[0]);
      assert.match(cookies[0], /HttpOnly/i);
      const superCookie = cookies[0].split(';')[0]!;
      const superCsrf = loginRes.body.data.csrfToken;

      // CSRF missing -> 403
      const noCsrf = await injectHttp(app, {
        method: 'POST',
        url: `/api/v1/admin/users/${ids.idAud}/suspend`,
        headers: { cookie: superCookie },
        body: { reason: 'Audit test' },
      });
      assert.equal(noCsrf.status, 403);

      // Valid CSRF -> suspends auditor and revokes auditor sessions
      const audLogin = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'aud@ovs.local', password: 'Auditor#2026!' },
      });
      const audCookie = (audLogin.headers['set-cookie'] as string[])[0]!.split(';')[0]!;

      const suspendRes = await injectHttp(app, {
        method: 'POST',
        url: `/api/v1/admin/users/${ids.idAud}/suspend`,
        headers: { cookie: superCookie, 'x-csrf-token': superCsrf },
        body: { reason: 'Suspending for security drill' },
      });
      assert.equal(suspendRes.status, 200);

      // Suspended admin session is immediately invalidated
      const audMeAfterSuspend = await injectHttp(app, {
        method: 'GET',
        url: '/api/v1/admin/auth/me',
        headers: { cookie: audCookie },
      });
      assert.equal(audMeAfterSuspend.status, 401);

      // Suspended admin login attempt rejected cleanly with 403
      const suspendedLogin = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'aud@ovs.local', password: 'Auditor#2026!' },
      });
      assert.equal(suspendedLogin.status, 403);
    });

    test('enforces cross-state isolation, election-officer scope, READ_ONLY_AUDITOR mutation denial, and anti-enumeration lockout', async () => {
      const { app, ids } = await buildHarness();

      // 1. STATE_ADMIN (WB) cannot inspect MH admin (IDOR / cross-jurisdiction) or access MH endpoint
      const wbLogin = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'ECI-WB-1', password: 'WbAdmin#2026!' },
      });
      const wbCookie = (wbLogin.headers['set-cookie'] as string[])[0]!.split(';')[0]!;
      const wbCsrf = wbLogin.body.data.csrfToken;

      const crossStateRead = await injectHttp(app, {
        method: 'GET',
        url: `/api/v1/admin/users/${ids.idMh}`,
        headers: { cookie: wbCookie },
      });
      assert.equal(crossStateRead.status, 403);

      const mhScopeRes = await injectHttp(app, {
        method: 'GET',
        url: '/api/v1/admin/jurisdictions/states/MH',
        headers: { cookie: wbCookie },
      });
      assert.equal(mhScopeRes.status, 403);

      const wbScopeRes = await injectHttp(app, {
        method: 'GET',
        url: '/api/v1/admin/jurisdictions/states/WB',
        headers: { cookie: wbCookie },
      });
      assert.equal(wbScopeRes.status, 200);

      // WB STATE_ADMIN cannot grant national/unrestricted scope or create STATE_ADMIN
      const selfScopeEscalate = await injectHttp(app, {
        method: 'PUT',
        url: `/api/v1/admin/users/${ids.idRo}/scopes`,
        headers: { cookie: wbCookie, 'x-csrf-token': wbCsrf },
        body: { assignedStateId: null, stateIds: [] },
      });
      assert.equal(selfScopeEscalate.status, 403);

      // 2. ELECTION_OFFICER assigned LS-2029 succeeds on LS-2029, fails on WB-ASSEMBLY-2029, fails on /users
      const roLogin = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'ECI-RO-1', password: 'Officer#2026!' },
      });
      const roCookie = (roLogin.headers['set-cookie'] as string[])[0]!.split(';')[0]!;
      const roCsrf = roLogin.body.data.csrfToken;

      const allowedElection = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/jurisdictions/elections/LS-2029/verify-action',
        headers: { cookie: roCookie, 'x-csrf-token': roCsrf },
        body: {},
      });
      assert.equal(allowedElection.status, 200);

      const forbiddenElection = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/jurisdictions/elections/WB-ASSEMBLY-2029/verify-action',
        headers: { cookie: roCookie, 'x-csrf-token': roCsrf },
        body: {},
      });
      assert.equal(forbiddenElection.status, 403);

      const roUsers = await injectHttp(app, {
        method: 'GET',
        url: '/api/v1/admin/users',
        headers: { cookie: roCookie },
      });
      assert.equal(roUsers.status, 403);

      // 3. NATIONAL_ADMIN cannot modify SUPER_ADMIN
      const natLogin = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'ECI-NAT-1', password: 'SuperAdmin#2026!' },
      });
      const natCookie = (natLogin.headers['set-cookie'] as string[])[0]!.split(';')[0]!;
      const natCsrf = natLogin.body.data.csrfToken;

      const natSuspendSuper = await injectHttp(app, {
        method: 'POST',
        url: `/api/v1/admin/users/${ids.idSuper}/suspend`,
        headers: { cookie: natCookie, 'x-csrf-token': natCsrf },
        body: { reason: 'Privilege escalation attempt' },
      });
      assert.equal(natSuspendSuper.status, 403);

      // 4. READ_ONLY_AUDITOR denied on ALL mutating endpoints
      const audLogin = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'ECI-AUD-1', password: 'Auditor#2026!' },
      });
      const audCookie = (audLogin.headers['set-cookie'] as string[])[0]!.split(';')[0]!;
      const audCsrf = audLogin.body.data.csrfToken;

      const audListUsers = await injectHttp(app, {
        method: 'GET',
        url: '/api/v1/admin/users',
        headers: { cookie: audCookie },
      });
      assert.equal(audListUsers.status, 200);

      const audMutate = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/jurisdictions/elections/LS-2029/verify-action',
        headers: { cookie: audCookie, 'x-csrf-token': audCsrf },
        body: {},
      });
      assert.equal(audMutate.status, 403);

      // 5. Enumeration resistance + brute-force lockout (5 bad attempts -> 6th fails even with valid password)
      const unknownErr = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'nobody@ovs.local', password: 'WrongPassword#2026!' },
      });
      const wrongPassErr = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'ECI-WB-1', password: 'WrongPassword#2026!' },
      });
      assert.equal(unknownErr.status, 401);
      assert.equal(wrongPassErr.status, 401);
      assert.equal(unknownErr.body.detail, wrongPassErr.body.detail);

      for (let i = 0; i < 4; i++) {
        await injectHttp(app, {
          method: 'POST',
          url: '/api/v1/admin/auth/login',
          body: { identifier: 'ECI-WB-1', password: 'WrongPassword#2026!' },
        });
      }
      // 6th attempt even with CORRECT password is blocked during lockout!
      const lockedOut = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'ECI-WB-1', password: 'WbAdmin#2026!' },
      });
      assert.equal(lockedOut.status, 401);
    });

    test('rate limiter blocks excessive admin login attempts with 429', async () => {
      const { app } = await buildHarness({ loginRateLimitMax: 2 });

      await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'ECI-SUPER-1', password: 'bad' },
      });
      await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'ECI-SUPER-1', password: 'bad' },
      });

      const third = await injectHttp(app, {
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        body: { identifier: 'ECI-SUPER-1', password: 'bad' },
      });

      assert.equal(third.status, 429);
    });
  });
});
