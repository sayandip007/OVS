import { PrismaClient, SettingCategory, SettingValueType, type Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import { SYSTEM_SETTINGS_REGISTRY } from './settings.registry.js';
import type {
  SettingItemResponse,
  SettingHistoryItem,
  BulkUpdateSettingsInput,
  PublicPlatformConfig,
} from './settings.types.js';
import {
  ConflictProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';

export class SettingsService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly auditService: AdminAuditService = new AdminAuditService(prisma)
  ) {}

  /**
   * Helper to serialize typed value to string for DB storage.
   */
  private serializeValue(value: unknown, valueType: SettingValueType): string {
    if (value === null || value === undefined) return '';
    if (valueType === 'BOOLEAN') return String(Boolean(value));
    if (valueType === 'NUMBER') return String(Number(value));
    if (valueType === 'JSON') return typeof value === 'string' ? value : JSON.stringify(value);
    return String(value);
  }

  /**
   * Helper to parse string value from DB to typed value.
   */
  private parseValue(raw: string, valueType: SettingValueType): unknown {
    if (valueType === 'BOOLEAN') {
      return raw.toLowerCase() === 'true' || raw === '1';
    }
    if (valueType === 'NUMBER') {
      const num = Number(raw);
      return Number.isNaN(num) ? 0 : num;
    }
    if (valueType === 'JSON') {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  }

  /**
   * Masks sensitive values for general admin viewing if marked sensitive.
   */
  private maskSensitive(value: unknown, isSensitive: boolean): unknown {
    if (!isSensitive) return value;
    return '********';
  }

  /**
   * Ensures all predefined registry settings exist in database idempotently.
   */
  async ensureSettingsInitialized(): Promise<void> {
    for (const [key, def] of Object.entries(SYSTEM_SETTINGS_REGISTRY)) {
      const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
      if (!existing) {
        const serializedDefault = this.serializeValue(def.defaultValue, def.valueType);
        await this.prisma.systemSetting.create({
          data: {
            key: def.key,
            category: def.category,
            valueType: def.valueType,
            value: serializedDefault,
            defaultValue: serializedDefault,
            description: def.description,
            isEditable: def.isEditable,
            isSensitive: def.isSensitive,
            isPublic: def.isPublic,
            requiresRestart: def.requiresRestart,
            version: 1,
          },
        });
      }
    }
  }

  /**
   * Lists all system settings, optionally filtered by category.
   */
  async listSettings(options?: {
    category?: SettingCategory;
    maskSensitive?: boolean;
  }): Promise<SettingItemResponse[]> {
    await this.ensureSettingsInitialized();

    const where: Prisma.SystemSettingWhereInput = {};
    if (options?.category) {
      where.category = options.category;
    }

    const rows = await this.prisma.systemSetting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const shouldMask = options?.maskSensitive !== false;

    return rows.map((row) => {
      const parsedValue = this.parseValue(row.value, row.valueType);
      const parsedDefault = this.parseValue(row.defaultValue, row.valueType);
      return {
        key: row.key,
        category: row.category,
        valueType: row.valueType,
        value: shouldMask ? this.maskSensitive(parsedValue, row.isSensitive) : parsedValue,
        defaultValue: parsedDefault,
        description: row.description,
        isEditable: row.isEditable,
        isSensitive: row.isSensitive,
        isPublic: row.isPublic,
        requiresRestart: row.requiresRestart,
        version: row.version,
        updatedByAdminId: row.updatedByAdminId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  /**
   * Retrieves a single setting by key.
   */
  async getSettingByKey(key: string, maskSensitive = true): Promise<SettingItemResponse> {
    await this.ensureSettingsInitialized();

    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!row) {
      throw new NotFoundProblemError('SystemSetting', key);
    }

    const parsedValue = this.parseValue(row.value, row.valueType);
    const parsedDefault = this.parseValue(row.defaultValue, row.valueType);

    return {
      key: row.key,
      category: row.category,
      valueType: row.valueType,
      value: maskSensitive ? this.maskSensitive(parsedValue, row.isSensitive) : parsedValue,
      defaultValue: parsedDefault,
      description: row.description,
      isEditable: row.isEditable,
      isSensitive: row.isSensitive,
      isPublic: row.isPublic,
      requiresRestart: row.requiresRestart,
      version: row.version,
      updatedByAdminId: row.updatedByAdminId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Updates a single setting with optimistic concurrency check (HTTP 409) and version history.
   */
  async updateSetting(
    key: string,
    value: unknown,
    expectedVersion: number,
    changeReason: string,
    auditMeta?: {
      adminUserId?: string;
      actorIdentifier?: string;
      actorRole?: any;
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    }
  ): Promise<SettingItemResponse> {
    await this.ensureSettingsInitialized();

    const def = SYSTEM_SETTINGS_REGISTRY[key];
    if (!def) {
      throw new NotFoundProblemError('SystemSetting', key);
    }
    if (!def.isEditable) {
      throw new ValidationProblemError(`System setting '${key}' is read-only and cannot be modified.`);
    }

    // Custom registry validation
    if (def.validate) {
      const check = def.validate(value as never);
      if (!check.valid) {
        throw new ValidationProblemError(
          check.error ?? `Invalid value provided for setting '${key}'`
        );
      }
    }

    const current = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!current) {
      throw new NotFoundProblemError('SystemSetting', key);
    }

    // Optimistic concurrency check
    if (current.version !== expectedVersion) {
      throw new ConflictProblemError(
        `Optimistic concurrency violation: Setting '${key}' has been modified by another administrator (expected version ${expectedVersion}, but current database version is ${current.version}). Please reload and reapply your changes.`,
        'SETTING_VERSION_CONFLICT'
      );
    }

    const nextVersion = current.version + 1;
    const serializedNewValue = this.serializeValue(value, current.valueType);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedRow = await tx.systemSetting.update({
        where: { key },
        data: {
          value: serializedNewValue,
          version: nextVersion,
          updatedByAdminId: auditMeta?.adminUserId ?? null,
        },
      });

      await tx.systemSettingHistory.create({
        data: {
          settingKey: key,
          previousValue: current.value,
          newValue: serializedNewValue,
          changeReason,
          version: nextVersion,
          adminId: auditMeta?.adminUserId ?? null,
        },
      });

      return updatedRow;
    });

    // Audit logging
    await this.auditService.recordSecurityEvent({
      actionType: 'SYSTEM_SETTING_UPDATE',
      domain: 'SYSTEM_SETTINGS',
      targetEntityId: key,
      outcome: 'SUCCESS',
      adminUserId: auditMeta?.adminUserId,
      actorIdentifier: auditMeta?.actorIdentifier,
      actorRole: auditMeta?.actorRole,
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
      requestId: auditMeta?.requestId,
      details: {
        settingKey: key,
        previousVersion: current.version,
        newVersion: nextVersion,
        changeReason,
        previousValue: def.isSensitive ? '********' : current.value,
        newValue: def.isSensitive ? '********' : serializedNewValue,
      },
    });

    const parsedValue = this.parseValue(updated.value, updated.valueType);
    const parsedDefault = this.parseValue(updated.defaultValue, updated.valueType);

    return {
      key: updated.key,
      category: updated.category,
      valueType: updated.valueType,
      value: parsedValue,
      defaultValue: parsedDefault,
      description: updated.description,
      isEditable: updated.isEditable,
      isSensitive: updated.isSensitive,
      isPublic: updated.isPublic,
      requiresRestart: updated.requiresRestart,
      version: updated.version,
      updatedByAdminId: updated.updatedByAdminId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Bulk updates settings atomically.
   * If any single setting fails validation or version match, the entire batch is aborted.
   */
  async bulkUpdateSettings(
    input: BulkUpdateSettingsInput,
    auditMeta?: {
      adminUserId?: string;
      actorIdentifier?: string;
      actorRole?: any;
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    }
  ): Promise<SettingItemResponse[]> {
    await this.ensureSettingsInitialized();

    // 1. Preflight validation of all items upfront
    const validatedItems: Array<{
      key: string;
      def: (typeof SYSTEM_SETTINGS_REGISTRY)[string];
      serializedValue: string;
      expectedVersion: number;
      current: any;
    }> = [];

    for (const item of input.updates) {
      const def = SYSTEM_SETTINGS_REGISTRY[item.key];
      if (!def) {
        throw new NotFoundProblemError('SystemSetting', item.key);
      }
      if (!def.isEditable) {
        throw new ValidationProblemError(`System setting '${item.key}' is read-only.`);
      }
      if (def.validate) {
        const check = def.validate(item.value as never);
        if (!check.valid) {
          throw new ValidationProblemError(
            check.error ?? `Invalid value for setting '${item.key}'`
          );
        }
      }

      const current = await this.prisma.systemSetting.findUnique({ where: { key: item.key } });
      if (!current) {
        throw new NotFoundProblemError('SystemSetting', item.key);
      }

      if (current.version !== item.expectedVersion) {
        throw new ConflictProblemError(
          `Optimistic concurrency violation on setting '${item.key}': expected version ${item.expectedVersion}, current version is ${current.version}. Entire bulk batch aborted without modification.`,
          'SETTING_VERSION_CONFLICT'
        );
      }

      const serializedValue = this.serializeValue(item.value, current.valueType);
      validatedItems.push({
        key: item.key,
        def,
        serializedValue,
        expectedVersion: item.expectedVersion,
        current,
      });
    }

    // 2. Atomic transaction update
    const updatedRows = await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of validatedItems) {
        const nextVersion = item.current.version + 1;
        const row = await tx.systemSetting.update({
          where: { key: item.key },
          data: {
            value: item.serializedValue,
            version: nextVersion,
            updatedByAdminId: auditMeta?.adminUserId ?? null,
          },
        });

        await tx.systemSettingHistory.create({
          data: {
            settingKey: item.key,
            previousValue: item.current.value,
            newValue: item.serializedValue,
            changeReason: input.changeReason,
            version: nextVersion,
            adminId: auditMeta?.adminUserId ?? null,
          },
        });

        results.push(row);
      }
      return results;
    });

    // 3. Audit logging
    await this.auditService.recordSecurityEvent({
      actionType: 'SYSTEM_SETTINGS_BULK_UPDATE',
      domain: 'SYSTEM_SETTINGS',
      targetEntityId: `BULK_${validatedItems.length}`,
      outcome: 'SUCCESS',
      adminUserId: auditMeta?.adminUserId,
      actorIdentifier: auditMeta?.actorIdentifier,
      actorRole: auditMeta?.actorRole,
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
      requestId: auditMeta?.requestId,
      details: {
        updatedKeys: validatedItems.map((v) => v.key),
        changeReason: input.changeReason,
      },
    });

    return updatedRows.map((updated) => ({
      key: updated.key,
      category: updated.category,
      valueType: updated.valueType,
      value: this.parseValue(updated.value, updated.valueType),
      defaultValue: this.parseValue(updated.defaultValue, updated.valueType),
      description: updated.description,
      isEditable: updated.isEditable,
      isSensitive: updated.isSensitive,
      isPublic: updated.isPublic,
      requiresRestart: updated.requiresRestart,
      version: updated.version,
      updatedByAdminId: updated.updatedByAdminId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }));
  }

  /**
   * Rollback setting to a prior version, appending a new version record.
   */
  async rollbackSetting(
    key: string,
    targetVersion: number,
    changeReason: string,
    auditMeta?: {
      adminUserId?: string;
      actorIdentifier?: string;
      actorRole?: any;
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    }
  ): Promise<SettingItemResponse> {
    const current = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!current) {
      throw new NotFoundProblemError('SystemSetting', key);
    }

    const historyRecord = await this.prisma.systemSettingHistory.findFirst({
      where: {
        settingKey: key,
        version: targetVersion,
      },
    });

    if (!historyRecord) {
      throw new NotFoundProblemError('SystemSettingHistory', `${key}@v${targetVersion}`);
    }

    const nextVersion = current.version + 1;
    const rollbackReason = `Rollback to version ${targetVersion}: ${changeReason}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.systemSetting.update({
        where: { key },
        data: {
          value: historyRecord.newValue,
          version: nextVersion,
          updatedByAdminId: auditMeta?.adminUserId ?? null,
        },
      });

      await tx.systemSettingHistory.create({
        data: {
          settingKey: key,
          previousValue: current.value,
          newValue: historyRecord.newValue,
          changeReason: rollbackReason,
          version: nextVersion,
          adminId: auditMeta?.adminUserId ?? null,
        },
      });

      return row;
    });

    await this.auditService.recordSecurityEvent({
      actionType: 'SYSTEM_SETTING_ROLLBACK',
      domain: 'SYSTEM_SETTINGS',
      targetEntityId: key,
      outcome: 'SUCCESS',
      adminUserId: auditMeta?.adminUserId,
      actorIdentifier: auditMeta?.actorIdentifier,
      actorRole: auditMeta?.actorRole,
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
      requestId: auditMeta?.requestId,
      details: {
        settingKey: key,
        targetVersion,
        newVersion: nextVersion,
        changeReason: rollbackReason,
      },
    });

    return {
      key: updated.key,
      category: updated.category,
      valueType: updated.valueType,
      value: this.parseValue(updated.value, updated.valueType),
      defaultValue: this.parseValue(updated.defaultValue, updated.valueType),
      description: updated.description,
      isEditable: updated.isEditable,
      isSensitive: updated.isSensitive,
      isPublic: updated.isPublic,
      requiresRestart: updated.requiresRestart,
      version: updated.version,
      updatedByAdminId: updated.updatedByAdminId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Retrieves version history for a setting.
   */
  async getSettingHistory(key: string): Promise<SettingHistoryItem[]> {
    const history = await this.prisma.systemSettingHistory.findMany({
      where: { settingKey: key },
      orderBy: { version: 'desc' },
      take: 50,
    });

    return history.map((h) => ({
      id: h.id,
      settingKey: h.settingKey,
      previousValue: h.previousValue,
      newValue: h.newValue,
      changeReason: h.changeReason,
      version: h.version,
      adminId: h.adminId,
      createdAt: h.createdAt,
    }));
  }
}
