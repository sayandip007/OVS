import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.types.js';
import type { AuthService } from './auth.service.js';
import type { SessionService } from './session.service.js';
import {
  ForbiddenProblemError,
  NotFoundProblemError,
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
      res.status(201).json({
        data: user,
        meta: {
          message: 'Voter registration successful. You can now log in via simulated OTP verification.',
        },
      });
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

      res.status(200).json({
        data: result,
      });
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
      const result = await this.authService.verifyOtp(
        challengeId,
        otp,
        req.headers['user-agent'],
        req.ip
      );

      // Set HttpOnly session cookie
      this.sessionService.setSessionCookie(res, result.sessionToken);

      res.status(200).json({
        data: {
          user: result.user,
          csrfToken: result.csrfToken,
        },
        meta: {
          message: 'Authentication successful. Active session established.',
        },
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
      res.status(200).json({
        data: req.user,
        meta: {
          csrfToken: req.csrfToken,
        },
      });
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
      res.status(200).json({
        data: {
          csrfToken,
        },
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
      const sessions = await this.authService.listUserSessions(
        req.user!.id,
        req.sessionId
      );
      res.status(200).json({
        data: sessions,
      });
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
      res.status(200).json({
        data: {
          message: `Session '${sessionId}' has been revoked.`,
        },
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

      res.status(200).json({
        data: {
          message: 'Successfully logged out.',
        },
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

      res.status(200).json({
        data: {
          message: `Successfully revoked ${revokedCount} active session(s).`,
        },
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

      const identifier = String(req.params.identifier || '');
      const otp = this.authService['otpService'].getProvider().getLastOtp?.(identifier);

      if (!otp) {
        throw new NotFoundProblemError('Development OTP for identifier', identifier);
      }

      res.status(200).json({
        data: {
          identifier,
          otp,
          note: 'This development inspection endpoint is strictly disabled in production builds.',
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
