import {
  CandidateNominationStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
  JurisdictionType,
  MetadataSource,
  PartyStatus,
  PartyType,
  PrismaClient,
  ReservationType,
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
      update: party,
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
  ];

  for (const candidate of candidatesData) {
    await client.candidate.upsert({
      where: { id: candidate.id },
      update: candidate,
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
      electionId: 'WB-ASSEMBLY-2029',
      constituencyType: ConstituencyType.ASSEMBLY,
      parliamentaryConstituencyId: null,
      assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
      status: CandidateNominationStatus.APPROVED,
      scrutinyNote: 'DEMO_SAMPLE independent assembly nomination verified.',
    },
  ];

  for (const nom of nominationsData) {
    await client.candidateNomination.upsert({
      where: { id: nom.id },
      update: nom,
      create: nom,
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
  };
}

export const seedDemoDatabase = seedDatabase;

const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'));

if (isMainModule) {
  seedDatabase()
    .then(async (summary) => {
      console.log(
        'OVS Phase 8.2 DEMO_SAMPLE database seed completed idempotently:',
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
