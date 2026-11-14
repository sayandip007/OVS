import fs from 'fs';
import readline from 'readline';

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

async function analyze() {
  const fileStream = fs.createReadStream('candidate_data.csv', { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let header = null;
  const states = new Set();
  const constituencies = new Set();
  const parties = new Map();
  const statusCounts = new Map();
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    count++;
    const cols = parseCsvLine(line);
    const [state, constNo, constituency, party, name, gender, age, address, appDate, appStatus] = cols;
    if (state) states.add(state);
    if (constituency) constituencies.add(`${state} - ${constituency}`);
    if (party) parties.set(party, (parties.get(party) || 0) + 1);
    if (appStatus) statusCounts.set(appStatus, (statusCounts.get(appStatus) || 0) + 1);
  }

  console.log('Total Candidates:', count);
  console.log('Unique States count:', states.size);
  console.log('States list:', Array.from(states).sort());
  console.log('Unique Constituencies count:', constituencies.size);
  console.log('Unique Parties count:', parties.size);
  console.log('Application Status counts:', Object.fromEntries(statusCounts));

  // Top 15 parties by candidate count
  const sortedParties = Array.from(parties.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('Top 15 Parties:', sortedParties);
}

analyze().catch(console.error);
