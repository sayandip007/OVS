import { CONSTITUENCY_TYPES, METADATA_SOURCES } from '../utils/constants';
import { INITIAL_STATES } from './states';
import { INITIAL_DISTRICTS } from './districts';

/**
 * Curated Parliamentary (PARLIAMENTARY) and Assembly (ASSEMBLY) constituencies
 * for key states + deterministic sample generation across all 36 States & Union Territories
 * so every State/UT has at least 2 Parliamentary Constituencies and 2 Assembly Constituencies per district.
 */
const CURATED_CONSTITUENCIES = [
  // ================= WEST BENGAL (WB) =================
  {
    id: 'WB-PC-KRISHNANAGAR',
    name: 'Krishnanagar',
    type: CONSTITUENCY_TYPES.PARLIAMENTARY,
    stateId: 'WB',
    districtIds: ['NADIA'],
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'WB-PC-KOLKATA-DAKSHIN',
    name: 'Kolkata Dakshin',
    type: CONSTITUENCY_TYPES.PARLIAMENTARY,
    stateId: 'WB',
    districtIds: ['WB-DIST-KOLKATA'],
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'WB-AC-KRISHNANAGAR-UTTAR',
    name: 'Krishnanagar Uttar',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'WB',
    districtId: 'NADIA',
    parentParliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'WB-AC-KRISHNANAGAR-DAKSHIN',
    name: 'Krishnanagar Dakshin',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'WB',
    districtId: 'NADIA',
    parentParliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'WB-AC-BHABANIPUR',
    name: 'Bhabanipur',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'WB',
    districtId: 'WB-DIST-KOLKATA',
    parentParliamentaryConstituencyId: 'WB-PC-KOLKATA-DAKSHIN',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'WB-AC-BALLYGUNGE',
    name: 'Ballygunge',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'WB',
    districtId: 'WB-DIST-KOLKATA',
    parentParliamentaryConstituencyId: 'WB-PC-KOLKATA-DAKSHIN',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },

  // ================= NCT OF DELHI (DL) =================
  {
    id: 'DL-PC-NEW-DELHI',
    name: 'New Delhi',
    type: CONSTITUENCY_TYPES.PARLIAMENTARY,
    stateId: 'DL',
    districtIds: ['DL-DIST-NEW-DELHI'],
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'DL-PC-CHANDNI-CHOWK',
    name: 'Chandni Chowk',
    type: CONSTITUENCY_TYPES.PARLIAMENTARY,
    stateId: 'DL',
    districtIds: ['DL-DIST-NORTH-DELHI'],
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'DL-AC-NEW-DELHI',
    name: 'New Delhi',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'DL',
    districtId: 'DL-DIST-NEW-DELHI',
    parentParliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'DL-AC-KAROL-BAGH',
    name: 'Karol Bagh',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'DL',
    districtId: 'DL-DIST-NEW-DELHI',
    parentParliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'DL-AC-CHANDNI-CHOWK',
    name: 'Chandni Chowk',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'DL',
    districtId: 'DL-DIST-NORTH-DELHI',
    parentParliamentaryConstituencyId: 'DL-PC-CHANDNI-CHOWK',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'DL-AC-MODEL-TOWN',
    name: 'Model Town',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'DL',
    districtId: 'DL-DIST-NORTH-DELHI',
    parentParliamentaryConstituencyId: 'DL-PC-CHANDNI-CHOWK',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },

  // ================= UTTAR PRADESH (UP) =================
  {
    id: 'UP-PC-VARANASI',
    name: 'Varanasi',
    type: CONSTITUENCY_TYPES.PARLIAMENTARY,
    stateId: 'UP',
    districtIds: ['UP-DIST-VARANASI'],
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'UP-PC-LUCKNOW',
    name: 'Lucknow',
    type: CONSTITUENCY_TYPES.PARLIAMENTARY,
    stateId: 'UP',
    districtIds: ['UP-DIST-LUCKNOW'],
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'UP-AC-VARANASI-SOUTH',
    name: 'Varanasi South',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'UP',
    districtId: 'UP-DIST-VARANASI',
    parentParliamentaryConstituencyId: 'UP-PC-VARANASI',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'UP-AC-VARANASI-CANTONMENT',
    name: 'Varanasi Cantonment',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'UP',
    districtId: 'UP-DIST-VARANASI',
    parentParliamentaryConstituencyId: 'UP-PC-VARANASI',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'UP-AC-LUCKNOW-CENTRAL',
    name: 'Lucknow Central',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'UP',
    districtId: 'UP-DIST-LUCKNOW',
    parentParliamentaryConstituencyId: 'UP-PC-LUCKNOW',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'UP-AC-LUCKNOW-EAST',
    name: 'Lucknow East',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'UP',
    districtId: 'UP-DIST-LUCKNOW',
    parentParliamentaryConstituencyId: 'UP-PC-LUCKNOW',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },

  // ================= MAHARASHTRA (MH) =================
  {
    id: 'MH-PC-MUMBAI-NORTH',
    name: 'Mumbai North',
    type: CONSTITUENCY_TYPES.PARLIAMENTARY,
    stateId: 'MH',
    districtIds: ['MH-DIST-MUMBAI-SUBURBAN'],
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'MH-PC-PUNE',
    name: 'Pune',
    type: CONSTITUENCY_TYPES.PARLIAMENTARY,
    stateId: 'MH',
    districtIds: ['MH-DIST-PUNE'],
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'MH-AC-BANDRA-WEST',
    name: 'Bandra West',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'MH',
    districtId: 'MH-DIST-MUMBAI-SUBURBAN',
    parentParliamentaryConstituencyId: 'MH-PC-MUMBAI-NORTH',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'MH-AC-ANDHERI-EAST',
    name: 'Andheri East',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'MH',
    districtId: 'MH-DIST-MUMBAI-SUBURBAN',
    parentParliamentaryConstituencyId: 'MH-PC-MUMBAI-NORTH',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'MH-AC-SHIVAJINAGAR',
    name: 'Shivajinagar',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'MH',
    districtId: 'MH-DIST-PUNE',
    parentParliamentaryConstituencyId: 'MH-PC-PUNE',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'MH-AC-KOTHRUD',
    name: 'Kothrud',
    type: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'MH',
    districtId: 'MH-DIST-PUNE',
    parentParliamentaryConstituencyId: 'MH-PC-PUNE',
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
];

const curatedStateIds = new Set(['WB', 'DL', 'UP', 'MH']);

function buildRemainingConstituencies() {
  const generated = [];

  for (const state of INITIAL_STATES) {
    if (curatedStateIds.has(state.id)) continue;

    const stateDistricts = INITIAL_DISTRICTS.filter((d) => d.stateId === state.id);
    const dist1 = stateDistricts[0];
    const dist2 = stateDistricts[1] || stateDistricts[0];

    const pc1Id = `${state.id}-PC-1`;
    const pc2Id = `${state.id}-PC-2`;

    generated.push(
      {
        id: pc1Id,
        name: `${dist1 ? dist1.name : state.name} Parliamentary`,
        type: CONSTITUENCY_TYPES.PARLIAMENTARY,
        stateId: state.id,
        districtIds: dist1 ? [dist1.id] : [],
        metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
      },
      {
        id: pc2Id,
        name: `${dist2 ? dist2.name : state.capital} Parliamentary`,
        type: CONSTITUENCY_TYPES.PARLIAMENTARY,
        stateId: state.id,
        districtIds: dist2 ? [dist2.id] : [],
        metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
      }
    );

    stateDistricts.forEach((dist, idx) => {
      const parentPcId = idx === 0 ? pc1Id : pc2Id;
      generated.push(
        {
          id: `${state.id}-AC-${idx + 1}A`,
          name: `${dist.name} North`,
          type: CONSTITUENCY_TYPES.ASSEMBLY,
          stateId: state.id,
          districtId: dist.id,
          parentParliamentaryConstituencyId: parentPcId,
          metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
        },
        {
          id: `${state.id}-AC-${idx + 1}B`,
          name: `${dist.name} South`,
          type: CONSTITUENCY_TYPES.ASSEMBLY,
          stateId: state.id,
          districtId: dist.id,
          parentParliamentaryConstituencyId: parentPcId,
          metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
        }
      );
    });
  }

  return generated;
}

export const INITIAL_CONSTITUENCIES = [
  ...CURATED_CONSTITUENCIES,
  ...buildRemainingConstituencies(),
];
