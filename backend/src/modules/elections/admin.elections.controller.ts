import type { Response, NextFunction } from 'express';
import { buildPaginationMeta, sendSuccess } from '../../common/utils/response.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import type { AdminElectionsService } from './admin.elections.service.js';

function getContext(req: AuthenticatedRequest) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

export class AdminElectionsController {
  constructor(private readonly service: AdminElectionsService) {}

  getSummary = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const summary = await this.service.getSummary(req.adminUser!);
      sendSuccess(req, res, summary);
    } catch (err) {
      next(err);
    }
  };

  listElections = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = (req.validated?.query ?? req.query) as any;
      const result = await this.service.listElections(req.adminUser!, query);
      sendSuccess(req, res, result.items, {
        pagination: buildPaginationMeta(
          Number(query.page ?? 1),
          Number(query.limit ?? 20),
          result.total
        ),
      });
    } catch (err) {
      next(err);
    }
  };

  getElectionById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const election = await this.service.getElectionById(
        req.adminUser!,
        electionId,
        getContext(req)
      );
      sendSuccess(req, res, election);
    } catch (err) {
      next(err);
    }
  };

  createElection = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const election = await this.service.createElection(
        req.adminUser!,
        req.body,
        getContext(req)
      );
      sendSuccess(
        req,
        res,
        election,
        { message: `Election '${election.id}' created successfully.` },
        201
      );
    } catch (err) {
      next(err);
    }
  };

  updateElection = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const updated = await this.service.updateElectionMetadata(
        req.adminUser!,
        electionId,
        req.body,
        getContext(req)
      );
      sendSuccess(req, res, updated, {
        message: `Election '${updated.id}' updated successfully.`,
      });
    } catch (err) {
      next(err);
    }
  };

  transitionStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const updated = await this.service.transitionStatus(
        req.adminUser!,
        electionId,
        req.body,
        getContext(req)
      );
      sendSuccess(req, res, updated, {
        message: `Election '${updated.id}' transitioned to '${updated.status}'.`,
      });
    } catch (err) {
      next(err);
    }
  };

  cancelElection = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const updated = await this.service.cancelElection(
        req.adminUser!,
        electionId,
        req.body,
        getContext(req)
      );
      sendSuccess(req, res, updated, {
        message: `Election '${updated.id}' has been cancelled.`,
      });
    } catch (err) {
      next(err);
    }
  };

  archiveElection = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const updated = await this.service.archiveElection(
        req.adminUser!,
        electionId,
        req.body,
        getContext(req)
      );
      sendSuccess(req, res, updated, {
        message: `Election '${updated.id}' has been archived.`,
      });
    } catch (err) {
      next(err);
    }
  };

  getLifecycleHistory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const query = (req.validated?.query ?? req.query) as {
        page: number;
        limit: number;
      };
      const result = await this.service.getLifecycleHistory(
        req.adminUser!,
        electionId,
        query,
        getContext(req)
      );
      sendSuccess(req, res, result.items, {
        pagination: buildPaginationMeta(
          Number(query.page ?? 1),
          Number(query.limit ?? 20),
          result.total
        ),
      });
    } catch (err) {
      next(err);
    }
  };
}
