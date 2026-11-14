import { MaintenanceState, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import type {
  MaintenanceStatusResponse,
  UpdateMaintenanceInput,
} from './settings.types.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';

export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly auditService: AdminAuditService = new AdminAuditService(prisma)
  ) {}

  /**
   * Returns current active maintenance configuration.
   * Creates initial record with NORMAL state if none exists.
   */
  async getCurrentStatus(): Promise<MaintenanceStatusResponse> {
    let latest = await this.prisma.maintenanceSchedule.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      latest = await this.prisma.maintenanceSchedule.create({
        data: {
          state: 'NORMAL',
          message: 'System operational.',
          isEmergency: false,
        },
      });
    }

    // Auto-evaluate SCHEDULED_MAINTENANCE window
    const now = new Date();
    if (latest.state === 'SCHEDULED_MAINTENANCE') {
      if (latest.startAt && now >= latest.startAt) {
        if (!latest.endAt || now < latest.endAt) {
          // Window has arrived; transition to ACTIVE
          latest = await this.prisma.maintenanceSchedule.update({
            where: { id: latest.id },
            data: { state: 'MAINTENANCE_ACTIVE' },
          });
        }
      }
    } else if (latest.state === 'MAINTENANCE_ACTIVE' && latest.endAt && now >= latest.endAt) {
      // Maintenance window elapsed; return to NORMAL
      latest = await this.prisma.maintenanceSchedule.update({
        where: { id: latest.id },
        data: { state: 'NORMAL' },
      });
    }

    return {
      id: latest.id,
      state: latest.state,
      message: latest.message,
      startAt: latest.startAt,
      endAt: latest.endAt,
      isEmergency: latest.isEmergency,
      reason: latest.reason,
      activatedByAdminId: latest.activatedByAdminId,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    };
  }

  /**
   * Sets new maintenance state or schedules maintenance window.
   */
  async setMaintenanceState(
    input: UpdateMaintenanceInput,
    auditMeta?: {
      adminUserId?: string;
      actorIdentifier?: string;
      actorRole?: any;
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    }
  ): Promise<MaintenanceStatusResponse> {
    const startAtDate = input.startAt ? new Date(input.startAt) : null;
    const endAtDate = input.endAt ? new Date(input.endAt) : null;

    const record = await this.prisma.maintenanceSchedule.create({
      data: {
        state: input.state,
        message: input.message ?? 'System maintenance in progress. Please check back later.',
        startAt: startAtDate,
        endAt: endAtDate,
        isEmergency: input.isEmergency ?? false,
        reason: input.reason,
        activatedByAdminId: auditMeta?.adminUserId ?? null,
      },
    });

    await this.auditService.recordSecurityEvent({
      actionType: 'MAINTENANCE_STATE_TRANSITION',
      domain: 'MAINTENANCE',
      targetEntityId: record.id,
      outcome: 'SUCCESS',
      adminUserId: auditMeta?.adminUserId,
      actorIdentifier: auditMeta?.actorIdentifier,
      actorRole: auditMeta?.actorRole,
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
      requestId: auditMeta?.requestId,
      details: {
        newState: input.state,
        message: record.message,
        startAt: startAtDate?.toISOString() ?? null,
        endAt: endAtDate?.toISOString() ?? null,
        isEmergency: record.isEmergency,
        reason: input.reason,
      },
    });

    return {
      id: record.id,
      state: record.state,
      message: record.message,
      startAt: record.startAt,
      endAt: record.endAt,
      isEmergency: record.isEmergency,
      reason: record.reason,
      activatedByAdminId: record.activatedByAdminId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
