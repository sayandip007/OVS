import type { PrismaClient, AdminRole, AdminActionLog, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import { buildPaginationMeta, type PaginationMeta } from '../../common/utils/response.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'token',
  'sessiontoken',
  'csrftoken',
  'otp',
  'otphash',
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'x-session-token',
]);

/**
 * Recursively redacts any restricted secrets before persisting to `admin_action_logs`.
 */
export function sanitizeAuditDetails(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditDetails(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeAuditDetails(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export interface RecordSecurityAuditInput {
  adminUserId?: string | null;
  actorUserId?: string | null;
  actorIdentifier?: string | null;
  actorRole?: AdminRole | null;
  actionType: string;
  domain: string;
  targetEntityId: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}

export interface AuditLogFilter {
  page: number;
  limit: number;
  domain?: string;
  actionType?: string;
  outcome?: 'SUCCESS' | 'FAILURE' | 'DENIED';
  actorRole?: AdminRole;
  allowedStateIds?: string[] | null;
  allowedElectionIds?: string[] | null;
}

/**
 * Append-only administrative security & operations audit service.
 * Strictly provides creation & filtered read operations (no update/delete APIs).
 */
export class AdminAuditService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async recordSecurityEvent(input: RecordSecurityAuditInput): Promise<void> {
    const sanitizedDetails = (sanitizeAuditDetails(input.details ?? {}) ??
      {}) as Prisma.InputJsonValue;

    await this.prisma.adminActionLog.create({
      data: {
        adminUserId: input.adminUserId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorIdentifier: input.actorIdentifier ?? null,
        actorRole: input.actorRole ?? null,
        actionType: input.actionType,
        domain: input.domain,
        targetEntityId: input.targetEntityId,
        outcome: input.outcome,
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        details: sanitizedDetails,
      },
    });
  }

  async listAuditLogs(filter: AuditLogFilter): Promise<{
    items: (AdminActionLog & {
      adminUser: {
        id: string;
        officerCode: string;
        fullName: string;
        role: AdminRole;
        assignedStateId: string | null;
      } | null;
    })[];
    pagination: PaginationMeta;
  }> {
    const where: Prisma.AdminActionLogWhereInput = {};

    if (filter.domain) where.domain = filter.domain;
    if (filter.actionType) where.actionType = filter.actionType;
    if (filter.outcome) where.outcome = filter.outcome;
    if (filter.actorRole) where.actorRole = filter.actorRole;

    if (filter.allowedStateIds && filter.allowedStateIds.length > 0) {
      where.OR = [
        { adminUser: { assignedStateId: { in: filter.allowedStateIds } } },
        {
          adminUser: {
            assignedStateScopes: {
              some: { stateId: { in: filter.allowedStateIds } },
            },
          },
        },
      ];
    }

    const skip = (filter.page - 1) * filter.limit;

    const [total, items] = await Promise.all([
      this.prisma.adminActionLog.count({ where }),
      this.prisma.adminActionLog.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: { timestamp: 'desc' },
        include: {
          adminUser: {
            select: {
              id: true,
              officerCode: true,
              fullName: true,
              role: true,
              assignedStateId: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: buildPaginationMeta(filter.page, filter.limit, total),
    };
  }
}
