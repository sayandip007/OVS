import { z } from 'zod';

export const updateSettingSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
  value: z.unknown(),
  expectedVersion: z.number().int().min(1, 'Expected version must be a positive integer'),
  changeReason: z
    .string()
    .trim()
    .min(3, 'Change reason must be at least 3 characters long')
    .max(500, 'Change reason cannot exceed 500 characters'),
});

export const bulkUpdateSettingsSchema = z.object({
  updates: z
    .array(
      z.object({
        key: z.string().min(1, 'Setting key is required'),
        value: z.unknown(),
        expectedVersion: z.number().int().min(1, 'Expected version must be a positive integer'),
      })
    )
    .min(1, 'At least one setting update must be specified'),
  changeReason: z
    .string()
    .trim()
    .min(3, 'Change reason must be at least 3 characters long')
    .max(500, 'Change reason cannot exceed 500 characters'),
});

export const rollbackSettingSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
  targetVersion: z.number().int().min(1, 'Target version must be a positive integer'),
  changeReason: z
    .string()
    .trim()
    .min(3, 'Change reason must be at least 3 characters long')
    .max(500, 'Change reason cannot exceed 500 characters'),
});

export const updateFeatureFlagSchema = z.object({
  isEnabled: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  targetRoles: z.array(z.string()).optional(),
  metadata: z.unknown().optional(),
  changeReason: z
    .string()
    .trim()
    .min(3, 'Change reason must be at least 3 characters long')
    .max(500, 'Change reason cannot exceed 500 characters'),
});

export const updateMaintenanceSchema = z
  .object({
    state: z.enum(['NORMAL', 'SCHEDULED_MAINTENANCE', 'MAINTENANCE_ACTIVE', 'READ_ONLY_MODE']),
    message: z.string().max(500).optional(),
    startAt: z.string().datetime().nullable().optional(),
    endAt: z.string().datetime().nullable().optional(),
    isEmergency: z.boolean().optional(),
    reason: z
      .string()
      .trim()
      .min(3, 'Maintenance transition reason must be at least 3 characters long')
      .max(500, 'Maintenance reason cannot exceed 500 characters'),
  })
  .superRefine((data, ctx) => {
    if (data.startAt && data.endAt) {
      const start = new Date(data.startAt).getTime();
      const end = new Date(data.endAt).getTime();
      if (end <= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endAt'],
          message: 'Scheduled maintenance end time must be strictly after start time.',
        });
      }
    }
  });
