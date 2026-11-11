import type { Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/utils/response.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { extractSessionToken } from '../auth/auth.middleware.js';
import { SessionService } from '../auth/session.service.js';
import { AdminService, type RequestAuditContext } from './admin.service.js';

function getAuditContext(req: AuthenticatedRequest): RequestAuditContext {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly sessionService: SessionService
  ) {}

  login = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { identifier, password } = req.body;
      const existingToken = extractSessionToken(req);

      const result = await this.adminService.loginAdmin(
        identifier,
        password,
        getAuditContext(req),
        existingToken
      );

      this.sessionService.setSessionCookie(res, result.sessionToken);

      sendSuccess(
        req,
        res,
        {
          admin: result.admin,
          csrfToken: result.csrfToken,
        },
        {
          message: 'Administrator authentication successful.',
        }
      );
    } catch (err) {
      next(err);
    }
  };

  logout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await this.adminService.logout(
        req.adminUser!,
        req.sessionToken,
        getAuditContext(req)
      );
      this.sessionService.clearSessionCookie(res);

      sendSuccess(req, res, {
        message: 'Successfully signed out of administrator console.',
      });
    } catch (err) {
      next(err);
    }
  };

  logoutAll = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const revokedCount = await this.adminService.logoutAll(
        req.adminUser!,
        getAuditContext(req)
      );
      this.sessionService.clearSessionCookie(res);

      sendSuccess(req, res, {
        revokedCount,
        message: `Successfully revoked ${revokedCount} active administrator session(s).`,
      });
    } catch (err) {
      next(err);
    }
  };

  getMe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const profile = await this.adminService.getMyAdminProfile(req.adminUser!.id);
      sendSuccess(
        req,
        res,
        {
          admin: profile,
          csrfToken: req.csrfToken,
        },
        {
          csrfToken: req.csrfToken,
        }
      );
    } catch (err) {
      next(err);
    }
  };

  updateMe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await this.adminService.updateMyProfile(
        req.adminUser!,
        req.body,
        getAuditContext(req)
      );
      sendSuccess(req, res, updated, {
        message: 'Administrator profile updated.',
      });
    } catch (err) {
      next(err);
    }
  };

  listSessions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const sessions = await this.adminService.listSessions(
        req.adminUser!,
        req.sessionId
      );
      sendSuccess(req, res, sessions);
    } catch (err) {
      next(err);
    }
  };

  revokeSession = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const sessionId = String(req.params.sessionId || '');
      await this.adminService.revokeSession(
        req.adminUser!,
        sessionId,
        getAuditContext(req)
      );
      sendSuccess(req, res, {
        message: `Session '${sessionId}' has been revoked.`,
      });
    } catch (err) {
      next(err);
    }
  };

  listUsers = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = (req.validated?.query ?? req.query) as any;
      const result = await this.adminService.listAdminUsers(
        req.adminUser!,
        {
          page: Number(query.page) || 1,
          limit: Number(query.limit) || 25,
          role: query.role,
          status: query.status,
          stateId: query.stateId,
          search: query.search,
        },
        getAuditContext(req)
      );

      sendSuccess(req, res, result.items, {
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  };

  getUserById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const admin = await this.adminService.getAdminUserById(
        req.adminUser!,
        String(req.params.id),
        getAuditContext(req)
      );
      sendSuccess(req, res, admin);
    } catch (err) {
      next(err);
    }
  };

  createUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const created = await this.adminService.createAdminUser(
        req.adminUser!,
        req.body,
        getAuditContext(req)
      );
      sendSuccess(
        req,
        res,
        created,
        {
          message: `Administrator '${created.officerCode}' provisioned successfully.`,
        },
        201
      );
    } catch (err) {
      next(err);
    }
  };

  updateUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await this.adminService.updateAdminUser(
        req.adminUser!,
        String(req.params.id),
        req.body,
        getAuditContext(req)
      );
      sendSuccess(req, res, updated, {
        message: 'Administrator account updated.',
      });
    } catch (err) {
      next(err);
    }
  };

  suspendUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await this.adminService.suspendAdminUser(
        req.adminUser!,
        String(req.params.id),
        req.body,
        getAuditContext(req)
      );
      sendSuccess(req, res, updated, {
        message: `Administrator account status set to ${updated.status}. All active sessions revoked.`,
      });
    } catch (err) {
      next(err);
    }
  };

  activateUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await this.adminService.activateAdminUser(
        req.adminUser!,
        String(req.params.id),
        req.body,
        getAuditContext(req)
      );
      sendSuccess(req, res, updated, {
        message: 'Administrator account reactivated.',
      });
    } catch (err) {
      next(err);
    }
  };

  getPermissions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const registry = this.adminService.getPermissionRegistry(req.adminUser!);
      sendSuccess(req, res, registry);
    } catch (err) {
      next(err);
    }
  };

  getUserScopes = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const scopes = await this.adminService.getAdminScopes(
        req.adminUser!,
        String(req.params.id),
        getAuditContext(req)
      );
      sendSuccess(req, res, scopes);
    } catch (err) {
      next(err);
    }
  };

  updateUserScopes = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await this.adminService.updateAdminScopes(
        req.adminUser!,
        String(req.params.id),
        req.body,
        getAuditContext(req)
      );
      sendSuccess(req, res, updated, {
        message: 'Administrator jurisdiction scopes updated.',
      });
    } catch (err) {
      next(err);
    }
  };

  listAuditLogs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = (req.validated?.query ?? req.query) as any;
      const result = await this.adminService.listAuditLogs(
        req.adminUser!,
        {
          page: Number(query.page) || 1,
          limit: Number(query.limit) || 50,
          domain: query.domain,
          actionType: query.actionType,
          outcome: query.outcome,
          actorRole: query.actorRole,
          stateId: query.stateId,
          electionId: query.electionId,
        },
        getAuditContext(req)
      );

      sendSuccess(req, res, result.items, {
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  };
}
