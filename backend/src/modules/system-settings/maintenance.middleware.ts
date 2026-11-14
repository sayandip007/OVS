import type { Request, Response, NextFunction } from 'express';
import { MaintenanceService } from './maintenance.service.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

export function createMaintenanceMiddleware(
  maintenanceService?: MaintenanceService
) {
  const service =
    maintenanceService ??
    (process.env.NODE_ENV === 'test' ? null : new MaintenanceService());

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!service) {
        return next();
      }

      const url = req.originalUrl || req.url;

      // 1. Unconditionally allowed paths
      if (
        url.startsWith('/api/v1/health') ||
        url.startsWith('/api/v1/system/public-config') ||
        url.startsWith('/api/v1/admin/auth/login') ||
        url.startsWith('/api/v1/admin/auth/session') ||
        url.startsWith('/api/v1/admin/system/maintenance')
      ) {
        return next();
      }

      const status = await service.getCurrentStatus();

      // Set informational maintenance headers on all responses
      if (status.state === 'SCHEDULED_MAINTENANCE') {
        res.setHeader('X-Maintenance-Scheduled', 'true');
        if (status.startAt) res.setHeader('X-Maintenance-Start', status.startAt.toISOString());
        if (status.endAt) res.setHeader('X-Maintenance-End', status.endAt.toISOString());
      }

      // 2. ACTIVE MAINTENANCE MODE
      if (status.state === 'MAINTENANCE_ACTIVE') {
        // Allow authenticated super admins / national admins recovery access
        const authReq = req as AuthenticatedRequest;
        if (
          authReq.user?.userType === 'ADMIN' &&
          authReq.adminUser &&
          (authReq.adminUser.role === 'SUPER_ADMIN' || authReq.adminUser.role === 'NATIONAL_ADMIN')
        ) {
          res.setHeader('X-Maintenance-Mode-Bypass', 'admin-recovery');
          return next();
        }

        // Compute Retry-After in seconds
        let retryAfterSeconds = 300;
        if (status.endAt) {
          const diffSeconds = Math.max(
            30,
            Math.ceil((status.endAt.getTime() - Date.now()) / 1000)
          );
          retryAfterSeconds = Math.min(diffSeconds, 86400);
        }

        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(503).json({
          type: 'https://ovs.eci.gov.in/errors/maintenance-active',
          title: 'Service Maintenance In Progress',
          status: 503,
          detail:
            status.message ||
            'The voting system is undergoing scheduled maintenance. Please check back shortly.',
          instance: url,
          code: 'MAINTENANCE_ACTIVE',
          requestId: req.requestId || 'req_maintenance',
          timestamp: new Date().toISOString(),
          maintenance: {
            state: status.state,
            startAt: status.startAt?.toISOString() ?? null,
            endAt: status.endAt?.toISOString() ?? null,
            isEmergency: status.isEmergency,
            retryAfterSeconds,
          },
        });
        return;
      }

      // 3. READ-ONLY MODE
      if (status.state === 'READ_ONLY_MODE') {
        // Read methods allowed
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
          return next();
        }

        // Allow authenticated SUPER_ADMIN mutating operations (e.g. state management)
        const authReq = req as AuthenticatedRequest;
        if (
          authReq.user?.userType === 'ADMIN' &&
          authReq.adminUser &&
          authReq.adminUser.role === 'SUPER_ADMIN'
        ) {
          return next();
        }

        res.status(503).json({
          type: 'https://ovs.eci.gov.in/errors/read-only-mode',
          title: 'System In Read-Only Mode',
          status: 503,
          detail:
            status.message ||
            'The platform is operating in read-only mode for audit reconciliation. Mutations are temporarily disabled.',
          instance: url,
          code: 'READ_ONLY_MODE',
          requestId: req.requestId || 'req_read_only',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 4. Normal or Scheduled — proceed
      return next();
    } catch {
      // In case of maintenance probe error, proceed to prevent total outage
      return next();
    }
  };
}
