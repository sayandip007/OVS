/**
 * OVS Phase 8.15.1 — Demo Seed System Security Regression Test Suite
 *
 * Verifies:
 *  1. Explicit refusal to run when NODE_ENV=production.
 *  2. Explicit refusal to run when NODE_ENV=staging.
 *  3. Explicit refusal to run without OVS_ALLOW_DEMO_SEED=true.
 *  4. Fail-closed refusal when target database host or name is unsafe.
 *  5. Protection against overwriting existing non-demo administrators.
 *  6. Protection against resetting existing administrator passwords to shared demo password.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSafeDemoEnvironment,
  provisionDemoAdministrators,
} from '../../prisma/seed-demo.js';

describe('OVS Phase 8.15.1 — Demo Seed System Security Suite', () => {
  const safeDbUrl = 'postgresql://ovs_admin:secret@localhost:5432/ovs_dev?schema=public';

  describe('1. Environment & Database Safety Guards (assertSafeDemoEnvironment)', () => {
    test('strictly refuses execution when NODE_ENV=production', () => {
      assert.throws(
        () => assertSafeDemoEnvironment(safeDbUrl, 'production', 'true'),
        (err: Error) => {
          assert.match(err.message, /FAIL-CLOSED DEMO SEED GUARD/);
          assert.match(err.message, /NODE_ENV=production/);
          return true;
        }
      );
    });

    test('strictly refuses execution when NODE_ENV=staging', () => {
      assert.throws(
        () => assertSafeDemoEnvironment(safeDbUrl, 'staging', 'true'),
        (err: Error) => {
          assert.match(err.message, /FAIL-CLOSED DEMO SEED GUARD/);
          assert.match(err.message, /NODE_ENV=staging/);
          return true;
        }
      );
    });

    test('strictly refuses execution when OVS_ALLOW_DEMO_SEED is not "true"', () => {
      assert.throws(
        () => assertSafeDemoEnvironment(safeDbUrl, 'development', 'false'),
        (err: Error) => {
          assert.match(err.message, /OVS_ALLOW_DEMO_SEED must be explicitly set to "true"/);
          return true;
        }
      );

      assert.throws(
        () => assertSafeDemoEnvironment(safeDbUrl, 'development', null),
        (err: Error) => {
          assert.match(err.message, /OVS_ALLOW_DEMO_SEED must be explicitly set to "true"/);
          return true;
        }
      );
    });

    test('strictly refuses execution when DATABASE_URL is missing or invalid', () => {
      assert.throws(
        () => assertSafeDemoEnvironment(null, 'development', 'true'),
        (err: Error) => {
          assert.match(err.message, /DATABASE_URL is undefined/);
          return true;
        }
      );

      assert.throws(
        () => assertSafeDemoEnvironment('not_a_valid_url', 'development', 'true'),
        (err: Error) => {
          assert.match(err.message, /DATABASE_URL is not a valid URL/);
          return true;
        }
      );
    });

    test('strictly refuses execution when database host is remote or non-local', () => {
      const remoteDbUrl = 'postgresql://ovs_admin:secret@prod-db.internal.gov.in:5432/ovs_dev';
      assert.throws(
        () => assertSafeDemoEnvironment(remoteDbUrl, 'development', 'true'),
        (err: Error) => {
          assert.match(err.message, /unverified database target/);
          return true;
        }
      );
    });

    test('strictly refuses execution when database name does not contain dev/demo/test indicator', () => {
      const prodNamedDb = 'postgresql://ovs_admin:secret@localhost:5432/election_commission_live';
      assert.throws(
        () => assertSafeDemoEnvironment(prodNamedDb, 'development', 'true'),
        (err: Error) => {
          assert.match(err.message, /Target must be a designated development\/demo\/test database/);
          return true;
        }
      );
    });

    test('passes successfully when all criteria are satisfied (local development/demo target)', () => {
      assert.doesNotThrow(() =>
        assertSafeDemoEnvironment(
          'postgresql://ovs_admin:secret@localhost:5432/ovs_dev',
          'development',
          'true'
        )
      );

      assert.doesNotThrow(() =>
        assertSafeDemoEnvironment(
          'postgresql://ovs_admin:secret@postgres-db:5432/ovs_demo',
          'test',
          'true'
        )
      );
    });
  });

  describe('2. Existing Non-Demo Administrator Protection & Idempotent Password Guard', () => {
    test('provisionDemoAdministrators fails closed if an existing non-demo administrator has a conflicting officerCode', async () => {
      const mockClient: any = {
        adminUser: {
          findUnique: async ({ where }: any) => {
            if (where.officerCode === 'ECI-SUPER-DEMO') {
              // Non-demo admin exists with a different ID
              return { id: 'DIFFERENT-REAL-ADMIN-UUID', officerCode: 'ECI-SUPER-DEMO' };
            }
            return null;
          },
        },
        user: {
          findUnique: async () => null,
          create: async () => ({}),
          update: async () => ({}),
        },
      };

      await assert.rejects(
        async () => provisionDemoAdministrators(mockClient, 'mock-hash'),
        (err: Error) => {
          assert.match(err.message, /FAIL-CLOSED DEMO SEED GUARD: Found existing non-demo administrator/);
          return true;
        }
      );
    });

    test('provisionDemoAdministrators preserves existing administrator password hash on repeated execution (idempotency)', async () => {
      let userUpdateCalled = false;
      let userUpdateData: any = null;

      const mockClient: any = {
        adminUser: {
          findUnique: async ({ where }: any) => {
            // Already has matching demo admin ID
            if (where.officerCode === 'ECI-SUPER-DEMO') {
              return { id: '77777777-7777-4777-8777-777777771001', officerCode: 'ECI-SUPER-DEMO' };
            }
            return null;
          },
          create: async () => ({}),
          update: async () => ({}),
        },
        user: {
          findUnique: async ({ where }: any) => {
            if (where.identifier === 'ECI-SUPER-DEMO') {
              return {
                id: '77777777-7777-4777-8777-777777770001',
                identifier: 'ECI-SUPER-DEMO',
                passwordHash: '$scrypt$existing_custom_secure_hash',
              };
            }
            return null;
          },
          create: async () => ({}),
          update: async ({ data }: any) => {
            userUpdateCalled = true;
            userUpdateData = data;
            return {};
          },
        },
      };

      await provisionDemoAdministrators(mockClient, 'new-demo-hash');
      assert.equal(userUpdateCalled, true);
      // Crucial: passwordHash MUST NOT be present in update data
      assert.equal(userUpdateData.passwordHash, undefined, 'Must not overwrite passwordHash on update');
    });
  });
});
