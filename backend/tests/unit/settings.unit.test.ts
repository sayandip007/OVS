import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_PERMISSIONS,
  roleHasPermission,
} from '../../src/modules/admin/admin.permissions.js';
import {
  ConflictProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../src/common/errors/problemDetails.js';
import { SettingsService } from '../../src/modules/system-settings/settings.service.js';
import { FeaturesService } from '../../src/modules/system-settings/features.service.js';
import { MaintenanceService } from '../../src/modules/system-settings/maintenance.service.js';
import { createMaintenanceMiddleware } from '../../src/modules/system-settings/maintenance.middleware.js';
import { HealthDiagnosticsService } from '../../src/modules/system-settings/health.diagnostics.service.js';
import { SYSTEM_SETTINGS_REGISTRY, DEFAULT_FEATURE_FLAGS } from '../../src/modules/system-settings/settings.registry.js';
import type { PrismaClient } from '@prisma/client';

describe('OVS Phase 8.12 — System Settings, Feature Flags & Maintenance Unit Suite', () => {
  // In-memory mock database store
  function createMockPrisma() {
    const settingsStore = new Map<string, any>();
    const settingHistoryStore: any[] = [];
    const flagsStore = new Map<string, any>();
    const flagHistoryStore: any[] = [];
    const maintenanceStore: any[] = [];
    const actionLogStore: any[] = [];

    const mockPrisma = {
      systemSetting: {
        findUnique: async ({ where }: { where: { key: string } }) => {
          const row = settingsStore.get(where.key);
          return row ? { ...row } : null;
        },
        findMany: async (args?: any) => {
          let rows = Array.from(settingsStore.values());
          if (args?.where?.category) {
            rows = rows.filter((r) => r.category === args.where.category);
          }
          return rows.map((r) => ({ ...r }));
        },
        create: async ({ data }: { data: any }) => {
          const row = {
            ...data,
            version: data.version ?? 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          settingsStore.set(data.key, row);
          return { ...row };
        },
        update: async ({ where, data }: { where: { key: string }; data: any }) => {
          const existing = settingsStore.get(where.key);
          if (!existing) throw new Error('Not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          settingsStore.set(where.key, updated);
          return { ...updated };
        },
      },
      systemSettingHistory: {
        create: async ({ data }: { data: any }) => {
          const item = { ...data, id: `hist-${settingHistoryStore.length + 1}`, createdAt: new Date() };
          settingHistoryStore.push(item);
          return item;
        },
        findMany: async ({ where }: { where: { settingKey: string } }) => {
          return settingHistoryStore
            .filter((h) => h.settingKey === where.settingKey)
            .sort((a, b) => b.version - a.version);
        },
        findFirst: async ({ where }: { where: { settingKey: string; version: number } }) => {
          return (
            settingHistoryStore.find(
              (h) => h.settingKey === where.settingKey && h.version === where.version
            ) || null
          );
        },
      },
      featureFlag: {
        findUnique: async ({ where }: { where: { key: string } }) => {
          const flag = flagsStore.get(where.key);
          return flag ? { ...flag } : null;
        },
        findMany: async () => {
          return Array.from(flagsStore.values()).map((f) => ({ ...f }));
        },
        create: async ({ data }: { data: any }) => {
          const flag = { ...data, createdAt: new Date(), updatedAt: new Date() };
          flagsStore.set(data.key, flag);
          return { ...flag };
        },
        update: async ({ where, data }: { where: { key: string }; data: any }) => {
          const current = flagsStore.get(where.key);
          if (!current) throw new Error('Not found');
          const updated = { ...current, ...data, updatedAt: new Date() };
          flagsStore.set(where.key, updated);
          return { ...updated };
        },
      },
      featureFlagHistory: {
        create: async ({ data }: { data: any }) => {
          const item = { ...data, id: `ff-hist-${flagHistoryStore.length + 1}`, createdAt: new Date() };
          flagHistoryStore.push(item);
          return item;
        },
        findMany: async ({ where }: { where: { flagKey: string } }) => {
          return flagHistoryStore
            .filter((h) => h.flagKey === where.flagKey)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        },
      },
      maintenanceSchedule: {
        findFirst: async () => {
          if (maintenanceStore.length === 0) return null;
          return { ...maintenanceStore[maintenanceStore.length - 1] };
        },
        create: async ({ data }: { data: any }) => {
          const record = {
            ...data,
            id: `maint-${maintenanceStore.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          maintenanceStore.push(record);
          return { ...record };
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const idx = maintenanceStore.findIndex((m) => m.id === where.id);
          if (idx === -1) throw new Error('Not found');
          maintenanceStore[idx] = { ...maintenanceStore[idx], ...data, updatedAt: new Date() };
          return { ...maintenanceStore[idx] };
        },
      },
      adminActionLog: {
        create: async ({ data }: { data: any }) => {
          const log = { ...data, id: `audit-${actionLogStore.length + 1}`, timestamp: new Date() };
          actionLogStore.push(log);
          return log;
        },
      },
      notificationDelivery: {
        count: async () => 0,
      },
      election: {
        count: async () => 2,
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    return {
      mockPrisma: mockPrisma as unknown as PrismaClient,
      settingsStore,
      settingHistoryStore,
      flagsStore,
      flagHistoryStore,
      maintenanceStore,
      actionLogStore,
    };
  }

  test('1. RBAC: Centralized permissions matrix distinguishes super admin, national admin, state admin, and read-only auditor', () => {
    // SUPER_ADMIN has full permissions
    assert.strictEqual(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.SETTINGS_READ), true);
    assert.strictEqual(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.SETTINGS_MANAGE), true);
    assert.strictEqual(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.SETTINGS_ROLLBACK), true);
    assert.strictEqual(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.FEATURES_MANAGE), true);
    assert.strictEqual(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.MAINTENANCE_MANAGE), true);
    assert.strictEqual(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.DIAGNOSTICS_READ), true);

    // NATIONAL_ADMIN has operational settings and features, but NOT maintenance or rollback
    assert.strictEqual(roleHasPermission('NATIONAL_ADMIN', ADMIN_PERMISSIONS.SETTINGS_READ), true);
    assert.strictEqual(roleHasPermission('NATIONAL_ADMIN', ADMIN_PERMISSIONS.SETTINGS_MANAGE), true);
    assert.strictEqual(roleHasPermission('NATIONAL_ADMIN', ADMIN_PERMISSIONS.FEATURES_MANAGE), true);
    assert.strictEqual(roleHasPermission('NATIONAL_ADMIN', ADMIN_PERMISSIONS.MAINTENANCE_MANAGE), false);
    assert.strictEqual(roleHasPermission('NATIONAL_ADMIN', ADMIN_PERMISSIONS.SETTINGS_ROLLBACK), false);

    // STATE_ADMIN has zero global management permissions
    assert.strictEqual(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.SETTINGS_READ), true);
    assert.strictEqual(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.SETTINGS_MANAGE), false);
    assert.strictEqual(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.FEATURES_MANAGE), false);
    assert.strictEqual(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.MAINTENANCE_MANAGE), false);

    // READ_ONLY_AUDITOR has zero mutating capabilities
    assert.strictEqual(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.SETTINGS_READ), true);
    assert.strictEqual(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.SETTINGS_MANAGE), false);
    assert.strictEqual(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.SETTINGS_ROLLBACK), false);
    assert.strictEqual(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.FEATURES_MANAGE), false);
    assert.strictEqual(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.MAINTENANCE_MANAGE), false);
    assert.strictEqual(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.DIAGNOSTICS_READ), true);
  });

  test('2. Settings Registry: Initializes with typed safe defaults and custom validation rules', async () => {
    const { mockPrisma } = createMockPrisma();
    const service = new SettingsService(mockPrisma);

    const list = await service.listSettings();
    assert.ok(list.length >= Object.keys(SYSTEM_SETTINGS_REGISTRY).length);

    const siteName = await service.getSettingByKey('platform.siteName');
    assert.strictEqual(siteName.value, 'Online Voting System (ECI Simulation)');
    assert.strictEqual(siteName.valueType, 'STRING');
    assert.strictEqual(siteName.version, 1);

    const nomDays = await service.getSettingByKey('election.defaultNominationWindowDays');
    assert.strictEqual(nomDays.value, 14);
    assert.strictEqual(nomDays.valueType, 'NUMBER');
  });

  test('3. Optimistic Concurrency: Throws ConflictProblemError (HTTP 409) on stale expectedVersion', async () => {
    const { mockPrisma } = createMockPrisma();
    const service = new SettingsService(mockPrisma);

    // Current version is 1. Attempting update with expectedVersion = 2 must fail with 409
    await assert.rejects(
      async () => {
        await service.updateSetting(
          'platform.siteName',
          'Updated Name',
          2, // Stale/invalid version
          'Testing conflict rejection'
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictProblemError);
        assert.strictEqual(err.status, 409);
        assert.ok(err.message.includes('Optimistic concurrency violation'));
        return true;
      }
    );
  });

  test('4. Setting Mutation & History: Successful update increments version and writes audit history', async () => {
    const { mockPrisma, settingHistoryStore } = createMockPrisma();
    const service = new SettingsService(mockPrisma);

    const updated = await service.updateSetting(
      'platform.siteName',
      'ECI Digital Voting Demo',
      1,
      'Phase 8.12 rebranding',
      { adminUserId: 'super-admin-uuid', actorIdentifier: 'ECI-SUPER' }
    );

    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.value, 'ECI Digital Voting Demo');

    // History record should exist
    const history = await service.getSettingHistory('platform.siteName');
    assert.strictEqual(history.length, 1);
    const item0 = history[0]!;
    assert.strictEqual(item0.version, 2);
    assert.strictEqual(item0.newValue, 'ECI Digital Voting Demo');
    assert.strictEqual(item0.changeReason, 'Phase 8.12 rebranding');
  });

  test('5. Atomic Bulk Updates: Aborts all updates if any single setting fails version match', async () => {
    const { mockPrisma } = createMockPrisma();
    const service = new SettingsService(mockPrisma);

    // Initial state: nominationDays = 14 (v1), scrutinyDays = 2 (v1)
    await assert.rejects(
      async () => {
        await service.bulkUpdateSettings({
          updates: [
            { key: 'election.defaultNominationWindowDays', value: 20, expectedVersion: 1 },
            { key: 'election.defaultScrutinyWindowDays', value: 5, expectedVersion: 99 }, // Mismatch!
          ],
          changeReason: 'Attempting invalid bulk update',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ConflictProblemError);
        return true;
      }
    );

    // Verify first setting was NOT changed (atomic rollback)
    const check = await service.getSettingByKey('election.defaultNominationWindowDays');
    assert.strictEqual(check.value, 14);
    assert.strictEqual(check.version, 1);
  });

  test('6. Setting Rollback: Reverts to historical version and creates a new version entry', async () => {
    const { mockPrisma } = createMockPrisma();
    const service = new SettingsService(mockPrisma);

    // v1 -> v2
    await service.updateSetting('platform.siteName', 'Version Two', 1, 'Bump to v2');
    // v2 -> v3
    await service.updateSetting('platform.siteName', 'Version Three', 2, 'Bump to v3');

    // Rollback to v2
    const rolledBack = await service.rollbackSetting(
      'platform.siteName',
      2,
      'Emergency rollback to v2'
    );

    assert.strictEqual(rolledBack.version, 4);
    assert.strictEqual(rolledBack.value, 'Version Two');

    const history = await service.getSettingHistory('platform.siteName');
    assert.strictEqual(history.length, 3);
    const latestHistory = history[0]!;
    assert.ok(latestHistory.changeReason.includes('Rollback to version 2'));
  });

  test('7. Feature Flags: Evaluation handles enabled, rollout percentage, and role targeting', async () => {
    const { mockPrisma } = createMockPrisma();
    const service = new FeaturesService(mockPrisma);
    await service.ensureFeatureFlagsInitialized();

    // Test default enabled flag
    const isAdvEnabled = await service.isFeatureEnabled('feat.advanced_analytics');
    assert.strictEqual(isAdvEnabled, true);

    // Test disabled email flag
    const isEmailDefault = await service.isFeatureEnabled('feat.email_notification_delivery');
    assert.strictEqual(isEmailDefault, false);

    // Role-targeted evaluation
    const isSuperAllowed = await service.isFeatureEnabled('feat.email_notification_delivery', {
      actorRole: 'SUPER_ADMIN',
    });
    assert.strictEqual(isSuperAllowed, true);

    const isAuditorAllowed = await service.isFeatureEnabled('feat.email_notification_delivery', {
      actorRole: 'READ_ONLY_AUDITOR',
    });
    assert.strictEqual(isAuditorAllowed, false);

    // Unknown flag fails closed
    const unknownFlag = await service.isFeatureEnabled('feat.non_existent_experimental');
    assert.strictEqual(unknownFlag, false);
  });

  test('8. Maintenance Mode: Intercepts non-admin requests with HTTP 503, allows health and admin recovery', async () => {
    const { mockPrisma } = createMockPrisma();
    const maintService = new MaintenanceService(mockPrisma);

    // Transition to MAINTENANCE_ACTIVE
    await maintService.setMaintenanceState({
      state: 'MAINTENANCE_ACTIVE',
      message: 'Emergency database upgrade in progress',
      isEmergency: true,
      reason: 'Critical indexing patch',
    });

    const middleware = createMaintenanceMiddleware(maintService);

    // Test 1: Health check endpoint bypasses maintenance
    let healthPassed = false;
    const reqHealth: any = { originalUrl: '/api/v1/health/live', url: '/api/v1/health/live' };
    const resHealth: any = { setHeader: () => {} };
    await middleware(reqHealth, resHealth, () => {
      healthPassed = true;
    });
    assert.strictEqual(healthPassed, true);

    // Test 2: Public voter API is intercepted with HTTP 503
    let status503Received = false;
    let jsonPayload: any = null;
    let retryAfterHeader = '';
    const reqVoter: any = {
      originalUrl: '/api/v1/voters/profile',
      url: '/api/v1/voters/profile',
      requestId: 'req-test-1',
    };
    const resVoter: any = {
      setHeader: (name: string, val: string) => {
        if (name === 'Retry-After') retryAfterHeader = val;
      },
      status: (code: number) => {
        if (code === 503) status503Received = true;
        return {
          json: (body: any) => {
            jsonPayload = body;
          },
        };
      },
    };

    await middleware(reqVoter, resVoter, () => {
      assert.fail('Non-admin request should not pass through active maintenance mode');
    });

    assert.strictEqual(status503Received, true);
    assert.strictEqual(jsonPayload?.code, 'MAINTENANCE_ACTIVE');
    assert.strictEqual(jsonPayload?.detail, 'Emergency database upgrade in progress');
    assert.ok(Number(retryAfterHeader) > 0);

    // Test 3: Authenticated SUPER_ADMIN recovery request bypasses maintenance
    let adminPassed = false;
    const reqAdmin: any = {
      originalUrl: '/api/v1/admin/elections',
      url: '/api/v1/admin/elections',
      user: { userType: 'ADMIN', id: 'admin-super' },
      adminUser: { role: 'SUPER_ADMIN' },
    };
    const resAdmin: any = { setHeader: () => {} };
    await middleware(reqAdmin, resAdmin, () => {
      adminPassed = true;
    });
    assert.strictEqual(adminPassed, true);
  });

  test('9. Health Diagnostics: Exposes operational health telemetry without leaking database credentials or secrets', async () => {
    const { mockPrisma } = createMockPrisma();
    const service = new HealthDiagnosticsService(
      mockPrisma,
      undefined,
      async () => ({ connected: true, latencyMs: 4 })
    );

    const report = await service.getDiagnosticsReport();
    assert.strictEqual(report.service, 'ovs-backend');
    assert.strictEqual(report.version, '1.0.0-phase-8.12');
    assert.ok(typeof report.uptimeSeconds === 'number');
    assert.ok(typeof report.memory.heapUsedMb === 'number');
    assert.ok(typeof report.database.status === 'string');

    // Security check: Zero secret leakage in report
    const serialized = JSON.stringify(report);
    assert.strictEqual(serialized.includes('DATABASE_URL'), false);
    assert.strictEqual(serialized.includes('SESSION_SECRET'), false);
    assert.strictEqual(serialized.includes('postgres://'), false);
    assert.strictEqual(serialized.includes('password'), false);
  });
});
