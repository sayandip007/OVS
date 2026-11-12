import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsService } from '../../src/modules/analytics/analytics.service.js';
import { AnalyticsExportService } from '../../src/modules/analytics/analytics.export.service.js';
import {
  nationalAnalyticsQuerySchema,
  exportQuerySchema,
  participationAnalyticsQuerySchema,
} from '../../src/modules/analytics/analytics.schemas.js';
import {
  ADMIN_PERMISSIONS,
  roleHasPermission,
} from '../../src/modules/admin/admin.permissions.js';
import { ForbiddenProblemError } from '../../src/common/errors/problemDetails.js';
import type { SafeAdminUser } from '../../src/modules/auth/auth.types.js';

describe('OVS Phase 8.10 — Analytics, Dashboards, Privacy & Export Unit Suite', () => {
  const superAdmin: SafeAdminUser = {
    id: 'admin-super-01',
    userId: 'user-super-01',
    officerCode: 'ECI-SUPER-01',
    email: 'super@ovs.test',
    fullName: 'Super Admin',
    designation: 'Chief Election Commissioner',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: null,
    assignedStateIds: [],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
  };

  const wbAdmin: SafeAdminUser = {
    id: 'admin-wb-01',
    userId: 'user-wb-01',
    officerCode: 'ECI-WB-01',
    email: 'wb@ovs.test',
    fullName: 'WB Admin',
    designation: 'Chief Electoral Officer',
    role: 'STATE_ADMIN',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: 'WB',
    assignedStateIds: ['WB'],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
  };

  const electionOfficer: SafeAdminUser = {
    id: 'admin-eo-01',
    userId: 'user-eo-01',
    officerCode: 'ECI-EO-01',
    email: 'eo@ovs.test',
    fullName: 'Election Officer',
    designation: 'Returning Officer',
    role: 'ELECTION_OFFICER',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: null,
    assignedStateIds: [],
    assignedElectionIds: ['LS-2029'],
    assignedConstituencyScopes: [],
  };

  const auditor: SafeAdminUser = {
    id: 'admin-aud-01',
    userId: 'user-aud-01',
    officerCode: 'ECI-AUD-01',
    email: 'auditor@ovs.test',
    fullName: 'Auditor User',
    designation: 'External Auditor',
    role: 'READ_ONLY_AUDITOR',
    status: 'ACTIVE',
    isActive: true,
    assignedStateId: null,
    assignedStateIds: [],
    assignedElectionIds: [],
    assignedConstituencyScopes: [],
  };

  test('1. Centralized RBAC matrix enforces analytics permissions and auditor read-only rules', () => {
    // SUPER_ADMIN has full permissions
    assert.equal(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.ANALYTICS_READ), true);
    assert.equal(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.ANALYTICS_READ_NATIONAL), true);
    assert.equal(roleHasPermission('SUPER_ADMIN', ADMIN_PERMISSIONS.ANALYTICS_EXPORT), true);

    // STATE_ADMIN has state analytics and export, but lacks direct national permission
    assert.equal(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.ANALYTICS_READ_STATE), true);
    assert.equal(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.ANALYTICS_READ_NATIONAL), false);
    assert.equal(roleHasPermission('STATE_ADMIN', ADMIN_PERMISSIONS.ANALYTICS_EXPORT), true);

    // ELECTION_OFFICER lacks national, state, and export permissions
    assert.equal(roleHasPermission('ELECTION_OFFICER', ADMIN_PERMISSIONS.ANALYTICS_READ_NATIONAL), false);
    assert.equal(roleHasPermission('ELECTION_OFFICER', ADMIN_PERMISSIONS.ANALYTICS_READ_STATE), false);
    assert.equal(roleHasPermission('ELECTION_OFFICER', ADMIN_PERMISSIONS.ANALYTICS_EXPORT), false);
    assert.equal(roleHasPermission('ELECTION_OFFICER', ADMIN_PERMISSIONS.ANALYTICS_READ_ELECTION), true);

    // READ_ONLY_AUDITOR has all analytics read permissions and export, but zero mutating permissions
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.ANALYTICS_READ_NATIONAL), true);
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.ANALYTICS_EXPORT), true);
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.ELECTIONS_CREATE), false);
    assert.equal(roleHasPermission('READ_ONLY_AUDITOR', ADMIN_PERMISSIONS.RESULTS_PUBLISH), false);
  });

  test('2. Jurisdiction scoping allows STATE_ADMIN for assigned state and rejects cross-state access', () => {
    const service = new AnalyticsService({} as any);

    // WB Admin accessing WB succeeds
    assert.doesNotThrow(() => {
      service.assertStateJurisdiction(wbAdmin, 'WB');
    });

    // WB Admin accessing MH is rejected with 403 Forbidden
    assert.throws(
      () => {
        service.assertStateJurisdiction(wbAdmin, 'MH');
      },
      (err: any) => err instanceof ForbiddenProblemError && err.status === 403
    );

    // SuperAdmin and Auditor can access any state
    assert.doesNotThrow(() => {
      service.assertStateJurisdiction(superAdmin, 'MH');
      service.assertStateJurisdiction(auditor, 'MH');
    });
  });

  test('3. CSV formula injection protection safely neutralizes executable spreadsheet prefixes', () => {
    const exportService = new AnalyticsExportService();

    // Dangerous formula prefixes: '=', '+', '-', '@', '\t', '\r'
    assert.equal(exportService.sanitizeCsvCell('=SUM(A1:B10)'), `"'=SUM(A1:B10)"`);
    assert.equal(exportService.sanitizeCsvCell('+cmd|/C calc!A0'), `"'+cmd|/C calc!A0"`);
    assert.equal(exportService.sanitizeCsvCell('@HYPERLINK("evil.com")'), `"'@HYPERLINK(""evil.com"")"`);
    assert.equal(exportService.sanitizeCsvCell('-50+2'), `"'-50+2"`);
    assert.equal(exportService.sanitizeCsvCell('\tmaliciousTab'), `"'\tmaliciousTab"`);

    // Standard benign values
    assert.equal(exportService.sanitizeCsvCell('General Parliamentary Elections 2029'), `"General Parliamentary Elections 2029"`);
    assert.equal(exportService.sanitizeCsvCell(465000), `"465000"`);
    assert.equal(exportService.sanitizeCsvCell(null), `""`);
  });

  test('4. ExportService builds RFC 4180 CSV tables with simulation headers and JSON metadata', () => {
    const exportService = new AnalyticsExportService();

    // CSV national export
    const csvExport = exportService.exportData('national', 'csv', {
      totalElections: 5,
      electionsByType: { lokSabha: 1, stateAssembly: 4 },
      totalAssignedConstituencies: { parliamentary: 6, assembly: 8, total: 14 },
      statesCoveredCount: 3,
      milestoneAlerts: { pollingActiveCount: 2, publishedResultsCount: 1 },
    });

    assert.equal(csvExport.mimeType, 'text/csv; charset=utf-8');
    assert.ok(csvExport.content.includes('"Total Elections"'));
    assert.ok(csvExport.content.includes('"5"'));

    // JSON export includes simulation disclaimer metadata
    const jsonExport = exportService.exportData('election', 'json', {
      id: 'LS-2029',
      name: 'General Parliamentary Elections 2029',
    });

    assert.equal(jsonExport.mimeType, 'application/json; charset=utf-8');
    const parsed = JSON.parse(jsonExport.content);
    assert.equal(parsed.meta.isSimulated, true);
    assert.equal(parsed.meta.disclaimer, 'SIMULATED DEMO DATA - NOT OFFICIAL ELECTION DATA');
    assert.equal(parsed.data.id, 'LS-2029');
  });

  test('5. Zod request schemas enforce strict input shapes and reject extra unknown fields', () => {
    // Valid national query
    const validQ = nationalAnalyticsQuerySchema.safeParse({
      electionType: 'LOK_SABHA',
      year: 2029,
    });
    assert.equal(validQ.success, true);

    // Reject invalid year
    const invalidYear = nationalAnalyticsQuerySchema.safeParse({
      year: 1850,
    });
    assert.equal(invalidYear.success, false);

    // Reject unknown field injection (.strict())
    const extraField = nationalAnalyticsQuerySchema.safeParse({
      year: 2029,
      injectCandidateChoices: true,
    });
    assert.equal(extraField.success, false);

    // Valid export query
    const validExp = exportQuerySchema.safeParse({
      domain: 'participation',
      format: 'csv',
      electionId: 'LS-2029',
    });
    assert.equal(validExp.success, true);
  });

  test('6. Strict Zero-Derivation Invariant: Participation analytics queries DemoParticipation only without candidate joins', async () => {
    let demoParticipationCalled = false;
    let candidateTallyCalled = false;

    const mockPrisma: any = {
      demoParticipation: {
        count: async () => {
          demoParticipationCalled = true;
          return 42;
        },
        groupBy: async () => [
          { electionId: 'LS-2029', _count: { id: 42 } },
        ],
        findMany: async () => [
          { participatedAt: new Date('2026-06-01T10:00:00Z') },
        ],
      },
      voterProfile: {
        count: async () => 100,
      },
      election: {
        findMany: async () => [
          { id: 'LS-2029', name: 'General Elections 2029', type: 'LOK_SABHA' },
        ],
      },
      parliamentaryConstituency: {
        findMany: async () => [],
      },
      assemblyConstituency: {
        findMany: async () => [],
      },
      candidateTally: {
        findMany: async () => {
          candidateTallyCalled = true;
          return [];
        },
      },
    };

    const service = new AnalyticsService(mockPrisma);
    const result = await service.getParticipationAnalytics(superAdmin, { electionId: 'LS-2029' });

    assert.equal(demoParticipationCalled, true);
    assert.equal(candidateTallyCalled, false, 'CandidateTally must NEVER be called or joined for participation analytics!');
    assert.equal(result.data.totalParticipatingDemoAccounts, 42);
    assert.equal(result.data.demoParticipationRatePercentage, 42.0); // 42 / 100 * 100
    assert.equal(result.data.classification, 'DEMO_PARTICIPATION_AGGREGATE');
  });

  test('7. Privacy threshold masks small constituency participation counts below 5 to prevent re-identification', async () => {
    const mockPrisma: any = {
      demoParticipation: {
        count: async () => 12,
        groupBy: async (args: any) => {
          if (args.by.includes('electionId')) {
            return [{ electionId: 'LS-2029', _count: { id: 12 } }];
          }
          return [
            { constituencyType: 'PARLIAMENTARY', parliamentaryConstituencyId: 'PC-LARGE', assemblyConstituencyId: null, _count: { id: 9 } },
            { constituencyType: 'PARLIAMENTARY', parliamentaryConstituencyId: 'PC-SMALL', assemblyConstituencyId: null, _count: { id: 3 } },
          ];
        },
        findMany: async () => [],
      },
      voterProfile: {
        count: async () => 50,
      },
      election: {
        findMany: async () => [{ id: 'LS-2029', name: 'General Elections 2029', type: 'LOK_SABHA' }],
      },
      parliamentaryConstituency: {
        findMany: async () => [
          { id: 'PC-LARGE', name: 'Large PC', stateId: 'WB' },
          { id: 'PC-SMALL', name: 'Small PC', stateId: 'WB' },
        ],
      },
      assemblyConstituency: {
        findMany: async () => [],
      },
    };

    const service = new AnalyticsService(mockPrisma);
    const result = await service.getParticipationAnalytics(superAdmin);

    const large = result.data.participationByConstituency.find((c) => c.constituencyId === 'PC-LARGE')!;
    const small = result.data.participationByConstituency.find((c) => c.constituencyId === 'PC-SMALL')!;

    assert.equal(large.participatedCount, 9);
    assert.equal(large.suppressedDueToPrivacyThreshold, false);

    assert.equal(small.participatedCount, 0); // Masked to 0
    assert.equal(small.suppressedDueToPrivacyThreshold, true); // Flagged for UI masking "< 5"
  });

  test('8. Independent Synthetic Counting Analytics computes seat distributions from certified sessions only', async () => {
    const mockPrisma: any = {
      countingSession: {
        findMany: async () => [
          {
            id: 'SESS-001',
            electionId: 'LS-2029',
            status: 'PUBLISHED',
            isPublished: true,
            totalCountedVotes: 900000,
            notaVotes: 10000,
            rejectedVotes: 2000,
            winnerCandidateId: 'CAND-01',
            victoryMargin: 25000,
            publishedAt: new Date('2026-06-05T12:00:00Z'),
            winnerCandidate: {
              id: 'CAND-01',
              fullName: 'Candidate One',
              nominations: [{ party: { id: 'PARTY-BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP' } }],
            },
            parliamentaryConstituency: { id: 'PC-01', name: 'Kolkata South' },
            assemblyConstituency: null,
            tallies: [
              { candidateId: 'CAND-01', votes: 450000, party: { id: 'PARTY-BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP' } },
              { candidateId: 'CAND-02', votes: 425000, party: { id: 'PARTY-INC', name: 'Indian National Congress', abbreviation: 'INC' } },
            ],
            tieResolution: null,
          },
        ],
      },
    };

    const service = new AnalyticsService(mockPrisma);
    const result = await service.getCountingAnalytics(superAdmin);

    assert.equal(result.data.totalCountingSessions, 1);
    assert.equal(result.data.publishedSessionsCount, 1);
    assert.equal(result.data.totalSimulatedVotesCounted, 900000);
    assert.equal(result.data.partyWiseSeatDistribution[0]!.seatsWon, 1);
    assert.equal(result.data.partyWiseSeatDistribution[0]!.partyCode, 'BJP');
    assert.equal(result.data.publishedWinners[0]!.winnerCandidateName, 'Candidate One');
    assert.equal(result.data.classification, 'SYNTHETIC_DEMO_COUNTING_INDEPENDENT');
  });

  test('9. Safe scope-keyed caching provides aggregate speedups and invalidates cleanly', async () => {
    let queryCount = 0;
    const mockPrisma: any = {
      election: {
        findMany: async () => {
          queryCount++;
          return [{ id: 'LS-2029', type: 'LOK_SABHA', status: 'POLLING_ACTIVE', configReviewStatus: 'APPROVED', stateId: null }];
        },
      },
      electionConstituency: {
        findMany: async () => [{ constituencyType: 'PARLIAMENTARY', parliamentaryConstituencyId: 'PC-01', assemblyConstituencyId: null }],
      },
      state: {
        findMany: async () => [{ id: 'WB', name: 'West Bengal', code: 'WB' }],
      },
      countingSession: {
        count: async () => 1,
      },
    };

    const service = new AnalyticsService(mockPrisma);

    // Call 1: Misses cache and queries DB
    await service.getNationalOverview(superAdmin);
    assert.equal(queryCount, 1);

    // Call 2: Hits in-memory cache, queryCount remains 1
    await service.getNationalOverview(superAdmin);
    assert.equal(queryCount, 1);

    // Clear cache
    service.clearCache();

    // Call 3: Queries DB again
    await service.getNationalOverview(superAdmin);
    assert.equal(queryCount, 2);
  });
});
