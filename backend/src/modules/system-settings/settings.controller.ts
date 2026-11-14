import type { Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service.js';
import { FeaturesService } from './features.service.js';
import { MaintenanceService } from './maintenance.service.js';
import { HealthDiagnosticsService } from './health.diagnostics.service.js';
import { sendSuccess } from '../../common/utils/response.js';
import {
  updateSettingSchema,
  bulkUpdateSettingsSchema,
  rollbackSettingSchema,
  updateFeatureFlagSchema,
  updateMaintenanceSchema,
} from './settings.schemas.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import type { SettingCategory } from '@prisma/client';
import type { BulkUpdateSettingsInput } from './settings.types.js';

export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService = new SettingsService(),
    private readonly featuresService: FeaturesService = new FeaturesService(),
    private readonly maintenanceService: MaintenanceService = new MaintenanceService(),
    private readonly diagnosticsService: HealthDiagnosticsService = new HealthDiagnosticsService()
  ) {}

  private getAuditMeta(req: Request) {
    const authReq = req as AuthenticatedRequest;
    return {
      adminUserId: authReq.adminUser?.id ?? authReq.user?.id,
      actorIdentifier: authReq.adminUser?.officerCode ?? authReq.user?.identifier,
      actorRole: authReq.adminUser?.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    };
  }

  // --- Settings Handlers ---

  listSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = req.query.category as SettingCategory | undefined;
      const settings = await this.settingsService.listSettings({ category, maskSensitive: true });
      sendSuccess(req, res, { settings });
    } catch (err) {
      next(err);
    }
  };

  getSetting = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.params.key ?? '');
      const setting = await this.settingsService.getSettingByKey(key, true);
      sendSuccess(req, res, { setting });
    } catch (err) {
      next(err);
    }
  };

  updateSetting = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.params.key ?? req.body.key ?? '');
      const parsed = updateSettingSchema.parse({
        ...req.body,
        key,
      });
      const updated = await this.settingsService.updateSetting(
        parsed.key,
        parsed.value,
        parsed.expectedVersion,
        parsed.changeReason,
        this.getAuditMeta(req)
      );
      sendSuccess(req, res, { setting: updated, message: 'Setting updated successfully.' });
    } catch (err) {
      next(err);
    }
  };

  bulkUpdateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = bulkUpdateSettingsSchema.parse(req.body);
      const updated = await this.settingsService.bulkUpdateSettings(
        parsed as BulkUpdateSettingsInput,
        this.getAuditMeta(req)
      );
      sendSuccess(req, res, {
        settings: updated,
        count: updated.length,
        message: 'All settings updated atomically.',
      });
    } catch (err) {
      next(err);
    }
  };

  rollbackSetting = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.params.key ?? req.body.key ?? '');
      const parsed = rollbackSettingSchema.parse({
        ...req.body,
        key,
      });
      const updated = await this.settingsService.rollbackSetting(
        parsed.key,
        parsed.targetVersion,
        parsed.changeReason,
        this.getAuditMeta(req)
      );
      sendSuccess(req, res, {
        setting: updated,
        message: `Setting '${parsed.key}' rolled back to version ${parsed.targetVersion}.`,
      });
    } catch (err) {
      next(err);
    }
  };

  getSettingHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.params.key ?? '');
      const history = await this.settingsService.getSettingHistory(key);
      sendSuccess(req, res, { history });
    } catch (err) {
      next(err);
    }
  };

  // --- Feature Flags Handlers ---

  listFeatureFlags = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const flags = await this.featuresService.listFeatureFlags();
      sendSuccess(req, res, { flags });
    } catch (err) {
      next(err);
    }
  };

  getFeatureFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.params.key ?? '');
      const flag = await this.featuresService.getFeatureFlag(key);
      sendSuccess(req, res, { flag });
    } catch (err) {
      next(err);
    }
  };

  updateFeatureFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.params.key ?? '');
      const parsed = updateFeatureFlagSchema.parse(req.body);
      const updated = await this.featuresService.updateFeatureFlag(
        key,
        parsed,
        this.getAuditMeta(req)
      );
      sendSuccess(req, res, { flag: updated, message: 'Feature flag updated successfully.' });
    } catch (err) {
      next(err);
    }
  };

  getFeatureFlagHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.params.key ?? '');
      const history = await this.featuresService.getFeatureFlagHistory(key);
      sendSuccess(req, res, { history });
    } catch (err) {
      next(err);
    }
  };

  // --- Maintenance Mode Handlers ---

  getMaintenanceStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const maintenance = await this.maintenanceService.getCurrentStatus();
      sendSuccess(req, res, { maintenance });
    } catch (err) {
      next(err);
    }
  };

  updateMaintenance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateMaintenanceSchema.parse(req.body);
      const updated = await this.maintenanceService.setMaintenanceState(
        parsed,
        this.getAuditMeta(req)
      );
      sendSuccess(req, res, {
        maintenance: updated,
        message: `Maintenance state updated to ${updated.state}.`,
      });
    } catch (err) {
      next(err);
    }
  };

  // --- Diagnostics Handler ---

  getDiagnostics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await this.diagnosticsService.getDiagnosticsReport();
      sendSuccess(req, res, { diagnostics: report });
    } catch (err) {
      next(err);
    }
  };

  // --- Public Config Handler ---

  getPublicConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [allSettings, allFlags, maintenance] = await Promise.all([
        this.settingsService.listSettings({ maskSensitive: true }),
        this.featuresService.listFeatureFlags(),
        this.maintenanceService.getCurrentStatus(),
      ]);

      const publicSettingsMap: Record<string, unknown> = {};
      for (const s of allSettings) {
        if (s.isPublic) {
          publicSettingsMap[s.key] = s.value;
        }
      }

      const featuresMap: Record<string, boolean> = {};
      for (const f of allFlags) {
        featuresMap[f.key] = f.isEnabled && f.rolloutPercentage > 0;
      }

      sendSuccess(req, res, {
        config: {
          siteName:
            (publicSettingsMap['platform.siteName'] as string) ||
            'Online Voting System (ECI Simulation)',
          tagline:
            (publicSettingsMap['platform.tagline'] as string) ||
            'Official Educational Simulation Platform of the Election Commission of India',
          maintenance: {
            state: maintenance.state,
            message: maintenance.message,
            startAt: maintenance.startAt?.toISOString() ?? null,
            endAt: maintenance.endAt?.toISOString() ?? null,
            isEmergency: maintenance.isEmergency,
          },
          features: featuresMap,
          publicSettings: publicSettingsMap,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
