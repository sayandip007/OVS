import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import { DEFAULT_FEATURE_FLAGS } from './settings.registry.js';
import type {
  FeatureFlagResponse,
  UpdateFeatureFlagInput,
} from './settings.types.js';
import { NotFoundProblemError } from '../../common/errors/problemDetails.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';

export class FeaturesService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly auditService: AdminAuditService = new AdminAuditService(prisma)
  ) {}

  /**
   * Idempotently seeds default feature flags.
   */
  async ensureFeatureFlagsInitialized(): Promise<void> {
    for (const [key, def] of Object.entries(DEFAULT_FEATURE_FLAGS)) {
      const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
      if (!existing) {
        await this.prisma.featureFlag.create({
          data: {
            key: def.key,
            description: def.description,
            isEnabled: def.defaultEnabled,
            rolloutPercentage: def.defaultRollout,
            targetRoles: def.defaultRoles,
          },
        });
      }
    }
  }

  /**
   * Lists all feature flags.
   */
  async listFeatureFlags(): Promise<FeatureFlagResponse[]> {
    await this.ensureFeatureFlagsInitialized();

    const flags = await this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });

    return flags.map((f) => ({
      key: f.key,
      description: f.description,
      isEnabled: f.isEnabled,
      rolloutPercentage: f.rolloutPercentage,
      targetRoles: f.targetRoles,
      metadata: f.metadata,
      updatedByAdminId: f.updatedByAdminId,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  /**
   * Retrieves single feature flag.
   */
  async getFeatureFlag(key: string): Promise<FeatureFlagResponse> {
    await this.ensureFeatureFlagsInitialized();

    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) {
      throw new NotFoundProblemError('FeatureFlag', key);
    }

    return {
      key: flag.key,
      description: flag.description,
      isEnabled: flag.isEnabled,
      rolloutPercentage: flag.rolloutPercentage,
      targetRoles: flag.targetRoles,
      metadata: flag.metadata,
      updatedByAdminId: flag.updatedByAdminId,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
    };
  }

  /**
   * Updates feature flag state and records history.
   */
  async updateFeatureFlag(
    key: string,
    input: UpdateFeatureFlagInput,
    auditMeta?: {
      adminUserId?: string;
      actorIdentifier?: string;
      actorRole?: any;
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    }
  ): Promise<FeatureFlagResponse> {
    await this.ensureFeatureFlagsInitialized();

    const current = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!current) {
      throw new NotFoundProblemError('FeatureFlag', key);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.featureFlag.update({
        where: { key },
        data: {
          isEnabled: input.isEnabled !== undefined ? input.isEnabled : current.isEnabled,
          rolloutPercentage:
            input.rolloutPercentage !== undefined
              ? input.rolloutPercentage
              : current.rolloutPercentage,
          targetRoles:
            input.targetRoles !== undefined ? input.targetRoles : current.targetRoles,
          metadata:
            input.metadata !== undefined
              ? (input.metadata as any)
              : current.metadata,
          updatedByAdminId: auditMeta?.adminUserId ?? null,
        },
      });

      await tx.featureFlagHistory.create({
        data: {
          flagKey: key,
          wasEnabled: current.isEnabled,
          isEnabled: next.isEnabled,
          rolloutPercentage: next.rolloutPercentage,
          changeReason: input.changeReason,
          adminId: auditMeta?.adminUserId ?? null,
        },
      });

      return next;
    });

    await this.auditService.recordSecurityEvent({
      actionType: 'FEATURE_FLAG_UPDATE',
      domain: 'FEATURE_FLAGS',
      targetEntityId: key,
      outcome: 'SUCCESS',
      adminUserId: auditMeta?.adminUserId,
      actorIdentifier: auditMeta?.actorIdentifier,
      actorRole: auditMeta?.actorRole,
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
      requestId: auditMeta?.requestId,
      details: {
        flagKey: key,
        previousState: {
          isEnabled: current.isEnabled,
          rolloutPercentage: current.rolloutPercentage,
        },
        newState: {
          isEnabled: updated.isEnabled,
          rolloutPercentage: updated.rolloutPercentage,
        },
        changeReason: input.changeReason,
      },
    });

    return {
      key: updated.key,
      description: updated.description,
      isEnabled: updated.isEnabled,
      rolloutPercentage: updated.rolloutPercentage,
      targetRoles: updated.targetRoles,
      metadata: updated.metadata,
      updatedByAdminId: updated.updatedByAdminId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Evaluates feature flag with fallback and fail-closed security.
   */
  async isFeatureEnabled(
    key: string,
    context?: { actorRole?: string; userId?: string }
  ): Promise<boolean> {
    try {
      const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
      if (!flag) {
        // Fall back to registry default if unseeded, else fail-closed
        const def = DEFAULT_FEATURE_FLAGS[key];
        return def ? def.defaultEnabled : false;
      }

      if (!flag.isEnabled) {
        return false;
      }

      if (flag.rolloutPercentage >= 100) {
        return true;
      }

      if (context?.actorRole && flag.targetRoles.includes(context.actorRole)) {
        return true;
      }

      if (context?.userId && flag.rolloutPercentage > 0) {
        let hash = 0;
        for (let i = 0; i < context.userId.length; i++) {
          hash = (hash * 31 + context.userId.charCodeAt(i)) % 100;
        }
        return Math.abs(hash) < flag.rolloutPercentage;
      }

      return flag.rolloutPercentage > 0;
    } catch {
      return false; // Fail-closed
    }
  }

  /**
   * Retrieves change history for a feature flag.
   */
  async getFeatureFlagHistory(key: string) {
    return this.prisma.featureFlagHistory.findMany({
      where: { flagKey: key },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
