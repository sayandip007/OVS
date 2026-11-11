import type { Request, Response, NextFunction } from 'express';
import {
  ForbiddenProblemError,
  UnauthorizedProblemError,
} from '../../common/errors/problemDetails.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AdminAuditService } from './admin.audit.service.js';
import {
  evaluateJurisdictionAccess,
  getPermissionsForRole,
  roleHasPermission,
  type AdminPermission,
  type JurisdictionTarget,
} from './admin.permissions.js';

export function createAdminMiddleware(
  auditService: AdminAuditService = new AdminAuditService()
) {
  /**
   * Ensures the authenticated request belongs to an active ECI Administrator account.
   * Voters and unauthenticated callers are strictly rejected.
   */
  const requireAdminAuth = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return next(
          new UnauthorizedProblemError(
            'Administrator authentication is required to access this endpoint.'
          )
        );
      }

      if (authReq.user.userType !== 'ADMIN' || !authReq.adminUser) {
        await auditService
          .recordSecurityEvent({
            actorUserId: authReq.user.id,
            actorIdentifier: authReq.user.identifier,
            actionType: 'UNAUTHORIZED_ADMIN_PORTAL_ACCESS',
            domain: 'ADMIN_AUTH',
            targetEntityId: req.originalUrl,
            outcome: 'DENIED',
            requestId: req.requestId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { userType: authReq.user.userType },
          })
          .catch(() => {});

        return next(
          new ForbiddenProblemError(
            'Administrator credentials are required to access this resource.'
          )
        );
      }

      if (
        !authReq.user.isActive ||
        !authReq.adminUser.isActive ||
        authReq.adminUser.status !== 'ACTIVE'
      ) {
        return next(
          new ForbiddenProblemError(
            `Administrator account is ${authReq.adminUser.status.toLowerCase()}. Access is denied.`
          )
        );
      }

      authReq.adminPermissions = getPermissionsForRole(authReq.adminUser.role);
      next();
    } catch (err) {
      next(err);
    }
  };

  /**
   * Enforces centralized permission matrix checks (independent of jurisdiction checks).
   */
  const requirePermission = (...requiredPermissions: AdminPermission[]) => {
    return async (
      req: Request,
      _res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const authReq = req as AuthenticatedRequest;
        const admin = authReq.adminUser;

        if (!admin) {
          return next(
            new UnauthorizedProblemError('Administrator authentication is required.')
          );
        }

        const missing = requiredPermissions.filter(
          (perm) => !roleHasPermission(admin.role, perm)
        );

        if (missing.length > 0) {
          await auditService
            .recordSecurityEvent({
              adminUserId: admin.id,
              actorUserId: admin.userId,
              actorIdentifier: admin.officerCode,
              actorRole: admin.role,
              actionType: 'PERMISSION_DENIED',
              domain: 'RBAC',
              targetEntityId: req.originalUrl,
              outcome: 'DENIED',
              requestId: req.requestId,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              details: {
                method: req.method,
                missingPermissions: missing,
              },
            })
            .catch(() => {});

          return next(
            new ForbiddenProblemError(
              `Permission denied: Missing required administrative permission(s): ${missing.join(', ')}.`
            )
          );
        }

        next();
      } catch (err) {
        next(err);
      }
    };
  };

  /**
   * Enforces jurisdiction-level authorization separately from role permission checks.
   */
  const requireJurisdictionScope = (
    extractor: (req: Request) => JurisdictionTarget
  ) => {
    return async (
      req: Request,
      _res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const authReq = req as AuthenticatedRequest;
        const admin = authReq.adminUser;

        if (!admin) {
          return next(
            new UnauthorizedProblemError('Administrator authentication is required.')
          );
        }

        const target = extractor(req);
        const result = evaluateJurisdictionAccess(admin, target);

        if (!result.allowed) {
          await auditService
            .recordSecurityEvent({
              adminUserId: admin.id,
              actorUserId: admin.userId,
              actorIdentifier: admin.officerCode,
              actorRole: admin.role,
              actionType: 'JURISDICTION_SCOPE_VIOLATION',
              domain: 'RBAC_SCOPE',
              targetEntityId:
                target.electionId ?? target.stateId ?? target.constituencyId ?? req.originalUrl,
              outcome: 'DENIED',
              requestId: req.requestId,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              details: {
                method: req.method,
                target,
                reason: result.reason,
              },
            })
            .catch(() => {});

          return next(
            new ForbiddenProblemError(
              result.reason || 'Jurisdiction scope restriction violated.'
            )
          );
        }

        next();
      } catch (err) {
        next(err);
      }
    };
  };

  return {
    requireAdminAuth,
    requirePermission,
    requireJurisdictionScope,
  };
}
