/**
 * OVS Phase 8.15 — Comprehensive Synthetic Demo Dataset Seed
 *
 * Extends the existing seed architecture with:
 *  - Representative multi-state data (West Bengal, Maharashtra, Delhi)
 *  - Deterministic 5-role administrator credentials
 *  - Multi-jurisdiction demo voter profiles
 *  - Simulated tie resolution records
 *  - System settings & feature flags
 *  - Strictly zero voter candidate-choice data
 */

import {
  PrismaClient,
  ConstituencyType,
  MetadataSource,
  AdminRole,
  AdminStatus,
  SettingCategory,
  SettingValueType,
} from '@prisma/client';
import {
  seedDatabase,
  seedDemoVotingScenarios,
  seedDemoCountingScenarios,
  seedNotificationsAndAnnouncements,
} from './seed.js';
import { PasswordService } from '../src/modules/admin/password.service.js';

const defaultPrisma = new PrismaClient();

export interface DemoDatasetInventory {
  statesCount: number;
  districtsCount: number;
  parliamentaryCount: number;
  assemblyCount: number;
  partiesCount: number;
  candidatesCount: number;
  electionsCount: number;
  electionConstituenciesCount: number;
  nominationsCount: number;
  scheduleMilestonesCount: number;
  demoVotersCount: number;
  demoParticipationsCount: number;
  countingSessionsCount: number;
  tieResolutionsCount: number;
  adminUsersCount: number;
  systemSettingsCount: number;
  featureFlagsCount: number;
}

export async function seedDemoDataset(
  client: PrismaClient = defaultPrisma
): Promise<DemoDatasetInventory> {
  const passwordService = new PasswordService();
  const demoAdminPassword = 'DemoAdmin@2029!';
  const demoAdminPasswordHash = await passwordService.hashPassword(demoAdminPassword);

  // 1. Run base foundational seeds
  await seedDatabase(client);
  await seedDemoVotingScenarios(client);
  await seedDemoCountingScenarios(client);
  await seedNotificationsAndAnnouncements(client);

  // 2. Seed multi-role administrators covering all RBAC scopes
  const demoAdmins = [
    {
      userId: '77777777-7777-4777-8777-777777770001',
      adminId: '77777777-7777-4777-8777-777777771001',
      officerCode: 'ECI-SUPER-DEMO',
      email: 'superadmin.demo@eci.gov.in',
      fullName: 'Chief Election Commissioner (DEMO_SAMPLE)',
      designation: 'Chief Election Commissioner',
      role: AdminRole.SUPER_ADMIN,
      assignedStateId: null,
    },
    {
      userId: '77777777-7777-4777-8777-777777770002',
      adminId: '77777777-7777-4777-8777-777777771002',
      officerCode: 'ECI-NAT-DEMO',
      email: 'nationaladmin.demo@eci.gov.in',
      fullName: 'National Election Director (DEMO_SAMPLE)',
      designation: 'National Election Director',
      role: AdminRole.NATIONAL_ADMIN,
      assignedStateId: null,
    },
    {
      userId: '77777777-7777-4777-8777-777777770003',
      adminId: '77777777-7777-4777-8777-777777771003',
      officerCode: 'ECI-WB-DEMO',
      email: 'stateadmin.wb.demo@eci.gov.in',
      fullName: 'Chief Electoral Officer West Bengal (DEMO_SAMPLE)',
      designation: 'CEO West Bengal',
      role: AdminRole.STATE_ADMIN,
      assignedStateId: 'WB',
    },
    {
      userId: '77777777-7777-4777-8777-777777770004',
      adminId: '77777777-7777-4777-8777-777777771004',
      officerCode: 'ECI-MH-DEMO',
      email: 'stateadmin.mh.demo@eci.gov.in',
      fullName: 'Chief Electoral Officer Maharashtra (DEMO_SAMPLE)',
      designation: 'CEO Maharashtra',
      role: AdminRole.STATE_ADMIN,
      assignedStateId: 'MH',
    },
    {
      userId: '77777777-7777-4777-8777-777777770005',
      adminId: '77777777-7777-4777-8777-777777771005',
      officerCode: 'ECI-EO-WB-DEMO',
      email: 'ro.krishnanagar.demo@eci.gov.in',
      fullName: 'Returning Officer Krishnanagar (DEMO_SAMPLE)',
      designation: 'Returning Officer',
      role: AdminRole.ELECTION_OFFICER,
      assignedStateId: 'WB',
    },
    {
      userId: '77777777-7777-4777-8777-777777770006',
      adminId: '77777777-7777-4777-8777-777777771006',
      officerCode: 'ECI-AUDITOR-DEMO',
      email: 'auditor.demo@eci.gov.in',
      fullName: 'Senior Compliance Auditor (DEMO_SAMPLE)',
      designation: 'Independent Election Auditor',
      role: AdminRole.READ_ONLY_AUDITOR,
      assignedStateId: null,
    },
  ];

  for (const adm of demoAdmins) {
    await client.user.upsert({
      where: { identifier: adm.officerCode },
      update: {
        passwordHash: demoAdminPasswordHash,
        isActive: true,
      },
      create: {
        id: adm.userId,
        userType: 'ADMIN',
        identifier: adm.officerCode,
        passwordHash: demoAdminPasswordHash,
        isActive: true,
      },
    });

    await client.adminUser.upsert({
      where: { officerCode: adm.officerCode },
      update: {
        email: adm.email,
        fullName: adm.fullName,
        designation: adm.designation,
        role: adm.role,
        assignedStateId: adm.assignedStateId,
        status: AdminStatus.ACTIVE,
        isActive: true,
      },
      create: {
        id: adm.adminId,
        userId: adm.userId,
        officerCode: adm.officerCode,
        email: adm.email,
        fullName: adm.fullName,
        designation: adm.designation,
        role: adm.role,
        assignedStateId: adm.assignedStateId,
        status: AdminStatus.ACTIVE,
        isActive: true,
      },
    });
  }

  // 3. Seed additional demo voters for Maharashtra & Delhi
  const regionalVoters = [
    {
      userId: '88888888-8888-4888-8888-888888880003',
      voterId: '88888888-8888-4888-8888-888888881003',
      epicNumber: 'DEMO-EPIC-8803',
      fullName: 'Rohan Deshmukh (DEMO_SAMPLE)',
      email: 'rohan.deshmukh@ovs-demo.local',
      mobile: '9800008803',
      stateId: 'MH',
      districtId: 'MH-DIST-MUMBAI-SUBURBAN',
      parliamentaryConstituencyId: 'MH-PC-MUMBAI-NORTH-CENTRAL',
      assemblyConstituencyId: 'MH-AC-BANDRA-WEST',
    },
    {
      userId: '88888888-8888-4888-8888-888888880004',
      voterId: '88888888-8888-4888-8888-888888881004',
      epicNumber: 'DEMO-EPIC-8804',
      fullName: 'Priya Sharma (DEMO_SAMPLE)',
      email: 'priya.sharma@ovs-demo.local',
      mobile: '9800008804',
      stateId: 'DL',
      districtId: 'DL-DIST-NEW-DELHI',
      parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
      assemblyConstituencyId: 'DL-AC-NEW-DELHI',
    },
  ];

  for (const v of regionalVoters) {
    await client.user.upsert({
      where: { identifier: v.epicNumber },
      update: {},
      create: {
        id: v.userId,
        userType: 'VOTER',
        identifier: v.epicNumber,
        passwordHash: '$scrypt$demo_placeholder_hash_not_for_prod',
        isActive: true,
      },
    });

    await client.voterProfile.upsert({
      where: { epicNumber: v.epicNumber },
      update: {},
      create: {
        id: v.voterId,
        userId: v.userId,
        epicNumber: v.epicNumber,
        fullName: v.fullName,
        dateOfBirth: new Date('1992-08-20'),
        gender: 'Female',
        mobile: v.mobile,
        email: v.email,
        address: 'Demo Electoral Ward, Urban Sector (DEMO_SAMPLE)',
        pinCode: '400050',
        stateId: v.stateId,
        districtId: v.districtId,
        parliamentaryConstituencyId: v.parliamentaryConstituencyId,
        assemblyConstituencyId: v.assemblyConstituencyId,
        isVerified: true,
        metadataSource: MetadataSource.DEMO_SAMPLE,
      },
    });
  }

  // 4. Seed simulated Tie Resolution for New Delhi PC
  const tieSessionId = 'RESULT-LS-2029-DL-PC-NEW-DELHI';
  const superAdmin = await client.adminUser.findUnique({
    where: { officerCode: 'ECI-SUPER-DEMO' },
  });

  if (superAdmin) {
    const existingTie = await client.tieResolution.findUnique({
      where: { sessionId: tieSessionId },
    });

    if (!existingTie) {
      await client.tieResolution.create({
        data: {
          sessionId: tieSessionId,
          decision: 'WINNER_SELECTED_BY_LOTTERY',
          selectedWinnerId: 'CAND-LS29-DL-ND-1',
          resolutionMethod: 'LOTTERY_DRAW',
          justificationNote:
            'Equal tally (4800 votes each) resolved via scheduled transparent lottery draw witnessed by counting observers (DEMO_SAMPLE).',
          approvedByAdminId: superAdmin.id,
        },
      });

      // Advance session status to RESULT_READY_FOR_REVIEW
      await client.countingSession.update({
        where: { id: tieSessionId },
        data: {
          winnerCandidateId: 'CAND-LS29-DL-ND-1',
          runnerUpCandidateId: 'CAND-LS29-DL-ND-2',
          victoryMargin: 1, // Nominal victory assigned per statutory tie-break
          status: 'RESULT_READY_FOR_REVIEW',
        },
      });
    }
  }

  // 5. Seed Core System Settings & Feature Flags
  const systemSettings = [
    {
      key: 'PLATFORM_MAINTENANCE_MODE',
      category: SettingCategory.PLATFORM,
      valueType: SettingValueType.BOOLEAN,
      value: 'false',
      defaultValue: 'false',
      description: 'Global maintenance mode intercepting non-admin requests.',
      isPublic: true,
      isEditable: true,
    },
    {
      key: 'VOTER_REGISTRATION_ENABLED',
      category: SettingCategory.ELECTION_OPERATIONS,
      valueType: SettingValueType.BOOLEAN,
      value: 'true',
      defaultValue: 'true',
      description: 'Controls whether public demo voter registration is open.',
      isPublic: true,
      isEditable: true,
    },
    {
      key: 'DEMO_COUNTING_ENABLED',
      category: SettingCategory.ELECTION_OPERATIONS,
      valueType: SettingValueType.BOOLEAN,
      value: 'true',
      defaultValue: 'true',
      description: 'Controls whether synthetic demo counting engines may execute.',
      isPublic: false,
      isEditable: true,
    },
  ];

  for (const s of systemSettings) {
    await client.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  const featureFlags = [
    {
      key: 'FEATURE_FLAG_ANALYTICS_CSV_EXPORT',
      description: 'Enables sanitized RFC 4180 CSV export for election analytics.',
      isEnabled: true,
      rolloutPercentage: 100,
      targetRoles: ['SUPER_ADMIN', 'NATIONAL_ADMIN', 'STATE_ADMIN', 'READ_ONLY_AUDITOR'],
    },
    {
      key: 'FEATURE_FLAG_MULTI_LANGUAGE_SUPPORT',
      description: 'Enables dynamic multilingual translation switcher for official languages.',
      isEnabled: false,
      rolloutPercentage: 0,
      targetRoles: ['SUPER_ADMIN'],
    },
  ];

  for (const f of featureFlags) {
    await client.featureFlag.upsert({
      where: { key: f.key },
      update: {},
      create: f,
    });
  }

  return {
    statesCount: await client.state.count(),
    districtsCount: await client.district.count(),
    parliamentaryCount: await client.parliamentaryConstituency.count(),
    assemblyCount: await client.assemblyConstituency.count(),
    partiesCount: await client.politicalParty.count(),
    candidatesCount: await client.candidate.count(),
    electionsCount: await client.election.count(),
    electionConstituenciesCount: await client.electionConstituency.count(),
    nominationsCount: await client.candidateNomination.count(),
    scheduleMilestonesCount: await client.electionScheduleMilestone.count(),
    demoVotersCount: await client.voterProfile.count(),
    demoParticipationsCount: await client.demoParticipation.count(),
    countingSessionsCount: await client.countingSession.count(),
    tieResolutionsCount: await client.tieResolution.count(),
    adminUsersCount: await client.adminUser.count(),
    systemSettingsCount: await client.systemSetting.count(),
    featureFlagsCount: await client.featureFlag.count(),
  };
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('seed-demo.ts') || process.argv[1].endsWith('seed-demo.js'));

if (isMain) {
  seedDemoDataset(defaultPrisma)
    .then(async (inventory) => {
      console.log(
        'OVS Phase 8.15 DEMO_SAMPLE comprehensive dataset seed completed successfully:\n',
        JSON.stringify(inventory, null, 2)
      );
      await defaultPrisma.$disconnect();
    })
    .catch(async (err) => {
      console.error('Failed to seed OVS demo dataset:', err);
      await defaultPrisma.$disconnect();
      process.exit(1);
    });
}
