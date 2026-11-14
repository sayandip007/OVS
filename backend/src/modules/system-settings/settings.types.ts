import type { SettingCategory, SettingValueType, MaintenanceState } from '@prisma/client';

export interface SettingDefinition<T = unknown> {
  key: string;
  category: SettingCategory;
  valueType: SettingValueType;
  defaultValue: T;
  description: string;
  isEditable: boolean;
  isSensitive: boolean;
  isPublic: boolean;
  requiresRestart: boolean;
  validate?: (value: T) => { valid: boolean; error?: string };
}

export interface SettingItemResponse {
  key: string;
  category: SettingCategory;
  valueType: SettingValueType;
  value: unknown;
  defaultValue: unknown;
  description: string;
  isEditable: boolean;
  isSensitive: boolean;
  isPublic: boolean;
  requiresRestart: boolean;
  version: number;
  updatedByAdminId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingHistoryItem {
  id: string;
  settingKey: string;
  previousValue: string | null;
  newValue: string;
  changeReason: string;
  version: number;
  adminId: string | null;
  createdAt: Date;
}

export interface UpdateSettingInput {
  key: string;
  value: unknown;
  expectedVersion: number;
  changeReason: string;
}

export interface BulkUpdateSettingsInput {
  updates: Array<{
    key: string;
    value: unknown;
    expectedVersion: number;
  }>;
  changeReason: string;
}

export interface RollbackSettingInput {
  key: string;
  targetVersion: number;
  changeReason: string;
}

export interface FeatureFlagDefinition {
  key: string;
  description: string;
  defaultEnabled: boolean;
  defaultRollout: number;
  defaultRoles: string[];
}

export interface FeatureFlagResponse {
  key: string;
  description: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  targetRoles: string[];
  metadata: unknown;
  updatedByAdminId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateFeatureFlagInput {
  isEnabled?: boolean;
  rolloutPercentage?: number;
  targetRoles?: string[];
  metadata?: unknown;
  changeReason: string;
}

export interface MaintenanceStatusResponse {
  id: string;
  state: MaintenanceState;
  message: string;
  startAt: Date | null;
  endAt: Date | null;
  isEmergency: boolean;
  reason: string | null;
  activatedByAdminId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateMaintenanceInput {
  state: MaintenanceState;
  message?: string;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  isEmergency?: boolean;
  reason: string;
}

export interface PublicPlatformConfig {
  siteName: string;
  systemTagline: string;
  maintenance: {
    state: MaintenanceState;
    message: string;
    startAt: string | null;
    endAt: string | null;
  };
  features: Record<string, boolean>;
  publicSettings: Record<string, unknown>;
}

export interface SystemDiagnosticsReport {
  timestamp: string;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
  database: {
    status: 'UP' | 'DOWN';
    latencyMs: number;
    pendingDeliveries: number;
    failedDeliveries: number;
    totalElections: number;
    activeElections: number;
  };
  maintenance: {
    state: MaintenanceState;
    isEmergency: boolean;
  };
}
