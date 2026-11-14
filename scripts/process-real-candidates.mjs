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
  console.log('Processing real candidate_data.csv...');
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

    if (!constituenciesMap.has(pcId)) {
      constituenciesMap.set(pcId, {
        id: pcId,
        stateId,
        stateName,
        number: constNo,
        name: constName,
        phase: parseInt(phaseRaw, 10) || 1,
        pollingDate: pollingDate || '2024-04-19',
      });
    }

    const partyName = partyNameRaw || 'Independent';
    const isIndependent = partyName.toLowerCase() === 'independent';
    const partySlug = slugify(partyName).slice(0, 30);
    const partyId = isIndependent ? 'PARTY-IND' : `PARTY-${partySlug}`;

    let symbolUrl = '/assets/parties/ind.png';
    const lowerParty = partyName.toLowerCase();
    if (lowerParty.includes('bharatiya janata') || lowerParty === 'bjp') {
      symbolUrl = '/assets/parties/bjp.png';
    } else if (lowerParty.includes('national congress') || lowerParty === 'inc') {
      symbolUrl = '/assets/parties/inc.png';
    } else if (lowerParty.includes('aam aadmi') || lowerParty === 'aap') {
      symbolUrl = '/assets/parties/aap.svg';
    } else if (lowerParty.includes('trinamool') || lowerParty.includes('aitc')) {
      symbolUrl = '/assets/parties/tmc.png';
    } else if (lowerParty.includes('communist party') || lowerParty.includes('cpim')) {
      symbolUrl = '/assets/parties/cpim.png';
    } else if (lowerParty.includes('bahujan samaj') || lowerParty === 'bsp') {
      symbolUrl = '/assets/parties/bsp.png';
    } else if (lowerParty.includes('samajwadi party') || lowerParty === 'sp') {
      symbolUrl = '/assets/parties/sp.svg';
    } else if (lowerParty.includes('telugu desam') || lowerParty === 'tdp') {
      symbolUrl = '/assets/parties/tdp.png';
    } else if (lowerParty.includes('dravida munnetra') || lowerParty === 'dmk') {
      symbolUrl = '/assets/parties/dmk.svg';
    } else if (lowerParty.includes('anna dravida') || lowerParty.includes('aiadmk')) {
      symbolUrl = '/assets/parties/aiadmk.svg';
    } else if (lowerParty.includes('ysr') || lowerParty.includes('ysrcp')) {
      symbolUrl = '/assets/parties/ysrcp.svg';
    } else if (lowerParty.includes('shiv sena') || lowerParty.includes('shivsena')) {
      symbolUrl = '/assets/parties/ss.svg';
    } else if (lowerParty.includes('nationalist congress') || lowerParty === 'ncp') {
      symbolUrl = '/assets/parties/ncp.svg';
    } else if (lowerParty.includes('janata dal (united)') || lowerParty === 'jdu') {
      symbolUrl = '/assets/parties/jdu.svg';
    } else if (lowerParty.includes('rashtriya janata dal') || lowerParty === 'rjd') {
      symbolUrl = '/assets/parties/rjd.svg';
    } else if (lowerParty.includes('biju janata dal') || lowerParty === 'bjd') {
      symbolUrl = '/assets/parties/bjd.svg';
    } else if (lowerParty.includes('majlis') || lowerParty === 'aimim') {
      symbolUrl = '/assets/parties/aimim.svg';
    }

    if (!partiesMap.has(partyId)) {
      partiesMap.set(partyId, {
        id: partyId,
        name: partyName,
        abbreviation: isIndependent ? 'IND' : partySlug.slice(0, 10),
        isIndependent,
        symbolUrl,
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
      stateId,
      stateName,
      constituencyId: pcId,
      constituencyName: constName,
      constituencyNumber: constNo,
      partyId,
      partyName,
      isIndependent,
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
      phase: parseInt(phaseRaw, 10) || 1,
      pollingDate: pollingDate || '',
      metadataSource: 'VERIFIED_OFFICIAL',
    });
  }

  console.log(`Processed ${candidatesList.length} candidates across ${constituenciesMap.size} Parliamentary Constituencies!`);

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

  // 2. Also write an index summary file for fast initial dropdowns/filters
  const summaryPath = path.join(publicDir, 'constituencies_summary_2024.json');
  fs.writeFileSync(
    summaryPath,
    JSON.stringify({
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
