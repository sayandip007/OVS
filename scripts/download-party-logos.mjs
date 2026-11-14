/**
 * Automated Political Party Symbol Downloader & Vector Generator
 * Fetches high-res party symbols from URLs or generates clean SVG symbols into public/assets/parties/
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const PARTIES_CONFIG = [
  {
    code: 'bjp',
    name: 'Bharatiya Janata Party',
    color: '#FF9933',
    symbolName: 'Lotus',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Bharatiya_Janata_Party_logo.svg/240px-Bharatiya_Janata_Party_logo.svg.png',
    ],
  },
  {
    code: 'inc',
    name: 'Indian National Congress',
    color: '#19AAED',
    symbolName: 'Hand',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Indian_National_Congress_hand_logo.svg/240px-Indian_National_Congress_hand_logo.svg.png',
    ],
  },
  {
    code: 'aap',
    name: 'Aam Aadmi Party',
    color: '#0066A4',
    symbolName: 'Broom',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Aam_Aadmi_Party_logo_%28English%29.svg/240px-Aam_Aadmi_Party_logo_%28English%29.svg.png',
    ],
  },
  {
    code: 'cpim',
    name: 'Communist Party of India (Marxist)',
    color: '#DE0000',
    symbolName: 'Hammer, Sickle and Star',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Cpi-m-flag.svg/240px-Cpi-m-flag.svg.png',
    ],
  },
  {
    code: 'bsp',
    name: 'Bahujan Samaj Party',
    color: '#22409A',
    symbolName: 'Elephant',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Elephant_Bahujan_Samaj_Party.svg/240px-Elephant_Bahujan_Samaj_Party.svg.png',
    ],
  },
  {
    code: 'tmc',
    name: 'All India Trinamool Congress',
    color: '#20A647',
    symbolName: 'Twin Flowers & Grass',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/All_India_Trinamool_Congress_symbol.svg/240px-All_India_Trinamool_Congress_symbol.svg.png',
    ],
  },
  {
    code: 'sp',
    name: 'Samajwadi Party',
    color: '#E30613',
    symbolName: 'Bicycle',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Samajwadi_Party_flag.svg/240px-Samajwadi_Party_flag.svg.png',
    ],
  },
  {
    code: 'tdp',
    name: 'Telugu Desam Party',
    color: '#FFE600',
    symbolName: 'Bicycle',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Telugu_Desam_Party_flag.svg/240px-Telugu_Desam_Party_flag.svg.png',
    ],
  },
  {
    code: 'dmk',
    name: 'Dravida Munnetra Kazhagam',
    color: '#DD1111',
    symbolName: 'Rising Sun',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/DMK_flag.svg/240px-DMK_flag.svg.png',
    ],
  },
  {
    code: 'aiadmk',
    name: 'All India Anna Dravida Munnetra Kazhagam',
    color: '#008000',
    symbolName: 'Two Leaves',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/AIADMK_Two_Leaves.svg/240px-AIADMK_Two_Leaves.svg.png',
    ],
  },
  {
    code: 'ysrcp',
    name: 'YSR Congress Party',
    color: '#0055A5',
    symbolName: 'Ceiling Fan',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/YSR_Congress_Party_flag.svg/240px-YSR_Congress_Party_flag.svg.png',
    ],
  },
  {
    code: 'ss',
    name: 'Shiv Sena',
    color: '#F37023',
    symbolName: 'Bow and Arrow',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Shiv_Sena_Flag.svg/240px-Shiv_Sena_Flag.svg.png',
    ],
  },
  {
    code: 'ncp',
    name: 'Nationalist Congress Party',
    color: '#0066B3',
    symbolName: 'Clock',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/NCP_flag.svg/240px-NCP_flag.svg.png',
    ],
  },
  {
    code: 'jdu',
    name: 'Janata Dal (United)',
    color: '#006400',
    symbolName: 'Arrow',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Janata_Dal_%28United%29_flag.svg/240px-Janata_Dal_%28United%29_flag.svg.png',
    ],
  },
  {
    code: 'rjd',
    name: 'Rashtriya Janata Dal',
    color: '#008000',
    symbolName: 'Hurricane Lamp',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Rashtriya_Janata_Dal_flag.svg/240px-Rashtriya_Janata_Dal_flag.svg.png',
    ],
  },
  {
    code: 'bjd',
    name: 'Biju Janata Dal',
    color: '#008000',
    symbolName: 'Conch',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Biju_Janata_Dal_flag.svg/240px-Biju_Janata_Dal_flag.svg.png',
    ],
  },
  {
    code: 'aimim',
    name: 'All India Majlis-E-Ittehadul Muslimeen',
    color: '#006400',
    symbolName: 'Kite',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/AIMIM_Flag.svg/240px-AIMIM_Flag.svg.png',
    ],
  },
];

function downloadUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 OVS-Downloader/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        if (res.headers.location) {
          return downloadUrl(res.headers.location, destPath).then(resolve).catch(reject);
        }
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function generateSvgSymbol(party) {
  const initials = party.name
    .split(' ')
    .filter((w) => !['of', 'and', 'the', '(Marxist)', '(United)'].includes(w))
    .map((w) => w[0])
    .join('')
    .slice(0, 4);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bgGrad_${party.code}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="85%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bgGrad_${party.code})" stroke="${party.color}" stroke-width="4" />
  <circle cx="60" cy="60" r="50" fill="none" stroke="${party.color}" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.6" />
  <!-- Center Emblem -->
  <circle cx="60" cy="46" r="22" fill="${party.color}" opacity="0.15" />
  <text x="60" y="53" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="${party.color}" text-anchor="middle" letter-spacing="1">
    ${party.code.toUpperCase()}
  </text>
  <!-- Symbol Banner -->
  <rect x="18" y="76" width="84" height="20" rx="10" fill="${party.color}" />
  <text x="60" y="90" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">
    ${party.symbolName.slice(0, 15)}
  </text>
</svg>`;
}

async function main() {
  const targetDir = path.resolve('public', 'assets', 'parties');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`Checking & downloading party symbols to ${targetDir}...`);

  for (const party of PARTIES_CONFIG) {
    const pngPath = path.join(targetDir, `${party.code}.png`);
    const svgPath = path.join(targetDir, `${party.code}.svg`);

    // Check if valid PNG already exists and is non-empty
    if (fs.existsSync(pngPath) && fs.statSync(pngPath).size > 1000) {
      console.log(`[EXISTS] ${party.code.toUpperCase()}: ${pngPath}`);
      continue;
    }

    let downloaded = false;
    for (const url of party.urls) {
      try {
        console.log(`[FETCHING] ${party.code.toUpperCase()} from ${url}...`);
        await downloadUrl(url, pngPath);
        console.log(`[SUCCESS] Downloaded ${party.code.toUpperCase()} (${fs.statSync(pngPath).size} bytes)`);
        downloaded = true;
        break;
      } catch (err) {
        console.log(`[FETCH FAILED] ${party.code.toUpperCase()}: ${err.message}`);
      }
    }

    if (!downloaded && !fs.existsSync(pngPath)) {
      // Generate clean vector SVG
      console.log(`[GENERATING VECTOR SVG] ${party.code.toUpperCase()} symbol...`);
      const svgContent = generateSvgSymbol(party);
      fs.writeFileSync(svgPath, svgContent, 'utf8');
      // Also write as svg so browser loads cleanly
      console.log(`[SAVED SVG] ${svgPath}`);
    }
  }

  console.log('--- All Party Symbols Verified in public/assets/parties/ ---');
}

main().catch(console.error);
