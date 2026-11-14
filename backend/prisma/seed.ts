import {
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementStatus,
  CandidateNominationStatus,
  ConfigurationReviewStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
  JurisdictionType,
  MetadataSource,
  NotificationType,
  PartyStatus,
  PartyType,
  PrismaClient,
  ReservationType,
  ScheduleMilestoneStatus,
  ScheduleMilestoneType,
} from '@prisma/client';

const defaultPrisma = new PrismaClient();

export interface SeedSummary {
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
}

export async function seedDatabase(
  client: PrismaClient = defaultPrisma
): Promise<SeedSummary> {
  // 1. Seed 3 States/UTs (WB, MH, DL) marked DEMO_SAMPLE
  const statesData = [
    {
      id: 'WB',
      name: 'West Bengal',
      type: JurisdictionType.STATE,
      capital: 'Kolkata',
      officialLanguages: ['Bengali', 'English'],
      totalLokSabhaSeats: 42,
      totalAssemblySeats: 294,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'MH',
      name: 'Maharashtra',
      type: JurisdictionType.STATE,
      capital: 'Mumbai',
      officialLanguages: ['Marathi'],
      totalLokSabhaSeats: 48,
      totalAssemblySeats: 288,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'DL',
      name: 'NCT of Delhi',
      type: JurisdictionType.UNION_TERRITORY,
      capital: 'New Delhi',
      officialLanguages: ['Hindi', 'English'],
      totalLokSabhaSeats: 7,
      totalAssemblySeats: 70,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
  ];

  for (const state of statesData) {
    await client.state.upsert({
      where: { id: state.id },
      update: state,
      create: state,
    });
  }

  // 2. Seed 6 Districts across WB, MH, DL
  const districtsData = [
    {
      id: 'NADIA',
      stateId: 'WB',
      name: 'Nadia',
      headquarters: 'Krishnanagar',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'WB-DIST-KOLKATA',
      stateId: 'WB',
      name: 'Kolkata',
      headquarters: 'Kolkata',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'MH-DIST-MUMBAI-SUBURBAN',
      stateId: 'MH',
      name: 'Mumbai Suburban',
      headquarters: 'Bandra',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'MH-DIST-PUNE',
      stateId: 'MH',
      name: 'Pune',
      headquarters: 'Pune',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'DL-DIST-NEW-DELHI',
      stateId: 'DL',
      name: 'New Delhi',
      headquarters: 'Connaught Place',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'DL-DIST-SOUTH-DELHI',
      stateId: 'DL',
      name: 'South Delhi',
      headquarters: 'Saket',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
  ];

  for (const district of districtsData) {
    await client.district.upsert({
      where: { id: district.id },
      update: district,
      create: district,
    });
  }

  // 3. Seed 6 Parliamentary Constituencies
  const pcsData = [
    {
      id: 'WB-PC-KRISHNANAGAR',
      stateId: 'WB',
      constituencyNumber: 12,
      name: 'Krishnanagar',
      reservationType: ReservationType.GENERAL,
      totalVoters: 1754200,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'WB-PC-KOLKATA-DAKSHIN',
      stateId: 'WB',
      constituencyNumber: 23,
      name: 'Kolkata Dakshin',
      reservationType: ReservationType.GENERAL,
      totalVoters: 1812500,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'MH-PC-MUMBAI-NORTH-CENTRAL',
      stateId: 'MH',
      constituencyNumber: 29,
      name: 'Mumbai North Central',
      reservationType: ReservationType.GENERAL,
      totalVoters: 1698400,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'MH-PC-PUNE',
      stateId: 'MH',
      constituencyNumber: 34,
      name: 'Pune',
      reservationType: ReservationType.GENERAL,
      totalVoters: 2045100,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'DL-PC-NEW-DELHI',
      stateId: 'DL',
      constituencyNumber: 4,
      name: 'New Delhi',
      reservationType: ReservationType.GENERAL,
      totalVoters: 1520300,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'DL-PC-SOUTH-DELHI',
      stateId: 'DL',
      constituencyNumber: 7,
      name: 'South Delhi',
      reservationType: ReservationType.SC,
      totalVoters: 1984600,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
  ];

  for (const pc of pcsData) {
    await client.parliamentaryConstituency.upsert({
      where: { id: pc.id },
      update: pc,
      create: pc,
    });
  }

  // 4. Seed 8 Assembly Constituencies (strictly respecting composite FK hierarchy)
  const acsData = [
    {
      id: 'WB-AC-KRISHNANAGAR-UTTAR',
      stateId: 'WB',
      districtId: 'NADIA',
      parentParliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      constituencyNumber: 83,
      name: 'Krishnanagar Uttar',
      reservationType: ReservationType.GENERAL,
      totalVoters: 248500,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'WB-AC-KRISHNANAGAR-DAKSHIN',
      stateId: 'WB',
      districtId: 'NADIA',
      parentParliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      constituencyNumber: 85,
      name: 'Krishnanagar Dakshin',
      reservationType: ReservationType.GENERAL,
      totalVoters: 239100,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'WB-AC-BHABANIPUR',
      stateId: 'WB',
      districtId: 'WB-DIST-KOLKATA',
      parentParliamentaryConstituencyId: 'WB-PC-KOLKATA-DAKSHIN',
      constituencyNumber: 159,
      name: 'Bhabanipur',
      reservationType: ReservationType.GENERAL,
      totalVoters: 215400,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'WB-AC-RASHBEHARI',
      stateId: 'WB',
      districtId: 'WB-DIST-KOLKATA',
      parentParliamentaryConstituencyId: 'WB-PC-KOLKATA-DAKSHIN',
      constituencyNumber: 160,
      name: 'Rashbehari',
      reservationType: ReservationType.GENERAL,
      totalVoters: 211800,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'MH-AC-BANDRA-WEST',
      stateId: 'MH',
      districtId: 'MH-DIST-MUMBAI-SUBURBAN',
      parentParliamentaryConstituencyId: 'MH-PC-MUMBAI-NORTH-CENTRAL',
      constituencyNumber: 177,
      name: 'Bandra West',
      reservationType: ReservationType.GENERAL,
      totalVoters: 294600,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'MH-AC-KOTHRUD',
      stateId: 'MH',
      districtId: 'MH-DIST-PUNE',
      parentParliamentaryConstituencyId: 'MH-PC-PUNE',
      constituencyNumber: 210,
      name: 'Kothrud',
      reservationType: ReservationType.GENERAL,
      totalVoters: 382900,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'DL-AC-NEW-DELHI',
      stateId: 'DL',
      districtId: 'DL-DIST-NEW-DELHI',
      parentParliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
      constituencyNumber: 40,
      name: 'New Delhi',
      reservationType: ReservationType.GENERAL,
      totalVoters: 149200,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'DL-AC-MALVIYA-NAGAR',
      stateId: 'DL',
      districtId: 'DL-DIST-SOUTH-DELHI',
      parentParliamentaryConstituencyId: 'DL-PC-SOUTH-DELHI',
      constituencyNumber: 43,
      name: 'Malviya Nagar',
      reservationType: ReservationType.GENERAL,
      totalVoters: 158400,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
  ];

  for (const ac of acsData) {
    await client.assemblyConstituency.upsert({
      where: { id: ac.id },
      update: ac,
      create: ac,
    });
  }

  // 5. Seed 5 Political Parties
  const partiesData = [
    {
      id: 'PARTY-BJP',
      name: 'Bharatiya Janata Party (DEMO_SAMPLE)',
      abbreviation: 'BJP',
      partyType: PartyType.NATIONAL,
      symbolName: 'Lotus',
      symbolUrl: '/assets/symbols/bjp-lotus.svg',
      establishedYear: 1980,
      headquarters: 'New Delhi',
      status: PartyStatus.ACTIVE,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'PARTY-INC',
      name: 'Indian National Congress (DEMO_SAMPLE)',
      abbreviation: 'INC',
      partyType: PartyType.NATIONAL,
      symbolName: 'Hand',
      symbolUrl: '/assets/symbols/inc-hand.svg',
      establishedYear: 1885,
      headquarters: 'New Delhi',
      status: PartyStatus.ACTIVE,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'PARTY-AAP',
      name: 'Aam Aadmi Party (DEMO_SAMPLE)',
      abbreviation: 'AAP',
      partyType: PartyType.NATIONAL,
      symbolName: 'Broom',
      symbolUrl: '/assets/symbols/aap-broom.svg',
      establishedYear: 2012,
      headquarters: 'New Delhi',
      status: PartyStatus.ACTIVE,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'PARTY-AITC',
      name: 'All India Trinamool Congress (DEMO_SAMPLE)',
      abbreviation: 'AITC',
      partyType: PartyType.STATE,
      symbolName: 'Flowers and Grass',
      symbolUrl: '/assets/symbols/aitc-flowers.svg',
      establishedYear: 1998,
      headquarters: 'Kolkata',
      status: PartyStatus.ACTIVE,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'PARTY-IND',
      name: 'Independent (Unallotted Free Symbol Pool)',
      abbreviation: 'IND',
      partyType: PartyType.INDEPENDENT,
      symbolName: 'Free Symbol',
      symbolUrl: '/assets/symbols/ind-free.svg',
      establishedYear: 1950,
      headquarters: 'N/A',
      status: PartyStatus.ACTIVE,
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
  ];

  for (const party of partiesData) {
    await client.politicalParty.upsert({
      where: { id: party.id },
      update: {},
      create: party,
    });
  }

  // 6. Seed 9 Synthetic Candidates (DEMO_SAMPLE)
  const candidatesData = [
    {
      id: 'CAND-LS29-WB-KRN-1',
      partyId: 'PARTY-AITC',
      fullName: 'Ananya Sen (DEMO_SAMPLE)',
      age: 48,
      gender: 'Female',
      education: 'M.A. Economics, University of Calcutta',
      profession: 'Public Policy Researcher',
      criminalCases: 0,
      assetsDeclared: BigInt(18500000),
      liabilitiesDeclared: BigInt(1200000),
      bio: 'Synthetic DEMO_SAMPLE parliamentary candidate for Krishnanagar.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-LS29-WB-KRN-2',
      partyId: 'PARTY-BJP',
      fullName: 'Debabrata Roy (DEMO_SAMPLE)',
      age: 53,
      gender: 'Male',
      education: 'LL.B., Calcutta University',
      profession: 'Senior Advocate',
      criminalCases: 0,
      assetsDeclared: BigInt(24200000),
      liabilitiesDeclared: BigInt(2100000),
      bio: 'Synthetic DEMO_SAMPLE parliamentary candidate for Krishnanagar.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-LS29-WB-KRN-3',
      partyId: 'PARTY-INC',
      fullName: 'Farhan Ahmed (DEMO_SAMPLE)',
      age: 44,
      gender: 'Male',
      education: 'M.Sc. Agricultural Science',
      profession: 'Agronomist & Educator',
      criminalCases: 0,
      assetsDeclared: BigInt(9800000),
      liabilitiesDeclared: BigInt(450000),
      bio: 'Synthetic DEMO_SAMPLE parliamentary candidate for Krishnanagar.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-LS29-WB-KRN-4',
      partyId: 'PARTY-IND',
      fullName: 'Subrata Mondal (DEMO_SAMPLE)',
      age: 39,
      gender: 'Male',
      education: 'B.Tech Civil Engineering',
      profession: 'Independent Civic Engineer',
      criminalCases: 0,
      assetsDeclared: BigInt(5400000),
      liabilitiesDeclared: BigInt(0),
      bio: 'Synthetic DEMO_SAMPLE independent candidate for Krishnanagar.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-LS29-MH-MNC-1',
      partyId: 'PARTY-BJP',
      fullName: 'Vikram Deshmukh (DEMO_SAMPLE)',
      age: 51,
      gender: 'Male',
      education: 'MBA Finance',
      profession: 'Urban Infrastructure Economist',
      criminalCases: 0,
      assetsDeclared: BigInt(41000000),
      liabilitiesDeclared: BigInt(3500000),
      bio: 'Synthetic DEMO_SAMPLE candidate for Mumbai North Central.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-LS29-DL-ND-1',
      partyId: 'PARTY-AAP',
      fullName: 'Meenakshi Kapoor (DEMO_SAMPLE)',
      age: 43,
      gender: 'Female',
      education: 'M.A. Social Work',
      profession: 'Education Reform Advocate',
      criminalCases: 0,
      assetsDeclared: BigInt(12500000),
      liabilitiesDeclared: BigInt(800000),
      bio: 'Synthetic DEMO_SAMPLE candidate for New Delhi PC.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-LS29-DL-ND-2',
      partyId: 'PARTY-BJP',
      fullName: 'Rajesh Khanna (DEMO_SAMPLE)',
      age: 50,
      gender: 'Male',
      education: 'LL.B.',
      profession: 'Advocate',
      criminalCases: 0,
      assetsDeclared: BigInt(19500000),
      liabilitiesDeclared: BigInt(1100000),
      bio: 'Synthetic DEMO_SAMPLE candidate for New Delhi PC (Tied Scenario).',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-WBA29-KRNU-1',
      partyId: 'PARTY-AITC',
      fullName: 'Rituparna Chatterjee (DEMO_SAMPLE)',
      age: 41,
      gender: 'Female',
      education: 'MBBS',
      profession: 'Community Physician',
      criminalCases: 0,
      assetsDeclared: BigInt(14200000),
      liabilitiesDeclared: BigInt(900000),
      bio: 'Synthetic DEMO_SAMPLE assembly candidate for Krishnanagar Uttar.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-WBA29-KRNU-2',
      partyId: 'PARTY-BJP',
      fullName: 'Arindam Ghosh (DEMO_SAMPLE)',
      age: 46,
      gender: 'Male',
      education: 'M.Com, University of Kalyani',
      profession: 'Chartered Accountant',
      criminalCases: 0,
      assetsDeclared: BigInt(16800000),
      liabilitiesDeclared: BigInt(1100000),
      bio: 'Synthetic DEMO_SAMPLE assembly candidate for Krishnanagar Uttar.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-WBA29-KRNU-3',
      partyId: 'PARTY-IND',
      fullName: 'Partha Pratim Das (DEMO_SAMPLE)',
      age: 37,
      gender: 'Male',
      education: 'B.Sc. Mathematics',
      profession: 'High School Teacher',
      criminalCases: 0,
      assetsDeclared: BigInt(3200000),
      liabilitiesDeclared: BigInt(0),
      bio: 'Synthetic DEMO_SAMPLE independent assembly candidate for Krishnanagar Uttar.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-MH29-BW-1',
      partyId: 'PARTY-INC',
      fullName: 'Siddharth Deshmukh (DEMO_SAMPLE)',
      age: 45,
      gender: 'Male',
      education: 'LL.B., Mumbai University',
      profession: 'Advocate',
      criminalCases: 0,
      assetsDeclared: BigInt(14200000),
      liabilitiesDeclared: BigInt(900000),
      bio: 'Synthetic DEMO_SAMPLE assembly candidate for Bandra West.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'CAND-DL29-ND-1',
      partyId: 'PARTY-AAP',
      fullName: 'Meera Krishnan (DEMO_SAMPLE)',
      age: 39,
      gender: 'Female',
      education: 'M.Tech, IIT Delhi',
      profession: 'Urban Planner',
      criminalCases: 0,
      assetsDeclared: BigInt(7800000),
      liabilitiesDeclared: BigInt(400000),
      bio: 'Synthetic DEMO_SAMPLE assembly candidate for New Delhi.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
  ];

  for (const candidate of candidatesData) {
    await client.candidate.upsert({
      where: { id: candidate.id },
      update: {},
      create: candidate,
    });
  }

  // 7. Seed 5 Synthetic DEMO_SAMPLE Elections (LS, WB, MH, DL Draft, WB Archived)
  // Note: `update: {}` ensures repeated seed runs never overwrite administrator modifications.
  const electionsData = [
    {
      id: 'LS-2029',
      name: 'Lok Sabha General Election 2029 (DEMO_SAMPLE)',
      type: ElectionType.LOK_SABHA,
      year: 2029,
      stateId: null,
      country: 'India',
      targetJurisdiction: 'National (All Parliamentary Constituencies)',
      status: ElectionStatus.POLLING_ACTIVE,
      registrationDeadline: new Date('2029-03-15'),
      nominationStartDate: new Date('2029-03-20'),
      nominationEndDate: new Date('2029-03-28'),
      scrutinyDate: new Date('2029-03-30'),
      withdrawalDeadline: new Date('2029-04-02'),
      campaignStartDate: new Date('2029-04-03'),
      campaignEndDate: new Date('2029-04-18'),
      pollingStartDate: new Date('2029-04-20'),
      pollingEndDate: new Date('2029-05-15'),
      countingDate: new Date('2029-05-20'),
      resultDate: new Date('2029-05-22'),
      simulationClockDate: new Date('2029-04-25'),
      demoSandboxMode: 'CONCURRENT_SIMULATION_SANDBOX',
      scheduleTimezone: 'Asia/Kolkata',
      configReviewStatus: ConfigurationReviewStatus.APPROVED,
      description:
        'Educational simulation of the 2029 General Election to the House of the People (Lok Sabha).',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'WB-ASSEMBLY-2029',
      name: 'West Bengal Legislative Assembly Election 2029 (DEMO_SAMPLE)',
      type: ElectionType.STATE_ASSEMBLY,
      year: 2029,
      stateId: 'WB',
      country: 'India',
      targetJurisdiction: 'West Bengal (WB)',
      status: ElectionStatus.POLLING_ACTIVE,
      registrationDeadline: new Date('2029-03-15'),
      nominationStartDate: new Date('2029-03-20'),
      nominationEndDate: new Date('2029-03-28'),
      scrutinyDate: new Date('2029-03-30'),
      withdrawalDeadline: new Date('2029-04-02'),
      campaignStartDate: new Date('2029-04-03'),
      campaignEndDate: new Date('2029-04-18'),
      pollingStartDate: new Date('2029-04-20'),
      pollingEndDate: new Date('2029-05-10'),
      countingDate: new Date('2029-05-20'),
      resultDate: new Date('2029-05-22'),
      simulationClockDate: new Date('2029-04-25'),
      demoSandboxMode: 'CONCURRENT_SIMULATION_SANDBOX',
      scheduleTimezone: 'Asia/Kolkata',
      configReviewStatus: ConfigurationReviewStatus.APPROVED,
      description:
        'Educational simulation of the 2029 West Bengal Vidhan Sabha General Election.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'MH-ASSEMBLY-2029',
      name: 'Maharashtra Legislative Assembly Election 2029 (DEMO_SAMPLE)',
      type: ElectionType.STATE_ASSEMBLY,
      year: 2029,
      stateId: 'MH',
      country: 'India',
      targetJurisdiction: 'Maharashtra (MH)',
      status: ElectionStatus.UPCOMING,
      pollingStartDate: new Date('2029-10-15'),
      pollingEndDate: new Date('2029-10-20'),
      countingDate: new Date('2029-10-24'),
      resultDate: new Date('2029-10-26'),
      demoSandboxMode: 'CONCURRENT_SIMULATION_SANDBOX',
      description:
        'Synthetic DEMO_SAMPLE Maharashtra Legislative Assembly Election for state-scoped administrative testing.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'DL-ASSEMBLY-2029',
      name: 'NCT of Delhi Legislative Assembly Election 2029 (DEMO_SAMPLE)',
      type: ElectionType.STATE_ASSEMBLY,
      year: 2029,
      stateId: 'DL',
      country: 'India',
      targetJurisdiction: 'NCT of Delhi (DL)',
      status: ElectionStatus.DRAFT,
      pollingStartDate: new Date('2029-11-10'),
      pollingEndDate: new Date('2029-11-10'),
      countingDate: new Date('2029-11-14'),
      resultDate: new Date('2029-11-16'),
      demoSandboxMode: 'CONCURRENT_SIMULATION_SANDBOX',
      scheduleTimezone: 'Asia/Kolkata',
      configReviewStatus: ConfigurationReviewStatus.DRAFT,
      description:
        'Synthetic DEMO_SAMPLE Delhi Assembly draft election (hidden from public portal until published).',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
    {
      id: 'WB-BYPOLL-2028-ARCHIVED',
      name: 'West Bengal Assembly Bye-Election 2028 (DEMO_SAMPLE Archived)',
      type: ElectionType.STATE_ASSEMBLY,
      year: 2028,
      stateId: 'WB',
      country: 'India',
      targetJurisdiction: 'West Bengal (WB)',
      status: ElectionStatus.ARCHIVED,
      pollingStartDate: new Date('2028-06-10'),
      pollingEndDate: new Date('2028-06-10'),
      countingDate: new Date('2028-06-14'),
      resultDate: new Date('2028-06-15'),
      archivedAt: new Date('2028-07-01T00:00:00.000Z'),
      archiveNote: 'Synthetic archived demo election preserved for lifecycle testing.',
      demoSandboxMode: 'CONCURRENT_SIMULATION_SANDBOX',
      description:
        'Synthetic DEMO_SAMPLE archived election record for historical preservation testing.',
      metadataSource: MetadataSource.DEMO_SAMPLE,
    },
  ];

  for (const election of electionsData) {
    await client.election.upsert({
      where: { id: election.id },
      update: {},
      create: election,
    });
  }

  // 8. Seed 10 ElectionConstituency mappings (6 PCs for LS-2029 + 4 WB ACs for WB-ASSEMBLY-2029)
  const electionConstituenciesData = [
    {
      id: '88888888-8888-4888-8888-888888888001',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      assemblyConstituencyId: null,
    },
    {
      id: '88888888-8888-4888-8888-888888888002',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'WB-PC-KOLKATA-DAKSHIN',
      assemblyConstituencyId: null,
    },
    {
      id: '88888888-8888-4888-8888-888888888003',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'MH-PC-MUMBAI-NORTH-CENTRAL',
      assemblyConstituencyId: null,
    },
    {
      id: '88888888-8888-4888-8888-888888888004',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'MH-PC-PUNE',
      assemblyConstituencyId: null,
    },
    {
      id: '88888888-8888-4888-8888-888888888005',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
      assemblyConstituencyId: null,
    },
    {
      id: '88888888-8888-4888-8888-888888888006',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'DL-PC-SOUTH-DELHI',
      assemblyConstituencyId: null,
    },
    {
      id: '88888888-8888-4888-8888-888888888007',
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    },
    {
      id: '88888888-8888-4888-8888-888888888008',
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-DAKSHIN',
    },
    {
      id: '88888888-8888-4888-8888-888888888009',
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-BHABANIPUR',
    },
    {
      id: '88888888-8888-4888-8888-888888888010',
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-RASHBEHARI',
    },
    {
      id: '88888888-8888-4888-8888-888888888011',
      electionId: 'MH-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'MH-AC-BANDRA-WEST',
    },
    {
      id: '88888888-8888-4888-8888-888888888012',
      electionId: 'DL-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'DL-AC-NEW-DELHI',
    },
  ];

  for (const ec of electionConstituenciesData) {
    await client.electionConstituency.upsert({
      where: { id: ec.id },
      update: ec,
      create: ec,
    });
  }

  // 9. Seed 9 Candidate Nominations (6 for LS-2029 + 3 for WB-ASSEMBLY-2029)
  const nominationsData = [
    {
      id: '99999999-9999-4999-8999-999999999001',
      candidateId: 'CAND-LS29-WB-KRN-1',
      partyId: 'PARTY-AITC',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      assemblyConstituencyId: null,
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE nomination verified.',
    },
    {
      id: '99999999-9999-4999-8999-999999999002',
      candidateId: 'CAND-LS29-WB-KRN-2',
      partyId: 'PARTY-BJP',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      assemblyConstituencyId: null,
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE nomination verified.',
    },
    {
      id: '99999999-9999-4999-8999-999999999003',
      candidateId: 'CAND-LS29-WB-KRN-3',
      partyId: 'PARTY-INC',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      assemblyConstituencyId: null,
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE nomination verified.',
    },
    {
      id: '99999999-9999-4999-8999-999999999004',
      candidateId: 'CAND-LS29-WB-KRN-4',
      partyId: null, // Independent nomination
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
      assemblyConstituencyId: null,
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE independent nomination verified.',
    },
    {
      id: '99999999-9999-4999-8999-999999999005',
      candidateId: 'CAND-LS29-MH-MNC-1',
      partyId: 'PARTY-BJP',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'MH-PC-MUMBAI-NORTH-CENTRAL',
      assemblyConstituencyId: null,
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE nomination verified.',
    },
    {
      id: '99999999-9999-4999-8999-999999999006',
      candidateId: 'CAND-LS29-DL-ND-1',
      partyId: 'PARTY-AAP',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
      assemblyConstituencyId: null,
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE nomination verified.',
    },
    {
      id: '99999999-9999-4999-8999-999999999015',
      candidateId: 'CAND-LS29-DL-ND-2',
      partyId: 'PARTY-BJP',
      electionId: 'LS-2029',
      constituencyType: ConstituencyType.PARLIAMENTARY,
      parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
      assemblyConstituencyId: null,
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE nomination verified (Tied demo candidate).',
    },
    {
      id: '99999999-9999-4999-8999-999999999007',
      candidateId: 'CAND-WBA29-KRNU-1',
      partyId: 'PARTY-AITC',
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE assembly nomination verified.',
    },
    {
      id: '99999999-9999-4999-8999-999999999008',
      candidateId: 'CAND-WBA29-KRNU-2',
      partyId: 'PARTY-BJP',
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE assembly nomination verified.',
    },
    {
      id: '99999999-9999-4999-8999-999999999009',
      candidateId: 'CAND-WBA29-KRNU-3',
      partyId: null, // Independent assembly nomination
      isIndependent: true,
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE independent assembly nomination verified.',
    },
    {
      id: '99999999-9999-4999-8999-999999999010',
      candidateId: 'CAND-MH29-BW-1',
      partyId: 'PARTY-INC',
      isIndependent: false,
      partyNameSnapshot: 'Indian National Congress (DEMO_SAMPLE)',
      partyAbbreviationSnapshot: 'INC',
      partyTypeSnapshot: PartyType.NATIONAL,
      electionId: 'MH-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'MH-AC-BANDRA-WEST',
      status: CandidateNominationStatus.SUBMITTED,
      scrutinyNote: 'DEMO_SAMPLE submitted nomination awaiting scrutiny.',
    },
    {
      id: '99999999-9999-4999-8999-999999999011',
      candidateId: 'CAND-DL29-ND-1',
      partyId: 'PARTY-AAP',
      isIndependent: false,
      partyNameSnapshot: 'Aam Aadmi Party (DEMO_SAMPLE)',
      partyAbbreviationSnapshot: 'AAP',
      partyTypeSnapshot: PartyType.NATIONAL,
      electionId: 'DL-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'DL-AC-NEW-DELHI',
      status: CandidateNominationStatus.DRAFT,
      scrutinyNote: 'DEMO_SAMPLE draft Delhi nomination.',
    },
    {
      id: '99999999-9999-4999-8999-999999999012',
      candidateId: 'CAND-LS29-WB-KRN-1',
      partyId: 'PARTY-AITC',
      isIndependent: false,
      partyNameSnapshot: 'All India Trinamool Congress (DEMO_SAMPLE)',
      partyAbbreviationSnapshot: 'AITC',
      partyTypeSnapshot: PartyType.STATE,
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-BHABANIPUR',
      status: CandidateNominationStatus.UNDER_REVIEW,
      scrutinyNote: 'DEMO_SAMPLE under-review nomination.',
    },
    {
      id: '99999999-9999-4999-8999-999999999013',
      candidateId: 'CAND-LS29-WB-KRN-2',
      partyId: 'PARTY-BJP',
      isIndependent: false,
      partyNameSnapshot: 'Bharatiya Janata Party (DEMO_SAMPLE)',
      partyAbbreviationSnapshot: 'BJP',
      partyTypeSnapshot: PartyType.NATIONAL,
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-BHABANIPUR',
      status: CandidateNominationStatus.REJECTED,
      decisionReason: 'DEMO_SAMPLE simulated scrutiny rejection example.',
      scrutinyNote: 'DEMO_SAMPLE rejected nomination example.',
    },
    {
      id: '99999999-9999-4999-8999-999999999014',
      candidateId: 'CAND-LS29-WB-KRN-4',
      partyId: null,
      isIndependent: true,
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-RASHBEHARI',
      status: CandidateNominationStatus.WITHDRAWN,
      withdrawalReason: 'DEMO_SAMPLE simulated voluntary withdrawal example.',
      scrutinyNote: 'DEMO_SAMPLE withdrawn nomination example.',
    },
  ];

  for (const nom of nominationsData) {
    await client.candidateNomination.upsert({
      where: { id: nom.id },
      update: {},
      create: nom,
    });
  }

  // 10. Seed Phase 8.7 Election Schedule Milestones (idempotent `update: {}`)
  const scheduleMilestonesData = [
    // LS-2029: Complete approved schedule
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.NOMINATION_OPEN,
      startAt: new Date('2029-03-20T04:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE nomination open window.',
    },
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.NOMINATION_DEADLINE,
      startAt: new Date('2029-03-28T09:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE nomination close window.',
    },
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.NOMINATION_SCRUTINY,
      startAt: new Date('2029-03-30T05:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE nomination scrutiny.',
    },
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.WITHDRAWAL_DEADLINE,
      startAt: new Date('2029-04-02T09:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE withdrawal deadline.',
    },
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.CAMPAIGN_START,
      startAt: new Date('2029-04-03T00:00:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE campaign period start.',
    },
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.CAMPAIGN_END,
      startAt: new Date('2029-04-18T12:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE campaign silence period start.',
    },
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.POLLING_START,
      startAt: new Date('2029-04-20T01:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE polling start.',
    },
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.POLLING_END,
      startAt: new Date('2029-05-15T12:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE polling end.',
    },
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.COUNTING_START,
      startAt: new Date('2029-05-20T02:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE counting start.',
    },
    {
      electionId: 'LS-2029',
      milestoneType: ScheduleMilestoneType.RESULT_PUBLICATION,
      startAt: new Date('2029-05-22T06:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE result declaration.',
    },

    // WB-ASSEMBLY-2029: Complete schedule submitted for review
    {
      electionId: 'WB-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.NOMINATION_OPEN,
      startAt: new Date('2029-03-20T04:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE WB nomination open.',
    },
    {
      electionId: 'WB-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.NOMINATION_DEADLINE,
      startAt: new Date('2029-03-28T09:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE WB nomination close.',
    },
    {
      electionId: 'WB-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.NOMINATION_SCRUTINY,
      startAt: new Date('2029-03-30T05:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE WB scrutiny.',
    },
    {
      electionId: 'WB-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.WITHDRAWAL_DEADLINE,
      startAt: new Date('2029-04-02T09:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.COMPLETED,
      note: 'DEMO_SAMPLE WB withdrawal deadline.',
    },
    {
      electionId: 'WB-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.POLLING_START,
      startAt: new Date('2029-04-20T01:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE WB polling start.',
    },
    {
      electionId: 'WB-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.POLLING_END,
      startAt: new Date('2029-05-10T12:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE WB polling end.',
    },
    {
      electionId: 'WB-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.COUNTING_START,
      startAt: new Date('2029-05-20T02:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE WB counting start.',
    },
    {
      electionId: 'WB-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.RESULT_PUBLICATION,
      startAt: new Date('2029-05-22T06:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE WB result declaration.',
    },

    // DL-ASSEMBLY-2029: Incomplete draft schedule
    {
      electionId: 'DL-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.NOMINATION_OPEN,
      startAt: new Date('2029-10-15T04:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE DL draft nomination open.',
    },
    {
      electionId: 'DL-ASSEMBLY-2029',
      milestoneType: ScheduleMilestoneType.POLLING_START,
      startAt: new Date('2029-11-10T01:30:00.000Z'),
      endAt: null,
      timezone: 'Asia/Kolkata',
      status: ScheduleMilestoneStatus.CONFIGURED,
      note: 'DEMO_SAMPLE DL draft polling start.',
    },
  ];

  for (const milestone of scheduleMilestonesData) {
    await client.electionScheduleMilestone.upsert({
      where: {
        electionId_milestoneType: {
          electionId: milestone.electionId,
          milestoneType: milestone.milestoneType,
        },
      },
      update: {},
      create: milestone,
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
  };
}

export const seedDemoDatabase = seedDatabase;

/**
 * Phase 8.8 — Optional idempotent synthetic demo voters & independent PC/AC
 * participation scenarios (zero candidate-choice data).
 */
export async function seedDemoVotingScenarios(
  client: PrismaClient = defaultPrisma
) {
  const demoVoters = [
    {
      userId: '88888888-8888-4888-8888-888888880001',
      voterId: '88888888-8888-4888-8888-888888881001',
      epicNumber: 'DEMO-EPIC-8801',
      fullName: 'Aarav Chatterjee (DEMO_SAMPLE)',
      email: 'voter8801@ovs-demo.local',
      mobile: '9800008801',
      stateId: 'WB',
      districtId: 'WB-DIST-KOLKATA',
      parliamentaryConstituencyId: 'WB-PC-KOLKATA-SOUTH',
      assemblyConstituencyId: 'WB-AC-BHABANIPUR',
      participatedElectionId: 'LS-2029',
      participatedConstituencyType: ConstituencyType.PARLIAMENTARY,
      participatedPcId: 'WB-PC-KOLKATA-SOUTH',
      participatedAcId: null,
    },
    {
      userId: '88888888-8888-4888-8888-888888880002',
      voterId: '88888888-8888-4888-8888-888888881002',
      epicNumber: 'DEMO-EPIC-8802',
      fullName: 'Meera Sen (DEMO_SAMPLE)',
      email: 'voter8802@ovs-demo.local',
      mobile: '9800008802',
      stateId: 'WB',
      districtId: 'WB-DIST-KOLKATA',
      parliamentaryConstituencyId: 'WB-PC-KOLKATA-NORTH',
      assemblyConstituencyId: 'WB-AC-RASHBEHARI',
      participatedElectionId: 'WB-ASSEMBLY-2029',
      participatedConstituencyType: ConstituencyType.ASSEMBLY,
      participatedPcId: null,
      participatedAcId: 'WB-AC-RASHBEHARI',
    },
  ];

  for (const v of demoVoters) {
    await client.user.upsert({
      where: { id: v.userId },
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
      where: { id: v.voterId },
      update: {},
      create: {
        id: v.voterId,
        userId: v.userId,
        epicNumber: v.epicNumber,
        fullName: v.fullName,
        dateOfBirth: new Date('1995-05-15'),
        gender: 'Other',
        mobile: v.mobile,
        email: v.email,
        address: 'Demo Simulation Ward, Kolkata (DEMO_SAMPLE)',
        pinCode: '700025',
        stateId: v.stateId,
        districtId: v.districtId,
        parliamentaryConstituencyId: v.parliamentaryConstituencyId,
        assemblyConstituencyId: v.assemblyConstituencyId,
        isVerified: false,
        metadataSource: MetadataSource.DEMO_SAMPLE,
      },
    });

    await client.demoParticipation.upsert({
      where: {
        voterId_electionId: {
          voterId: v.voterId,
          electionId: v.participatedElectionId,
        },
      },
      update: {},
      create: {
        voterId: v.voterId,
        electionId: v.participatedElectionId,
        constituencyType: v.participatedConstituencyType,
        parliamentaryConstituencyId: v.participatedPcId,
        assemblyConstituencyId: v.participatedAcId,
        status: 'PARTICIPATED',
        demoReference: `DEMO-${v.epicNumber}`,
        referenceId: `DEMO-REF-${v.participatedElectionId}-${v.epicNumber}`,
        participatedAt: new Date('2029-04-25T06:00:00.000Z'),
        metadata: { source: 'DEMO_SAMPLE_SEED' },
      },
    });
  }
}

/**
 * Phase 8.9 — Idempotent synthetic demo counting sessions, counting rounds,
 * candidate tallies, and simulated result publication (strictly independent of voter participation).
 */
export async function seedDemoCountingScenarios(
  client: PrismaClient = defaultPrisma
) {
  // 1. Ensure administrative user exists for result publication authorization
  let admin = await client.adminUser.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (!admin) {
    const adminUserRecord = await client.user.upsert({
      where: { identifier: 'ECI-SUPER-SEED-01' },
      update: {},
      create: {
        id: '77777777-7777-4777-8777-777777770001',
        userType: 'ADMIN',
        identifier: 'ECI-SUPER-SEED-01',
        passwordHash: '$scrypt$placeholder_admin_hash_demo',
        isActive: true,
      },
    });

    admin = await client.adminUser.upsert({
      where: { officerCode: 'ECI-SUPER-SEED-01' },
      update: {},
      create: {
        id: '77777777-7777-4777-8777-777777771001',
        userId: adminUserRecord.id,
        officerCode: 'ECI-SUPER-SEED-01',
        email: 'superadmin.seed@ovs-demo.invalid',
        fullName: 'Dev Super Administrator (DEMO_SAMPLE)',
        designation: 'Chief Election Commissioner',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }

  // 2. Scenario 1: Published Lok Sabha result for Krishnanagar PC
  const sessionId1 = 'RESULT-LS-2029-WB-PC-KRISHNANAGAR';
  let session1 = await client.countingSession.findUnique({
    where: { id: sessionId1 },
  });

  if (!session1) {
    session1 = await client.countingSession.create({
      data: {
        id: sessionId1,
        electionId: 'LS-2029',
        constituencyType: 'PARLIAMENTARY',
        parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
        assemblyConstituencyId: null,
        totalConfiguredRounds: 5,
        totalVoters: 1542000,
        status: 'DRAFT',
        isPublished: false,
      },
    });

    // Rounds 1-5
    const rounds1 = [
      { roundNumber: 1, roundVotes: 3000, cumulativeVotes: 3000, leadMargin: 260 },
      { roundNumber: 2, roundVotes: 3000, cumulativeVotes: 6000, leadMargin: 520 },
      { roundNumber: 3, roundVotes: 3000, cumulativeVotes: 9000, leadMargin: 780 },
      { roundNumber: 4, roundVotes: 3000, cumulativeVotes: 12000, leadMargin: 1040 },
      { roundNumber: 5, roundVotes: 3000, cumulativeVotes: 15000, leadMargin: 1300 },
    ];

    for (const r of rounds1) {
      await client.countingRound.create({
        data: {
          sessionId: sessionId1,
          roundNumber: r.roundNumber,
          roundVotes: r.roundVotes,
          cumulativeVotes: r.cumulativeVotes,
          leadingCandidateId: 'CAND-LS29-WB-KRN-1',
          leadMargin: r.leadMargin,
          processedByAdminId: admin.id,
        },
      });
    }

    // Tallies: 6500 + 5200 + 2000 + 800 + 300 (NOTA) + 200 (Rejected) = 15000
    const tallies1 = [
      {
        candidateId: 'CAND-LS29-WB-KRN-1',
        nominationId: '99999999-9999-4999-8999-999999999001',
        partyId: 'PARTY-AITC',
        votes: 6500,
        voteSharePercentage: 43.33,
      },
      {
        candidateId: 'CAND-LS29-WB-KRN-2',
        nominationId: '99999999-9999-4999-8999-999999999002',
        partyId: 'PARTY-BJP',
        votes: 5200,
        voteSharePercentage: 34.67,
      },
      {
        candidateId: 'CAND-LS29-WB-KRN-3',
        nominationId: '99999999-9999-4999-8999-999999999003',
        partyId: 'PARTY-INC',
        votes: 2000,
        voteSharePercentage: 13.33,
      },
      {
        candidateId: 'CAND-LS29-WB-KRN-4',
        nominationId: '99999999-9999-4999-8999-999999999004',
        partyId: null,
        votes: 800,
        voteSharePercentage: 5.33,
      },
    ];

    for (const t of tallies1) {
      await client.candidateTally.create({
        data: {
          sessionId: sessionId1,
          candidateId: t.candidateId,
          nominationId: t.nominationId,
          partyId: t.partyId,
          votes: t.votes,
          voteSharePercentage: t.voteSharePercentage,
        },
      });
    }

    // State machine progression: DRAFT -> COUNTING_IN_PROGRESS -> COUNTING_COMPLETED -> RESULT_READY_FOR_REVIEW -> PUBLISHED
    await client.countingSession.update({
      where: { id: sessionId1 },
      data: {
        currentRound: 5,
        totalCountedVotes: 15000,
        notaVotes: 300,
        rejectedVotes: 200,
        winnerCandidateId: 'CAND-LS29-WB-KRN-1',
        runnerUpCandidateId: 'CAND-LS29-WB-KRN-2',
        victoryMargin: 1300,
        status: 'COUNTING_IN_PROGRESS',
      },
    });

    await client.countingSession.update({
      where: { id: sessionId1 },
      data: { status: 'COUNTING_COMPLETED' },
    });

    await client.countingSession.update({
      where: { id: sessionId1 },
      data: { status: 'RESULT_READY_FOR_REVIEW' },
    });

    await client.countingSession.update({
      where: { id: sessionId1 },
      data: {
        status: 'PUBLISHED',
        isPublished: true,
        publishedAt: new Date('2029-05-22T10:00:00Z'),
        publishedByAdminId: admin.id,
      },
    });
  }

  // 3. Scenario 2: Assembly counting completed awaiting review for Krishnanagar Uttar AC
  const sessionId2 = 'RESULT-WB-ASSEMBLY-2029-WB-AC-KRISHNANAGAR-UTTAR';
  let session2 = await client.countingSession.findUnique({
    where: { id: sessionId2 },
  });

  if (!session2) {
    session2 = await client.countingSession.create({
      data: {
        id: sessionId2,
        electionId: 'WB-ASSEMBLY-2029',
        constituencyType: 'ASSEMBLY',
        parliamentaryConstituencyId: null,
        assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
        totalConfiguredRounds: 3,
        totalVoters: 245000,
        status: 'DRAFT',
        isPublished: false,
      },
    });

    const rounds2 = [
      { roundNumber: 1, roundVotes: 3333, cumulativeVotes: 3333, leadMargin: 500 },
      { roundNumber: 2, roundVotes: 3333, cumulativeVotes: 6666, leadMargin: 1000 },
      { roundNumber: 3, roundVotes: 3334, cumulativeVotes: 10000, leadMargin: 1500 },
    ];

    for (const r of rounds2) {
      await client.countingRound.create({
        data: {
          sessionId: sessionId2,
          roundNumber: r.roundNumber,
          roundVotes: r.roundVotes,
          cumulativeVotes: r.cumulativeVotes,
          leadingCandidateId: 'CAND-WBA29-KRNU-1',
          leadMargin: r.leadMargin,
          processedByAdminId: admin.id,
        },
      });
    }

    const tallies2 = [
      {
        candidateId: 'CAND-WBA29-KRNU-1',
        nominationId: '99999999-9999-4999-8999-999999999007',
        partyId: 'PARTY-AITC',
        votes: 5000,
        voteSharePercentage: 50.0,
      },
      {
        candidateId: 'CAND-WBA29-KRNU-2',
        nominationId: '99999999-9999-4999-8999-999999999008',
        partyId: 'PARTY-BJP',
        votes: 3500,
        voteSharePercentage: 35.0,
      },
      {
        candidateId: 'CAND-WBA29-KRNU-3',
        nominationId: '99999999-9999-4999-8999-999999999009',
        partyId: null,
        votes: 1000,
        voteSharePercentage: 10.0,
      },
    ];

    for (const t of tallies2) {
      await client.candidateTally.create({
        data: {
          sessionId: sessionId2,
          candidateId: t.candidateId,
          nominationId: t.nominationId,
          partyId: t.partyId,
          votes: t.votes,
          voteSharePercentage: t.voteSharePercentage,
        },
      });
    }

    await client.countingSession.update({
      where: { id: sessionId2 },
      data: {
        currentRound: 3,
        totalCountedVotes: 10000,
        notaVotes: 300,
        rejectedVotes: 200,
        winnerCandidateId: 'CAND-WBA29-KRNU-1',
        runnerUpCandidateId: 'CAND-WBA29-KRNU-2',
        victoryMargin: 1500,
        status: 'COUNTING_IN_PROGRESS',
      },
    });

    await client.countingSession.update({
      where: { id: sessionId2 },
      data: { status: 'COUNTING_COMPLETED' },
    });

    await client.countingSession.update({
      where: { id: sessionId2 },
      data: { status: 'RESULT_READY_FOR_REVIEW' },
    });
  }

  // 4. Scenario 3: Genuine TIED scenario for New Delhi PC (demonstration for tie resolution)
  const sessionId3 = 'RESULT-LS-2029-DL-PC-NEW-DELHI';
  let session3 = await client.countingSession.findUnique({
    where: { id: sessionId3 },
  });

  if (!session3) {
    session3 = await client.countingSession.create({
      data: {
        id: sessionId3,
        electionId: 'LS-2029',
        constituencyType: 'PARLIAMENTARY',
        parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
        assemblyConstituencyId: null,
        totalConfiguredRounds: 3,
        totalVoters: 980000,
        status: 'DRAFT',
        isPublished: false,
      },
    });

    await client.countingRound.create({
      data: {
        sessionId: sessionId3,
        roundNumber: 1,
        roundVotes: 10000,
        cumulativeVotes: 10000,
        leadingCandidateId: 'CAND-LS29-DL-ND-1',
        leadMargin: 0,
        processedByAdminId: admin.id,
      },
    });

    const tallies3 = [
      {
        candidateId: 'CAND-LS29-DL-ND-1',
        nominationId: '99999999-9999-4999-8999-999999999006',
        partyId: 'PARTY-AAP',
        votes: 4800,
        voteSharePercentage: 48.0,
      },
      {
        candidateId: 'CAND-LS29-DL-ND-2',
        nominationId: '99999999-9999-4999-8999-999999999015',
        partyId: 'PARTY-BJP',
        votes: 4800,
        voteSharePercentage: 48.0,
      },
    ];

    for (const t of tallies3) {
      await client.candidateTally.create({
        data: {
          sessionId: sessionId3,
          candidateId: t.candidateId,
          nominationId: t.nominationId,
          partyId: t.partyId,
          votes: t.votes,
          voteSharePercentage: t.voteSharePercentage,
        },
      });
    }

    await client.countingSession.update({
      where: { id: sessionId3 },
      data: {
        currentRound: 1,
        totalCountedVotes: 10000,
        notaVotes: 250,
        rejectedVotes: 150,
        winnerCandidateId: null,
        runnerUpCandidateId: null,
        victoryMargin: 0,
        status: 'COUNTING_IN_PROGRESS',
      },
    });

    await client.countingSession.update({
      where: { id: sessionId3 },
      data: { status: 'TIED' },
    });
  }
}

/**
 * Phase 8.11 — Idempotent synthetic announcements, voter in-app notifications,
 * preferences, and development delivery telemetry.
 */
export async function seedNotificationsAndAnnouncements(
  client: PrismaClient = defaultPrisma
) {
  // 1. Seed announcements
  await client.announcement.upsert({
    where: { id: 'ANN-SEED-001' },
    update: {},
    create: {
      id: 'ANN-SEED-001',
      title: 'General Election 2029 Gazette Notification',
      summary: 'Official simulated gazette notification for Lok Sabha General Election 2029.',
      message:
        'The Election Commission simulation announces the schedule for General Elections 2029 across 543 Parliamentary Constituencies.',
      category: AnnouncementCategory.GENERAL_INFO,
      targetAudience: AnnouncementAudience.ALL_VOTERS,
      publicationDate: new Date('2026-11-01'),
      expiryDate: new Date('2029-12-31'),
      status: AnnouncementStatus.PUBLISHED,
    },
  });

  await client.announcement.upsert({
    where: { id: 'ANN-SEED-002' },
    update: {},
    create: {
      id: 'ANN-SEED-002',
      title: 'West Bengal Assembly Election 2026 Polling Advisory',
      summary: 'Simulated polling hours and station allocation for West Bengal Assembly Election.',
      message:
        'All registered demo voters in West Bengal may review designated polling stations and verify electoral roll entries.',
      category: AnnouncementCategory.POLLING_INSTRUCTIONS,
      targetAudience: AnnouncementAudience.SPECIFIC_STATE,
      targetStateId: 'WB',
      publicationDate: new Date('2026-11-05'),
      expiryDate: new Date('2027-12-31'),
      status: AnnouncementStatus.PUBLISHED,
    },
  });

  await client.announcement.upsert({
    where: { id: 'ANN-SEED-003' },
    update: {},
    create: {
      id: 'ANN-SEED-003',
      title: 'Nomination Scrutiny Timetable Draft',
      summary: 'Draft scrutiny calendar for prospective candidates.',
      message:
        'Draft schedule under internal review for candidate documentation verification.',
      category: AnnouncementCategory.ELECTION_SCHEDULE,
      targetAudience: AnnouncementAudience.ALL_VOTERS,
      publicationDate: new Date('2026-11-15'),
      expiryDate: new Date('2027-01-01'),
      status: AnnouncementStatus.DRAFT,
    },
  });

  // 2. Seed voter notifications and preferences for existing sample voters
  const sampleVoter = await client.voterProfile.findFirst({
    include: { user: true },
  });

  if (sampleVoter) {
    // Seed notification preference
    await client.notificationPreference.upsert({
      where: { userId: sampleVoter.userId },
      update: {},
      create: {
        userId: sampleVoter.userId,
        emailEnabled: false,
        inAppEnabled: true,
        electionReminders: true,
        generalAnnouncements: true,
        adminAlerts: true,
      },
    });

    // Seed sample voter notifications
    const notif1Id = 'NOTIF-SEED-001';
    const notif2Id = 'NOTIF-SEED-002';

    const existingNotif = await client.voterNotification.findUnique({
      where: { id: notif1Id },
    });

    if (!existingNotif) {
      await client.voterNotification.create({
        data: {
          id: notif1Id,
          voterId: sampleVoter.id,
          type: NotificationType.ELECTION_ANNOUNCEMENT,
          title: 'Simulated Election Announced: LS-2029',
          message:
            'The demo election LS-2029 has been gazetted. Check your eligibility and candidate profiles in the voter portal.',
          timestamp: new Date(),
          isRead: false,
        },
      });

      await client.voterNotification.create({
        data: {
          id: notif2Id,
          voterId: sampleVoter.id,
          type: NotificationType.POLLING_SCHEDULE,
          title: 'Demo Polling Hours Reminder',
          message:
            'Simulated voting for your constituency will be active from 07:00 to 18:00 IST on polling day.',
          timestamp: new Date(),
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    // Seed sample delivery log
    const existingDelivery = await client.notificationDelivery.findFirst({
      where: { notificationId: notif1Id },
    });

    if (!existingDelivery) {
      await client.notificationDelivery.create({
        data: {
          notificationId: notif1Id,
          recipientUserId: sampleVoter.userId,
          recipientEmail: sampleVoter.email,
          channel: 'IN_APP',
          status: 'DELIVERED',
          attempts: 1,
          deliveredAt: new Date(),
        },
      });
    }
  }
}

const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'));

if (isMainModule) {
  seedDatabase()
    .then(async (summary) => {
      await seedDemoVotingScenarios(defaultPrisma);
      await seedDemoCountingScenarios(defaultPrisma);
      await seedNotificationsAndAnnouncements(defaultPrisma);
      console.log(
        'OVS Phase 8.11 DEMO_SAMPLE database seed completed idempotently:',
        JSON.stringify(summary)
      );
      await defaultPrisma.$disconnect();
    })
    .catch(async (err) => {
      console.error('Failed to seed OVS database:', err);
      await defaultPrisma.$disconnect();
      process.exit(1);
    });
}
