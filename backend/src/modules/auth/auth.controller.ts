import type { Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/utils/response.js';
import type { AuthenticatedRequest } from './auth.types.js';
import type { AuthService } from './auth.service.js';
import type { SessionService } from './session.service.js';
import { extractSessionToken } from './auth.middleware.js';
import {
  ForbiddenProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService
  ) {}

  register = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await this.authService.registerVoter(req.body);
      const profile = user.voterProfile;
      sendSuccess(
        req,
        res,
        {
          id: profile?.id ?? user.id,
          userId: user.id,
          epicNumber: profile?.epicNumber ?? user.identifier,
          fullName: profile?.fullName ?? '',
          role: 'VOTER',
          accountStatus: 'UNVERIFIED',
          user,
        },
        {
          message:
            'Voter registration successful. You can now log in via simulated OTP verification.',
        },
        201
      );
    } catch (err) {
      next(err);
    }
  };

  requestOtp = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { identifier, phoneNumber } = req.body;
      const result = await this.authService.requestOtp(
        identifier,
        phoneNumber,
        req.ip,
        req.headers['user-agent']
      );

      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  verifyOtp = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { challengeId, otp } = req.body;
      const existingToken = extractSessionToken(req);
      const result = await this.authService.verifyOtp(
        challengeId,
        otp,
        req.headers['user-agent'],
        req.ip,
        existingToken
      );

      // Set HttpOnly session cookie
      this.sessionService.setSessionCookie(res, result.sessionToken);

      sendSuccess(
        req,
        res,
        {
          user: result.user,
          voterProfile: result.user.voterProfile,
          csrfToken: result.csrfToken,
        },
        {
          message: 'Authentication successful. Active session established.',
        }
      );
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
      sendSuccess(
        req,
        res,
        {
          ...req.user,
          user: req.user,
        },
        {
          csrfToken: req.csrfToken,
        }
      );
    } catch (err) {
      next(err);
    }
  };

  getCsrf = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const csrfToken = this.authService.getCsrfToken(req.sessionToken);
      sendSuccess(req, res, { csrfToken });
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
      const sessions = await this.authService.listUserSessions(
        req.user!.id,
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
      await this.authService.revokeSession(req.user!.id, sessionId);
      sendSuccess(req, res, {
        message: `Session '${sessionId}' has been revoked.`,
      });
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
      if (req.sessionToken) {
        await this.authService.logout(req.sessionToken);
      }
      this.sessionService.clearSessionCookie(res);

      sendSuccess(req, res, {
        message: 'Successfully logged out.',
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
      const revokedCount = await this.authService.logoutAll(req.user!.id);
      this.sessionService.clearSessionCookie(res);

      sendSuccess(req, res, {
        revokedCount,
        message: `Successfully revoked ${revokedCount} active session(s).`,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Safe development-only inspector to view the generated OTP for automated testing.
   * Strictly disabled in production.
   */
  devInspectOtp = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenProblemError('Development inspector is disabled in production.');
      }

      const identifier = String(
        req.params.identifier || req.query.identifier || ''
      ).trim();

      if (!identifier) {
        throw new ValidationProblemError('Identifier parameter is required.');
      }

      const otp = this.authService['otpService'].getProvider().getLastOtp?.(identifier);

      if (!otp) {
        throw new NotFoundProblemError('Development OTP for identifier', identifier);
      }

      sendSuccess(req, res, {
        identifier,
        otp,
        note: 'This development inspection endpoint is strictly disabled in production builds.',
      });
    } catch (err) {
      next(err);
    }
  };
}
