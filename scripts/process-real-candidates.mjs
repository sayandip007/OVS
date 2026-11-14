import fs from 'fs';
import path from 'path';
import readline from 'readline';

const STATE_NAME_TO_ID = {
  'Andaman & Nicobar Islands': 'AN',
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  'Assam': 'AS',
  'Bihar': 'BR',
  'Chandigarh': 'CH',
  'Chhattisgarh': 'CG',
  'Dadra & Nagar Haveli and Daman & Diu': 'DN',
  'Goa': 'GA',
  'Gujarat': 'GJ',
  'Haryana': 'HR',
  'Himachal Pradesh': 'HP',
  'Jammu and Kashmir': 'JK',
  'Jharkhand': 'JH',
  'Karnataka': 'KA',
  'Kerala': 'KL',
  'Ladakh': 'LA',
  'Lakshadweep': 'LD',
  'Madhya Pradesh': 'MP',
  'Maharashtra': 'MH',
  'Manipur': 'MN',
  'Meghalaya': 'ML',
  'Mizoram': 'MZ',
  'NCT OF Delhi': 'DL',
  'NCT of Delhi': 'DL',
  'Nagaland': 'NL',
  'Odisha': 'OD',
  'Puducherry': 'PY',
  'Punjab': 'PB',
  'Rajasthan': 'RJ',
  'Sikkim': 'SK',
  'Tamil Nadu': 'TN',
  'Telangana': 'TG',
  'Tripura': 'TR',
  'Uttar Pradesh': 'UP',
  'Uttarakhand': 'UK',
  'West Bengal': 'WB',
};

const CANONICAL_PARTIES = [
  {
    matches: ['bharatiya janata', 'bjp'],
    id: 'PARTY-BJP',
    name: 'Bharatiya Janata Party',
    abbr: 'BJP',
    symbol: '/assets/parties/bjp.svg',
  },
  {
    matches: ['indian national congress', 'congress party', 'inc'],
    id: 'PARTY-INC',
    name: 'Indian National Congress',
    abbr: 'INC',
    symbol: '/assets/parties/inc.svg',
  },
  {
    matches: ['aam aadmi', 'aap'],
    id: 'PARTY-AAP',
    name: 'Aam Aadmi Party',
    abbr: 'AAP',
    symbol: '/assets/parties/aap.svg',
  },
  {
    matches: ['all india trinamool congress', 'trinamool', 'aitc', 'tmc'],
    id: 'PARTY-AITC',
    name: 'All India Trinamool Congress',
    abbr: 'AITC',
    symbol: '/assets/parties/tmc.svg',
  },
  {
    matches: ['communist party of india (marxist)', 'cpim', 'cpi(m)'],
    id: 'PARTY-CPIM',
    name: 'Communist Party of India (Marxist)',
    abbr: 'CPI(M)',
    symbol: '/assets/parties/cpim.svg',
  },
  {
    matches: ['bahujan samaj party', 'bsp'],
    id: 'PARTY-BSP',
    name: 'Bahujan Samaj Party',
    abbr: 'BSP',
    symbol: '/assets/parties/bsp.svg',
  },
  {
    matches: ['samajwadi party', 'sp'],
    id: 'PARTY-SP',
    name: 'Samajwadi Party',
    abbr: 'SP',
    symbol: '/assets/parties/sp.svg',
  },
  {
    matches: ['telugu desam', 'tdp'],
    id: 'PARTY-TDP',
    name: 'Telugu Desam Party',
    abbr: 'TDP',
    symbol: '/assets/parties/tdp.svg',
  },
  {
    matches: ['dravida munnetra kazhagam', 'dmk'],
    id: 'PARTY-DMK',
    name: 'Dravida Munnetra Kazhagam',
    abbr: 'DMK',
    symbol: '/assets/parties/dmk.svg',
  },
  {
    matches: ['anna dravida munnetra', 'aiadmk'],
    id: 'PARTY-AIADMK',
    name: 'All India Anna Dravida Munnetra Kazhagam',
    abbr: 'AIADMK',
    symbol: '/assets/parties/aiadmk.svg',
  },
  {
    matches: ['yuvajana sramika rythu', 'ysrcp', 'ysr congress'],
    id: 'PARTY-YSRCP',
    name: 'Yuvajana Sramika Rythu Congress Party',
    abbr: 'YSRCP',
    symbol: '/assets/parties/ysrcp.svg',
  },
  {
    matches: ['nationalist congress party (sharadchandra', 'ncp-sp', 'ncpsp'],
    id: 'PARTY-NCPSP',
    name: 'Nationalist Congress Party (Sharadchandra Pawar)',
    abbr: 'NCPSP',
    symbol: '/assets/parties/ncp.svg',
  },
  {
    matches: ['nationalist congress party', 'ncp'],
    id: 'PARTY-NCP',
    name: 'Nationalist Congress Party',
    abbr: 'NCP',
    symbol: '/assets/parties/ncp.svg',
  },
  {
    matches: ['shiv sena', 'shivsena'],
    id: 'PARTY-SHS',
    name: 'Shiv Sena',
    abbr: 'SHS',
    symbol: '/assets/parties/shivsena.svg',
  },
  {
    matches: ['janata dal (united)', 'jdu', 'jd(u)'],
    id: 'PARTY-JDU',
    name: 'Janata Dal (United)',
    abbr: 'JD(U)',
    symbol: '/assets/parties/jdu.svg',
  },
  {
    matches: ['rashtriya janata dal', 'rjd'],
    id: 'PARTY-RJD',
    name: 'Rashtriya Janata Dal',
    abbr: 'RJD',
    symbol: '/assets/parties/rjd.svg',
  },
  {
    matches: ['biju janata dal', 'bjd'],
    id: 'PARTY-BJD',
    name: 'Biju Janata Dal',
    abbr: 'BJD',
    symbol: '/assets/parties/bjd.svg',
  },
  {
    matches: ['all india majlis-e-ittehadul', 'aimim'],
    id: 'PARTY-AIMIM',
    name: 'All India Majlis-E-Ittehadul Muslimeen',
    abbr: 'AIMIM',
    symbol: '/assets/parties/aimim.svg',
  },
  {
    matches: ['independent'],
    id: 'PARTY-IND',
    name: 'Independent',
    abbr: 'IND',
    symbol: '/assets/parties/ind.svg',
  },
];

function resolveCanonicalParty(partyNameRaw) {
  const raw = String(partyNameRaw || 'Independent').trim();
  const lower = raw.toLowerCase();

  for (const cp of CANONICAL_PARTIES) {
    for (const m of cp.matches) {
      if (lower.includes(m)) {
        return {
          id: cp.id,
          name: cp.name,
          abbreviation: cp.abbr,
          symbolUrl: cp.symbol,
          isIndependent: cp.id === 'PARTY-IND',
        };
      }
    }
  }

  // Fallback for registered unrecognised regional parties
  const isInd = lower.includes('independent');
  const slug = raw.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const cleanAbbr = raw
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6) || 'IND';

  return {
    id: isInd ? 'PARTY-IND' : `PARTY-${slug.slice(0, 24)}`,
    name: raw,
    abbreviation: isInd ? 'IND' : cleanAbbr,
    symbolUrl: '/assets/parties/ind.svg',
    isIndependent: isInd,
  };
}

function slugify(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCsvLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

async function main() {
  console.log('Processing real candidate_data.csv with canonical party and constituency mapping...');
  const fileStream = fs.createReadStream('candidate_data.csv', { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let header = null;
  const constituenciesMap = new Map();
  const partiesMap = new Map();
  const candidatesList = [];

  let rowIdx = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    rowIdx++;
    const cols = parseCsvLine(line);
    const [
      stateName,
      constNoRaw,
      constName,
      partyNameRaw,
      candName,
      genderRaw,
      ageRaw,
      address,
      appDate,
      appStatus,
      relationName,
      photoLink,
      phaseRaw,
      pollingDate,
    ] = cols;

    const stateId = STATE_NAME_TO_ID[stateName] || 'IN';
    const constNo = parseInt(constNoRaw, 10) || 1;
    const pcId = `PC-${stateId}-${slugify(constName)}`;

    const reservationType = constName.toUpperCase().includes('(SC)')
      ? 'SC'
      : constName.toUpperCase().includes('(ST)')
      ? 'ST'
      : 'GENERAL';

    if (!constituenciesMap.has(pcId)) {
      constituenciesMap.set(pcId, {
        id: pcId,
        constituencyId: pcId,
        stateId,
        stateName,
        number: constNo,
        name: constName,
        constituencyType: 'PARLIAMENTARY',
        type: 'PARLIAMENTARY',
        reservationType,
        phase: parseInt(phaseRaw, 10) || 1,
        pollingDate: pollingDate || '2024-04-19',
        metadataSource: 'VERIFIED_OFFICIAL',
      });
    }

    const partyInfo = resolveCanonicalParty(partyNameRaw);

    if (!partiesMap.has(partyInfo.id)) {
      partiesMap.set(partyInfo.id, {
        id: partyInfo.id,
        partyId: partyInfo.id,
        name: partyInfo.name,
        partyName: partyInfo.name,
        abbreviation: partyInfo.abbreviation,
        isIndependent: partyInfo.isIndependent,
        symbolUrl: partyInfo.symbolUrl,
      });
    }

    const candidateId = `REAL-CAND-${stateId}-${String(constNo).padStart(3, '0')}-${String(rowIdx).padStart(5, '0')}`;
    const age = parseInt(ageRaw, 10) || 40;
    const gender = (genderRaw || 'male').toLowerCase().includes('female')
      ? 'Female'
      : (genderRaw || '').toLowerCase().includes('third')
      ? 'Other'
      : 'Male';

    candidatesList.push({
      id: candidateId,
      candidateId,
      electionId: 'LS-2024',
      electionType: 'LOK_SABHA',
      stateId,
      stateName,
      constituencyId: pcId,
      constituencyName: constName,
      constituencyNumber: constNo,
      partyId: partyInfo.id,
      partyName: partyInfo.name,
      partyAbbr: partyInfo.abbreviation,
      isIndependent: partyInfo.isIndependent,
      name: candName,
      fullName: candName,
      displayName: candName,
      gender,
      age,
      address: address || '',
      fatherOrHusbandName: relationName || '',
      photoUrl: photoLink || '',
      applicationDate: appDate || '',
      applicationStatus: appStatus || 'Accepted',
      approvalStatus: 'APPROVED',
      status: 'APPROVED',
      phase: parseInt(phaseRaw, 10) || 1,
      pollingDate: pollingDate || '',
      metadataSource: 'VERIFIED_OFFICIAL',
    });
  }

  console.log(`Processed ${candidatesList.length} candidates across ${constituenciesMap.size} Parliamentary Constituencies and ${partiesMap.size} Political Parties.`);

  // Ensure output directory exists
  const publicDir = path.resolve('public', 'data');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write public/data/real_candidates_2024.json
  const exportData = {
    generatedAt: new Date().toISOString(),
    electionYear: 2024,
    electionName: 'Lok Sabha General Elections 2024',
    totalCandidates: candidatesList.length,
    totalConstituencies: constituenciesMap.size,
    totalParties: partiesMap.size,
    constituencies: Array.from(constituenciesMap.values()),
    parties: Array.from(partiesMap.values()),
    candidates: candidatesList,
  };

  const outputPath = path.join(publicDir, 'real_candidates_2024.json');
  fs.writeFileSync(outputPath, JSON.stringify(exportData), 'utf8');
  console.log(`Saved JSON dataset to ${outputPath} (${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB)`);

  // 2. Also write constituencies_summary_2024.json
  const summaryPath = path.join(publicDir, 'constituencies_summary_2024.json');
  fs.writeFileSync(
    summaryPath,
    JSON.stringify({
      totalConstituencies: constituenciesMap.size,
      totalParties: partiesMap.size,
      constituencies: Array.from(constituenciesMap.values()),
      parties: Array.from(partiesMap.values()),
      candidateCountByConstituency: candidatesList.reduce((acc, c) => {
        acc[c.constituencyId] = (acc[c.constituencyId] || 0) + 1;
        return acc;
      }, {}),
    }),
    'utf8'
  );
  console.log(`Saved summary to ${summaryPath}`);
}

main().catch(console.error);
