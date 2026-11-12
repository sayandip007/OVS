import type { Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/utils/response.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import type { VotingService } from './voting.service.js';

export class VotingController {
  constructor(private readonly service: VotingService) {}

  listVoterElections = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await this.service.listVoterElections(req.user!.id);
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  getVoterElectionDetail = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const data = await this.service.getVoterElectionDetail(
        req.user!.id,
        electionId
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  getVoterElectionEligibility = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const data = await this.service.getVoterElectionEligibility(
        req.user!.id,
        electionId
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  getBallot = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const data = await this.service.getBallot(req.user!.id, electionId);
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  confirmParticipation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const data = await this.service.confirmParticipation(
        req.user!.id,
        electionId
      );
      sendSuccess(req, res, data, undefined, 201);
    } catch (err) {
      next(err);
    }
  };

  listParticipationHistory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await this.service.listParticipationHistory(req.user!.id);
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  getParticipationForElection = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const data = await this.service.getParticipationForElection(
        req.user!.id,
        electionId
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  // Admin participation aggregate handlers
  getAdminParticipationSummary = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const data = await this.service.getAdminParticipationSummary(
        req.adminUser!,
        electionId
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  getAdminParticipationByConstituency = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const data = await this.service.getAdminParticipationByConstituency(
        req.adminUser!,
        electionId
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  getAdminParticipationTimeline = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const data = await this.service.getAdminParticipationTimeline(
        req.adminUser!,
        electionId
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };
}
