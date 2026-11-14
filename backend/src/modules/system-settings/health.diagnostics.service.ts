import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma, checkDatabaseReadiness } from '../../config/database.js';
import type { SystemDiagnosticsReport } from './settings.types.js';
import { MaintenanceService } from './maintenance.service.js';

export class HealthDiagnosticsService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly maintenanceService: MaintenanceService = new MaintenanceService(prisma),
    private readonly readinessCheck: () => Promise<{ connected: boolean; latencyMs: number }> = checkDatabaseReadiness
  ) {}

  async getDiagnosticsReport(): Promise<SystemDiagnosticsReport> {
    const mem = process.memoryUsage();
    const dbReadiness = await this.readinessCheck();

    let pendingDeliveries = 0;
    let failedDeliveries = 0;
    let totalElections = 0;
    let activeElections = 0;

    if (dbReadiness.connected) {
      try {
        const [pendingCount, failedCount, electionsCount, activeCount] = await Promise.all([
          this.prisma.notificationDelivery.count({
            where: { status: { in: ['PENDING', 'PROCESSING'] } },
          }),
          this.prisma.notificationDelivery.count({
            where: { status: 'FAILED' },
          }),
          this.prisma.election.count(),
          this.prisma.election.count({
            where: { status: 'POLLING_ACTIVE' },
          }),
        ]);
        pendingDeliveries = pendingCount;
        failedDeliveries = failedCount;
        totalElections = electionsCount;
        activeElections = activeCount;
      } catch {
        // partial query failure
      }
    }

    const maintenanceStatus = await this.maintenanceService.getCurrentStatus();

    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    if (!dbReadiness.connected) {
      overallStatus = 'CRITICAL';
    } else if (
      maintenanceStatus.state === 'MAINTENANCE_ACTIVE' ||
      dbReadiness.latencyMs > 500 ||
      failedDeliveries > 50
    ) {
      overallStatus = 'DEGRADED';
    }

    return {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      service: 'ovs-backend',
      version: '1.0.0-phase-8.12',
      environment: process.env.NODE_ENV ?? 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      database: {
        status: dbReadiness.connected ? 'UP' : 'DOWN',
        latencyMs: dbReadiness.latencyMs,
        pendingDeliveries,
        failedDeliveries,
        totalElections,
        activeElections,
      },
      maintenance: {
        state: maintenanceStatus.state,
        isEmergency: maintenanceStatus.isEmergency,
      },
    };
  }
}
