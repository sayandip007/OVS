/**
 * OVS Phase 8.15.1 — Comprehensive Synthetic Demo Dataset Seed (Hardened)
 *
 * Requirements:
 *  - Explicit refusal to run when NODE_ENV=production or staging.
 *  - Require OVS_ALLOW_DEMO_SEED=true before seeding.
 *  - Validate that target database is a clearly designated development/demo/test database.
 *  - Fail closed if database identity cannot be verified.
 *  - Never allow a demo seed to overwrite an existing non-demo administrator.
 *  - Never reset an existing administrator's password to a shared demo password.
 *  - Keep demo account provisioning isolated from production bootstrap provisioning.
 *  - Make repeated seeding idempotent.
 *  - Use reserved .invalid or .local demo email domains, NOT @eci.gov.in.
 *  - Use clearly fictional administrator identities.
 *  - Clearly mark every synthetic record as DEMO_SAMPLE.
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

export function assertSafeDemoEnvironment(
  databaseUrl?: string | null,
  nodeEnv?: string | null,
  allowDemoSeed?: string | null
): void {
  const env = nodeEnv !== undefined ? nodeEnv : process.env.NODE_ENV;
  const allow = allowDemoSeed !== undefined ? allowDemoSeed : process.env.OVS_ALLOW_DEMO_SEED;
  const dbUrl = databaseUrl !== undefined ? databaseUrl : process.env.DATABASE_URL;

  if (env === 'production') {
    throw new Error(
      'FAIL-CLOSED DEMO SEED GUARD: Refusing to seed demo dataset while NODE_ENV=production.'
    );
  }
  if (env === 'staging') {
    throw new Error(
      'FAIL-CLOSED DEMO SEED GUARD: Refusing to seed demo dataset while NODE_ENV=staging.'
    );
  }
  if (allow !== 'true') {
    throw new Error(
      'FAIL-CLOSED DEMO SEED GUARD: OVS_ALLOW_DEMO_SEED must be explicitly set to "true" to run demo dataset seed.'
    );
  }
  if (!dbUrl) {
    throw new Error(
      'FAIL-CLOSED DEMO SEED GUARD: DATABASE_URL is undefined. Cannot verify safe demo database.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error(
      'FAIL-CLOSED DEMO SEED GUARD: DATABASE_URL is not a valid URL.'
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();

  const isLocalOrContainerHost = [
    'localhost',
    '127.0.0.1',
    '::1',
    'postgres',
    'postgres-db',
    'ovs-postgres',
  ].includes(hostname);

  const isSafeDatabaseName =
    dbName.includes('test') ||
    dbName.includes('dev') ||
    dbName.includes('demo') ||
    dbName === 'ovs_db' ||
    dbName === 'ovs_development' ||
    dbName === 'ovs_demo' ||
    dbName === 'ovs_ci_test';

  if (!isLocalOrContainerHost || !isSafeDatabaseName) {
    throw new Error(
      `FAIL-CLOSED DEMO SEED GUARD: Refusing demo seed on unverified database target '${hostname}/${dbName}'. Target must be a designated development/demo/test database.`
    );
  }
}

export interface SeedDemoDatasetOptions {
  skipEnvCheck?: boolean;
}

export async function provisionDemoAdministrators(
  client: any,
  demoAdminPasswordHash: string
): Promise<void> {
  // Seed multi-role administrators using strictly fictional personas and .invalid email domain
  const demoAdmins = [
    {
      userId: '77777777-7777-4777-8777-777777770001',
      adminId: '77777777-7777-4777-8777-777777771001',
      officerCode: 'ECI-SUPER-DEMO',
      email: 'superadmin.demo@ovs-demo.invalid',
      fullName: 'Dev Super Administrator (DEMO_SAMPLE)',
      designation: 'Chief Election Commissioner (Fictional Demo)',
      role: AdminRole.SUPER_ADMIN,
      assignedStateId: null,
    },
    {
      userId: '77777777-7777-4777-8777-777777770002',
      adminId: '77777777-7777-4777-8777-777777771002',
      officerCode: 'ECI-NAT-DEMO',
      email: 'nationaladmin.demo@ovs-demo.invalid',
      fullName: 'Dev National Administrator (DEMO_SAMPLE)',
      designation: 'National Election Director (Fictional Demo)',
      role: AdminRole.NATIONAL_ADMIN,
      assignedStateId: null,
    },
    {
      userId: '77777777-7777-4777-8777-777777770003',
      adminId: '77777777-7777-4777-8777-777777771003',
      officerCode: 'ECI-WB-DEMO',
      email: 'stateadmin.wb.demo@ovs-demo.invalid',
      fullName: 'Dev State Administrator WB (DEMO_SAMPLE)',
      designation: 'CEO West Bengal (Fictional Demo)',
      role: AdminRole.STATE_ADMIN,
      assignedStateId: 'WB',
    },
    {
      userId: '77777777-7777-4777-8777-777777770004',
      adminId: '77777777-7777-4777-8777-777777771004',
      officerCode: 'ECI-MH-DEMO',
      email: 'stateadmin.mh.demo@ovs-demo.invalid',
      fullName: 'Dev State Administrator MH (DEMO_SAMPLE)',
      designation: 'CEO Maharashtra (Fictional Demo)',
      role: AdminRole.STATE_ADMIN,
      assignedStateId: 'MH',
    },
    {
      userId: '77777777-7777-4777-8777-777777770005',
      adminId: '77777777-7777-4777-8777-777777771005',
      officerCode: 'ECI-EO-WB-DEMO',
      email: 'ro.krishnanagar.demo@ovs-demo.invalid',
      fullName: 'Dev Returning Officer Krishnanagar (DEMO_SAMPLE)',
      designation: 'Returning Officer (Fictional Demo)',
      role: AdminRole.ELECTION_OFFICER,
      assignedStateId: 'WB',
    },
    {
      userId: '77777777-7777-4777-8777-777777770006',
      adminId: '77777777-7777-4777-8777-777777771006',
      officerCode: 'ECI-AUDITOR-DEMO',
      email: 'auditor.demo@ovs-demo.invalid',
      fullName: 'Dev Compliance Auditor (DEMO_SAMPLE)',
      designation: 'Compliance Auditor (Fictional Demo)',
      role: AdminRole.READ_ONLY_AUDITOR,
      assignedStateId: null,
    },
  ];

  for (const adm of demoAdmins) {
    // Check if an admin with this officer code or email already exists
    const existingAdminByCode = await client.adminUser.findUnique({
      where: { officerCode: adm.officerCode },
      include: { user: true },
    });
    const existingAdminByEmail = await client.adminUser.findUnique({
      where: { email: adm.email },
      include: { user: true },
    });

    // Guard: Never overwrite an existing non-demo administrator
    if (existingAdminByCode && existingAdminByCode.id !== adm.adminId) {
      throw new Error(
        `FAIL-CLOSED DEMO SEED GUARD: Found existing non-demo administrator with officerCode '${adm.officerCode}'. Refusing to overwrite.`
      );
    }
    if (existingAdminByEmail && existingAdminByEmail.id !== adm.adminId) {
      throw new Error(
        `FAIL-CLOSED DEMO SEED GUARD: Found existing non-demo administrator with email '${adm.email}'. Refusing to overwrite.`
      );
    }

    const existingUser = await client.user.findUnique({
      where: { identifier: adm.officerCode },
    });

    if (!existingUser) {
      // Fresh demo provisioning
      await client.user.create({
        data: {
          id: adm.userId,
          userType: 'ADMIN',
          identifier: adm.officerCode,
          passwordHash: demoAdminPasswordHash,
          isActive: true,
        },
      });
    } else {
      // Idempotent update: NEVER reset password hash of existing administrator
      await client.user.update({
        where: { id: existingUser.id },
        data: {
          isActive: true,
        },
      });
    }

    if (!existingAdminByCode) {
      await client.adminUser.create({
        data: {
          id: adm.adminId,
          userId: existingUser?.id ?? adm.userId,
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
    } else {
      await client.adminUser.update({
        where: { id: existingAdminByCode.id },
        data: {
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
  }
}

export async function seedDemoDataset(
  client: PrismaClient = defaultPrisma,
  options: SeedDemoDatasetOptions = {}
): Promise<DemoDatasetInventory> {
  if (!options.skipEnvCheck) {
    assertSafeDemoEnvironment();
  }

  const passwordService = new PasswordService();
  const demoAdminPassword = 'DemoAdmin@2029!';
  const demoAdminPasswordHash = await passwordService.hashPassword(demoAdminPassword);

  // 1. Run base foundational seeds
  await seedDatabase(client);
  await seedDemoVotingScenarios(client);
  await seedDemoCountingScenarios(client);
  await seedNotificationsAndAnnouncements(client);

  // 2. Seed multi-role administrators
  await provisionDemoAdministrators(client, demoAdminPasswordHash);

  // 3. Seed additional demo voters for Maharashtra & Delhi (strictly unverified / DEMO_SAMPLE)
  const regionalVoters = [
    {
      userId: '88888888-8888-4888-8888-888888880003',
      voterId: '88888888-8888-4888-8888-888888881003',
      epicNumber: 'DEMO-EPIC-8803',
      fullName: 'Rohan Deshmukh (DEMO_SAMPLE)',
      email: 'rohan.deshmukh@ovs-demo.invalid',
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
      email: 'priya.sharma@ovs-demo.invalid',
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
        isVerified: false, // Synthetic demo voters must not be presented as officially verified voters
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
        'OVS Phase 8.15.1 DEMO_SAMPLE comprehensive dataset seed completed successfully:\n',
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
