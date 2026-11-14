// ==============================================================================
// OVS Synthetic Performance & Capacity Smoke Test
// ==============================================================================
// Zero-dependency Node.js benchmark measuring concurrency, latency percentiles,
// and throughput (RPS) against core public and health endpoints.

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:5000';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '10', 10);
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '100', 10);

const TARGET_ENDPOINTS = [
  '/api/v1/health',
  '/api/v1/system/public-config',
  '/api/v1/elections',
  '/metrics',
];

export function calculatePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

async function sendRequest(url) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const startTime = process.hrtime.bigint();

    const req = client.get(url, (res) => {
      res.resume(); // Consume stream
      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;
        resolve({
          statusCode: res.statusCode || 0,
          durationMs,
          success: (res.statusCode || 0) < 400,
        });
      });
    });

    req.on('error', (err) => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      resolve({
        statusCode: 0,
        durationMs,
        success: false,
        error: err.message,
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        statusCode: 408,
        durationMs: 5000,
        success: false,
        error: 'Timeout',
      });
    });
  });
}

export async function runBenchmark({
  targetUrl = TARGET_URL,
  totalRequests = TOTAL_REQUESTS,
  concurrency = CONCURRENCY,
  endpoints = TARGET_ENDPOINTS,
  sendRequestFn = sendRequest,
} = {}) {
  console.log(`[INFO] Starting OVS Performance Smoke Test`);
  console.log(`  - Target URL:     ${targetUrl}`);
  console.log(`  - Total Requests: ${totalRequests}`);
  console.log(`  - Concurrency:    ${concurrency}`);
  console.log(`  - Endpoints:      ${endpoints.join(', ')}`);

  const results = [];
  const startGlobal = process.hrtime.bigint();

  let completed = 0;
  let activeInFlight = 0;
  let requestIndex = 0;

  return new Promise((resolve) => {
    function launchNext() {
      if (completed >= totalRequests) {
        const endGlobal = process.hrtime.bigint();
        const totalDurationSec = Number(endGlobal - startGlobal) / 1_000_000_000;
        
        const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
        const successes = results.filter((r) => r.success).length;
        const failures = totalRequests - successes;
        const rps = totalRequests / (totalDurationSec || 1);

        const summary = {
          totalRequests,
          successes,
          failures,
          totalDurationSec: parseFloat(totalDurationSec.toFixed(3)),
          rps: parseFloat(rps.toFixed(1)),
          minMs: parseFloat((durations[0] || 0).toFixed(2)),
          maxMs: parseFloat((durations[durations.length - 1] || 0).toFixed(2)),
          meanMs: parseFloat((durations.reduce((a, b) => a + b, 0) / (durations.length || 1)).toFixed(2)),
          p50Ms: parseFloat(calculatePercentile(durations, 50).toFixed(2)),
          p90Ms: parseFloat(calculatePercentile(durations, 90).toFixed(2)),
          p95Ms: parseFloat(calculatePercentile(durations, 95).toFixed(2)),
          p99Ms: parseFloat(calculatePercentile(durations, 99).toFixed(2)),
        };

        console.log('\n=============================================');
        console.log('         OVS BENCHMARK REPORT               ');
        console.log('=============================================');
        console.log(`Completed in:    ${summary.totalDurationSec}s`);
        console.log(`Throughput:      ${summary.rps} req/sec`);
        console.log(`Success Rate:    ${((successes / totalRequests) * 100).toFixed(1)}% (${successes}/${totalRequests})`);
        if (failures > 0) {
          console.log(`Sample failure:`, results.find((r) => !r.success));
        }
        console.log(`Latencies:`);
        console.log(`  - Min:         ${summary.minMs} ms`);
        console.log(`  - Mean:        ${summary.meanMs} ms`);
        console.log(`  - p50 (Median):${summary.p50Ms} ms`);
        console.log(`  - p95:         ${summary.p95Ms} ms`);
        console.log(`  - p99:         ${summary.p99Ms} ms`);
        console.log(`  - Max:         ${summary.maxMs} ms`);
        console.log('=============================================\n');

        resolve(summary);
        return;
      }

      while (activeInFlight < concurrency && requestIndex < totalRequests) {
        const ep = endpoints[requestIndex % endpoints.length];
        const fullUrl = `${targetUrl.replace(/\/$/, '')}${ep}`;
        requestIndex++;
        activeInFlight++;

        sendRequestFn(fullUrl).then((res) => {
          results.push(res);
          activeInFlight--;
          completed++;
          launchNext();
        });
      }
    }

    launchNext();
  });
}

// If executed directly as CLI script
if (process.argv[1]?.endsWith('smoke-perf.mjs')) {
  runBenchmark().then((summary) => {
    if (summary.failures > 0 && process.env.STRICT_PERF === 'true') {
      process.exit(1);
    }
  });
}
