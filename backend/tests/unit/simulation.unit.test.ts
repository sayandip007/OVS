import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_PERMISSIONS,
  roleHasPermission,
} from '../../src/modules/admin/admin.permissions.js';
import {
  MasterAdminSimulationService,
  PAN_INDIA_36_STATES_SPEC,
} from '../../src/modules/admin/simulation.service.js';
import type { PrismaClient } from '@prisma/client';

describe('Master Admin Pan-India Simulation & Stress Suite Unit Tests', () => {
  test('RBAC Authorization: Only SUPER_ADMIN possesses SIMULATION_MANAGE and SIMULATION_READ', () => {
    assert.equal(
      roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.SIMULATION_MANAGE),
      true,
      'SUPER_ADMIN must have SIMULATION_MANAGE'
    );
    assert.equal(
      roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.SIMULATION_READ),
      true,
      'SUPER_ADMIN must have SIMULATION_READ'
    );

    // Other roles must be strictly denied
    const nonSuperRoles = ['NATIONAL_ADMIN', 'STATE_ADMIN', 'ELECTION_OFFICER', 'READ_ONLY_AUDITOR'] as const;
    for (const role of nonSuperRoles) {
      assert.equal(
        roleHasPermission(role, ADMIN_PERMISSIONS.SIMULATION_MANAGE),
        false,
        `${role} must NOT have SIMULATION_MANAGE`
      );
      assert.equal(
        roleHasPermission(role, ADMIN_PERMISSIONS.SIMULATION_READ),
        false,
        `${role} must NOT have SIMULATION_READ`
      );
    }
  });

  test('Geography Spec: Pan-India dataset contains exactly 36 States & Union Territories (28 States, 8 UTs)', () => {
    assert.equal(PAN_INDIA_36_STATES_SPEC.length, 36, 'Must contain all 36 States and UTs');

    const states = PAN_INDIA_36_STATES_SPEC.filter((s) => s.type === 'STATE');
    const uts = PAN_INDIA_36_STATES_SPEC.filter((s) => s.type === 'UNION_TERRITORY');

    assert.equal(states.length, 28, 'Must have exactly 28 States');
    assert.equal(uts.length, 8, 'Must have exactly 8 Union Territories');

    // Verify key states
    const stateIds = new Set(PAN_INDIA_36_STATES_SPEC.map((s) => s.id));
    assert.ok(stateIds.has('WB'), 'West Bengal must be present');
    assert.ok(stateIds.has('MH'), 'Maharashtra must be present');
    assert.ok(stateIds.has('UP'), 'Uttar Pradesh must be present');
    assert.ok(stateIds.has('TN'), 'Tamil Nadu must be present');
    assert.ok(stateIds.has('DL'), 'NCT of Delhi must be present');
  });

  test('Simulation Engine: Generates Pan-India elections, candidates, nominations, and published sessions', async () => {
    const statesStore = new Map<string, any>();
    const districtsStore = new Map<string, any>();
    const pcStore = new Map<string, any>();
    const acStore = new Map<string, any>();
    const partiesStore = new Map<string, any>();
    const electionsStore = new Map<string, any>();
    const candidatesStore = new Map<string, any>();
    const nominationsStore: any[] = [];
    const sessionsStore = new Map<string, any>();
    const talliesStore = new Map<string, any>();
    const actionLogs: any[] = [];

    const mockPrisma = {
      politicalParty: {
        upsert: async ({ where, update, create }: any) => {
          const row = { ...(where.id ? update : create) };
          partiesStore.set(where.id, row);
          return row;
        },
      },
      state: {
        upsert: async ({ where, update, create }: any) => {
          const row = { ...(where.id ? update : create) };
          statesStore.set(where.id, row);
          return row;
        },
        count: async () => statesStore.size,
      },
      district: {
        upsert: async ({ where, update, create }: any) => {
          const row = { ...(where.id ? update : create) };
          districtsStore.set(where.id, row);
          return row;
        },
      },
      parliamentaryConstituency: {
        upsert: async ({ where, update, create }: any) => {
          const row = { ...(where.id ? update : create) };
          pcStore.set(where.id, row);
          return row;
        },
      },
      assemblyConstituency: {
        upsert: async ({ where, update, create }: any) => {
          const row = { ...(where.id ? update : create) };
          acStore.set(where.id, row);
          return row;
        },
      },
      election: {
        upsert: async ({ where, update, create }: any) => {
          const row = { ...(where.id ? update : create) };
          electionsStore.set(where.id, row);
          return row;
        },
        count: async () => electionsStore.size,
      },
      candidate: {
        createMany: async ({ data }: any) => {
          for (const item of data) {
            candidatesStore.set(item.id, item);
          }
          return { count: data.length };
        },
        count: async () => candidatesStore.size,
        deleteMany: async ({ where }: any) => {
          let count = 0;
          for (const [id] of candidatesStore) {
            if (!where?.id?.startsWith || id.startsWith(where.id.startsWith)) {
              candidatesStore.delete(id);
              count++;
            }
          }
          return { count };
        },
      },
      candidateNomination: {
        createMany: async ({ data }: any) => {
          nominationsStore.push(...data);
          return { count: data.length };
        },
        count: async () => nominationsStore.length,
        deleteMany: async () => {
          const count = nominationsStore.length;
          nominationsStore.length = 0;
          return { count };
        },
      },
      countingSession: {
        upsert: async ({ where, update, create }: any) => {
          const row = { ...(where.id ? update : create) };
          sessionsStore.set(where.id, row);
          return row;
        },
        count: async () => sessionsStore.size,
        deleteMany: async () => {
          const count = sessionsStore.size;
          sessionsStore.clear();
          return { count };
        },
      },
      candidateTally: {
        upsert: async ({ where, update, create }: any) => {
          const key = `${where.sessionId_candidateId.sessionId}_${where.sessionId_candidateId.candidateId}`;
          const row = { ...(update || create) };
          talliesStore.set(key, row);
          return row;
        },
        deleteMany: async () => {
          const count = talliesStore.size;
          talliesStore.clear();
          return { count };
        },
      },
      demoParticipation: {
        findFirst: async () => {
          // Zero-Knowledge Sample: NO candidate or party reference!
          return {
            id: 'uuid-1',
            voterId: 'voter-uuid',
            electionId: 'LS-2029',
            status: 'PARTICIPATED',
            demoReference: 'DEMO-LS-000001',
          };
        },
      },
      adminActionLog: {
        create: async ({ data }: any) => {
          actionLogs.push(data);
          return data;
        },
      },
    } as unknown as PrismaClient;

    const mockAudit = {
      recordSecurityEvent: async (ev: any) => {
        actionLogs.push(ev);
      },
    } as any;

    const service = new MasterAdminSimulationService(mockPrisma, mockAudit);

    // Simulate 2 states (WB and MH) with 50 candidates each
    const result = await service.runPanIndiaSimulation({
      candidatesPerState: 50,
      targetStateIds: ['WB', 'MH'],
      simulateCounting: true,
      adminUserId: 'admin-uuid-super',
      actorIdentifier: 'ECI-SUPER-001',
    });

    assert.equal(result.success, true);
    assert.equal(result.statesSimulated, 2);
    assert.equal(result.candidatesGenerated, 100);
    assert.equal(result.nominationsCreated, 100);
    assert.ok(result.countingSessionsCreated > 0);
    assert.equal(result.secretBallotZeroKnowledgeVerified, true);
    assert.equal(result.choiceLeakageCount, 0);

    // Verify status endpoint
    const status = await service.getSimulationStatus();
    assert.equal(status.candidatesCount, 100);
    assert.equal(status.nominationsCount, 100);
    assert.equal(status.secretBallotZeroKnowledgeVerified, true);

    // Verify purge endpoint
    const purgeResult = await service.purgeSimulatedData('admin-uuid-super', 'ECI-SUPER-001');
    assert.equal(purgeResult.purgedCandidates, 100);
    assert.equal(purgeResult.purgedNominations, 100);

    const postPurgeStatus = await service.getSimulationStatus();
    assert.equal(postPurgeStatus.candidatesCount, 0);
  });

  test('Privacy Boundary Invariant: Detects and rejects any candidate or party choice in participation table', async () => {
    // Deliberate corrupt mock containing choice leakage
    const corruptPrisma = {
      demoParticipation: {
        findFirst: async () => ({
          id: 'leak-1',
          voterId: 'voter-uuid',
          electionId: 'LS-2029',
          candidateId: 'CANDIDATE-CHOICE-LEAKAGE', // VIOLATION!
        }),
      },
    } as unknown as PrismaClient;

    const service = new MasterAdminSimulationService(corruptPrisma, {} as any);
    const audit = await service.verifySecretBallotInvariant();

    assert.equal(audit.verified, false, 'Must fail verification when candidateId is present');
    assert.equal(audit.choiceLeakageCount, 1, 'Must detect exactly 1 leaked choice column');
  });
});
