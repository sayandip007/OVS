import type { Response, NextFunction } from 'express';
import { buildPaginationMeta, sendSuccess } from '../../common/utils/response.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import type { ElectionConfigService } from './election.config.service.js';

function getContext(req: AuthenticatedRequest) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

export class ElectionConfigController {
  constructor(private readonly service: ElectionConfigService) {}

  listAssignedConstituencies = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const query = (req.validated?.query ?? req.query) as any;
      const result = await this.service.listAssignedConstituencies(
        req.adminUser!,
        electionId,
        query
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

  listAvailableConstituencies = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const query = (req.validated?.query ?? req.query) as any;
      const result = await this.service.listAvailableConstituencies(
        req.adminUser!,
        electionId,
        query
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

  assignSingleConstituency = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const body = (req.validated?.body ?? req.body) as {
        constituencyId: string;
        note: string;
        expectedVersion?: number;
      };
      const result = await this.service.bulkAssignConstituencies(
        req.adminUser!,
        electionId,
        {
          constituencyIds: [body.constituencyId],
          note: body.note,
          expectedVersion: body.expectedVersion,
        },
        getContext(req)
      );
      sendSuccess(req, res, result, undefined, 201);
    } catch (err) {
      next(err);
    }
  };

  previewBulkAssignment = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const body = (req.validated?.body ?? req.body) as { constituencyIds: string[] };
      const result = await this.service.previewBulkAssignment(
        req.adminUser!,
        electionId,
        body.constituencyIds
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  bulkAssignConstituencies = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const body = (req.validated?.body ?? req.body) as any;
      const result = await this.service.bulkAssignConstituencies(
        req.adminUser!,
        electionId,
        body,
        getContext(req)
      );
      sendSuccess(req, res, result, undefined, 201);
    } catch (err) {
      next(err);
    }
  };

  removeConstituency = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId, constituencyId } = (req.validated?.params ?? req.params) as {
        electionId: string;
        constituencyId: string;
      };
      const result = await this.service.removeConstituency(
        req.adminUser!,
        electionId,
        constituencyId,
        getContext(req)
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  listConstituencyHistory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const query = (req.validated?.query ?? req.query) as any;
      const result = await this.service.listConstituencyHistory(req.adminUser!, electionId, {
        page: Number(query.page ?? 1),
        limit: Number(query.limit ?? 20),
      });
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

  getSchedule = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const result = await this.service.getSchedule(req.adminUser!, electionId);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  upsertSchedule = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const body = (req.validated?.body ?? req.body) as any;
      const result = await this.service.upsertSchedule(
        req.adminUser!,
        electionId,
        body,
        getContext(req)
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  updateMilestone = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId, milestoneId } = (req.validated?.params ?? req.params) as {
        electionId: string;
        milestoneId: any;
      };
      const body = (req.validated?.body ?? req.body) as any;
      const result = await this.service.updateMilestone(
        req.adminUser!,
        electionId,
        milestoneId,
        body,
        getContext(req)
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  validateSchedule = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const result = await this.service.validateSchedule(req.adminUser!, electionId);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  getScheduleHistory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const query = (req.validated?.query ?? req.query) as any;
      const result = await this.service.getScheduleHistory(req.adminUser!, electionId, {
        page: Number(query.page ?? 1),
        limit: Number(query.limit ?? 20),
      });
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

  validateConfigurationReadiness = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const result = await this.service.validateConfigurationReadiness(
        req.adminUser!,
        electionId
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  submitConfigurationForReview = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const body = (req.validated?.body ?? req.body) as { note: string };
      const result = await this.service.submitConfigurationForReview(
        req.adminUser!,
        electionId,
        body.note ?? '',
        getContext(req)
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  reviewConfiguration = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const body = (req.validated?.body ?? req.body) as { note: string };
      const result = await this.service.reviewConfiguration(
        req.adminUser!,
        electionId,
        body.note ?? '',
        getContext(req)
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  approveConfiguration = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const body = (req.validated?.body ?? req.body) as { note: string };
      const result = await this.service.approveConfiguration(
        req.adminUser!,
        electionId,
        body.note ?? '',
        getContext(req)
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  returnConfigurationForCorrection = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as { electionId: string };
      const body = (req.validated?.body ?? req.body) as { reason: string };
      const result = await this.service.returnConfigurationForCorrection(
        req.adminUser!,
        electionId,
        body.reason,
        getContext(req)
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };
}
