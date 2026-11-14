import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';

interface RequestMetricEntry {
  method: string;
  status: number;
  route: string;
  durationSec: number;
}

export function sanitizeRoutePath(rawPath: string): string {
  if (!rawPath) return '/';
  const clean = rawPath.split('?')[0] || '/';
  return clean
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[A-Z0-9_-]+-[0-9]{4}/g, '/:electionId')
    .replace(/\/(WB|MH|DL|UP|TN|KA)-[A-Z0-9_-]+/g, '/:constituencyId');
}

export class MetricsRegistry {
  private requestCounts = new Map<string, number>();
  private requestDurationSum = new Map<string, number>();
  private requestDurationBuckets = new Map<string, Map<number, number>>();
  private customCounters = new Map<string, number>();
  private customGauges = new Map<string, number>();

  // Standard latency buckets in seconds
  private readonly buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  resetForTesting(): void {
    this.requestCounts.clear();
    this.requestDurationSum.clear();
    this.requestDurationBuckets.clear();
    this.customCounters.clear();
    this.customGauges.clear();
  }

  recordHttpRequest(entry: RequestMetricEntry): void {
    const route = sanitizeRoutePath(entry.route);
    const key = `method="${entry.method}",status="${entry.status}",route="${route}"`;

    // Increment request count
    this.requestCounts.set(key, (this.requestCounts.get(key) ?? 0) + 1);

    // Sum duration
    this.requestDurationSum.set(key, (this.requestDurationSum.get(key) ?? 0) + entry.durationSec);

    // Buckets
    let bucketMap = this.requestDurationBuckets.get(key);
    if (!bucketMap) {
      bucketMap = new Map();
      for (const b of this.buckets) bucketMap.set(b, 0);
      this.requestDurationBuckets.set(key, bucketMap);
    }

    for (const b of this.buckets) {
      if (entry.durationSec <= b) {
        bucketMap.set(b, (bucketMap.get(b) ?? 0) + 1);
      }
    }
  }

  incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    const key = labelStr ? `${name}{${labelStr}}` : name;
    this.customCounters.set(key, (this.customCounters.get(key) ?? 0) + value);
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    const key = labelStr ? `${name}{${labelStr}}` : name;
    this.customGauges.set(key, value);
  }

  async exportPrometheusText(prisma?: PrismaClient): Promise<string> {
    const lines: string[] = [];

    // Process & Memory Metrics
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    lines.push('# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.');
    lines.push('# TYPE process_cpu_seconds_total counter');
    lines.push(`process_cpu_seconds_total ${(cpu.user + cpu.system) / 1000000}`);

    lines.push('# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.');
    lines.push('# TYPE process_cpu_user_seconds_total counter');
    lines.push(`process_cpu_user_seconds_total ${(cpu.user) / 1000000}`);

    lines.push('# HELP process_cpu_system_seconds_total Total system CPU time spent in seconds.');
    lines.push('# TYPE process_cpu_system_seconds_total counter');
    lines.push(`process_cpu_system_seconds_total ${(cpu.system) / 1000000}`);

    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${mem.rss}`);

    lines.push('# HELP nodejs_heap_size_used_bytes Process heap memory used in bytes.');
    lines.push('# TYPE nodejs_heap_size_used_bytes gauge');
    lines.push(`nodejs_heap_size_used_bytes ${mem.heapUsed}`);

    lines.push('# HELP nodejs_heap_size_total_bytes Process heap memory allocated in bytes.');
    lines.push('# TYPE nodejs_heap_size_total_bytes gauge');
    lines.push(`nodejs_heap_size_total_bytes ${mem.heapTotal}`);

    lines.push('# HELP process_uptime_seconds The process uptime in seconds.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${Math.floor(process.uptime())}`);

    // Build Info
    lines.push('# HELP ovs_build_info Build and runtime version information.');
    lines.push('# TYPE ovs_build_info gauge');
    lines.push(`ovs_build_info{version="1.0.0",node_env="${process.env.NODE_ENV || 'development'}"} 1`);

    // HTTP Request Metrics (prefixed with ovs_)
    lines.push('# HELP ovs_http_requests_total Total number of HTTP requests processed.');
    lines.push('# TYPE ovs_http_requests_total counter');
    for (const [labels, count] of this.requestCounts.entries()) {
      lines.push(`ovs_http_requests_total{${labels}} ${count}`);
    }

    lines.push('# HELP ovs_http_request_duration_seconds HTTP request latencies in seconds.');
    lines.push('# TYPE ovs_http_request_duration_seconds histogram');
    for (const [labels, count] of this.requestCounts.entries()) {
      const sum = this.requestDurationSum.get(labels) ?? 0;
      const bucketMap = this.requestDurationBuckets.get(labels);
      if (bucketMap) {
        for (const [le, bCount] of bucketMap.entries()) {
          lines.push(`ovs_http_request_duration_seconds_bucket{${labels},le="${le}"} ${bCount}`);
        }
      }
      lines.push(`ovs_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${count}`);
      lines.push(`ovs_http_request_duration_seconds_sum{${labels}} ${sum.toFixed(6)}`);
      lines.push(`ovs_http_request_duration_seconds_count{${labels}} ${count}`);
    }

    // Database & Queue Metrics (sampled safely only when active client provided and outside unit test)
    if (prisma && process.env.NODE_ENV !== 'test') {
      try {
        const [pendingDeliveries, failedDeliveries, activeElections] = await Promise.all([
          prisma.notificationDelivery.count({
            where: { status: { in: ['PENDING', 'PROCESSING'] } },
          }),
          prisma.notificationDelivery.count({
            where: { status: 'FAILED' },
          }),
          prisma.election.count({
            where: { status: 'POLLING_ACTIVE' },
          }),
        ]);

        lines.push('# HELP ovs_notification_outbox_pending_count Number of queued notification deliveries.');
        lines.push('# TYPE ovs_notification_outbox_pending_count gauge');
        lines.push(`ovs_notification_outbox_pending_count ${pendingDeliveries}`);

        lines.push('# HELP ovs_notification_outbox_failed_count Total failed notification deliveries.');
        lines.push('# TYPE ovs_notification_outbox_failed_count gauge');
        lines.push(`ovs_notification_outbox_failed_count ${failedDeliveries}`);

        lines.push('# HELP ovs_active_polling_elections_count Number of currently active elections in polling state.');
        lines.push('# TYPE ovs_active_polling_elections_count gauge');
        lines.push(`ovs_active_polling_elections_count ${activeElections}`);
      } catch {
        // If DB probe fails, suppress to avoid breaking metrics scrape
      }
    }

    // Custom Counters & Gauges
    for (const [key, val] of this.customCounters.entries()) {
      lines.push(`${key} ${val}`);
    }
    for (const [key, val] of this.customGauges.entries()) {
      lines.push(`${key} ${val}`);
    }

    return lines.join('\n') + '\n';
  }
}

export const metricsRegistry = new MetricsRegistry();

/**
 * Express middleware to observe HTTP request counts and durations.
 */
export function createMetricsMiddleware(registry = metricsRegistry) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Avoid scraping loop metrics
    if (req.path === '/metrics' || req.path === '/api/v1/metrics') {
      return next();
    }

    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationSec = Number(end - start) / 1e9;
      const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;

      registry.recordHttpRequest({
        method: req.method,
        status: res.statusCode,
        route,
        durationSec,
      });
    });

    next();
  };
}

/**
 * Express handler to serve Prometheus metrics.
 */
export function createMetricsHandler(registry = metricsRegistry, prisma = defaultPrisma) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const text = await registry.exportPrometheusText(prisma);
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(text);
    } catch (err) {
      res.status(500).send('# Error collecting metrics\n');
    }
  };
}

/**
 * Convenience export for recording a metric observation directly.
 */
export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationSec: number
): void {
  metricsRegistry.recordHttpRequest({ method, route, status, durationSec });
}

/**
 * Convenience export to render the Prometheus text exposition synchronously or asynchronously.
 */
export async function generatePrometheusMetrics(prisma?: PrismaClient): Promise<string> {
  return metricsRegistry.exportPrometheusText(prisma);
}

/**
 * Reset metric counters for isolated test assertions.
 */
export function resetMetricsForTesting(): void {
  metricsRegistry.resetForTesting();
}
