import type { Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/utils/response.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { VotersService } from './voters.service.js';

export class VotersController {
  constructor(private readonly votersService: VotersService = new VotersService()) {}

  getMe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const profile = await this.votersService.getProfile(req.user!.id);
      sendSuccess(req, res, profile);
    } catch (err) {
      next(err);
    }
  };

  patchMe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await this.votersService.updateProfile(req.user!.id, req.body);
      sendSuccess(req, res, updated, {
        message: 'Voter profile updated successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  getMyConstituencies = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const constituencies = await this.votersService.getConstituencies(req.user!.id);
      sendSuccess(req, res, constituencies);
    } catch (err) {
      next(err);
    }
  };
}
