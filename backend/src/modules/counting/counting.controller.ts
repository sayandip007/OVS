import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/utils/response.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import type { CountingService } from './counting.service.js';
import type {
  CreateCountingSessionInput,
  RecordRoundInput,
  RecordTalliesInput,
  ResolveTieInput,
  CorrectResultInput,
} from './counting.service.js';

export class CountingController {
  constructor(private readonly service: CountingService) {}

  createSession = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const body = (req.validated?.body ?? req.body) as CreateCountingSessionInput;
      const data = await this.service.createCountingSession(
        body,
        req.adminUser!,
        req.requestId,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(req, res, data, undefined, 201);
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
      const query = (req.validated?.query ?? req.query) as Parameters<
        CountingService['listCountingSessions']
      >[0];
      const { items, pagination } = await this.service.listCountingSessions(
        query,
        req.adminUser!
      );
      sendSuccess(req, res, items, { pagination });
    } catch (err) {
      next(err);
    }
  };

  getSessionById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = (req.validated?.params ?? req.params) as {
        sessionId: string;
      };
      const data = await this.service.getCountingSessionById(
        sessionId,
        req.adminUser!
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  recordRound = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = (req.validated?.params ?? req.params) as {
        sessionId: string;
      };
      const body = (req.validated?.body ?? req.body) as RecordRoundInput;
      const data = await this.service.recordCountingRound(
        sessionId,
        body,
        req.adminUser!,
        req.requestId,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(req, res, data, undefined, 201);
    } catch (err) {
      next(err);
    }
  };

  recordTallies = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = (req.validated?.params ?? req.params) as {
        sessionId: string;
      };
      const body = (req.validated?.body ?? req.body) as RecordTalliesInput;
      const data = await this.service.recordCandidateTallies(
        sessionId,
        body,
        req.adminUser!,
        req.requestId,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  resolveTie = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = (req.validated?.params ?? req.params) as {
        sessionId: string;
      };
      const body = (req.validated?.body ?? req.body) as ResolveTieInput;
      const data = await this.service.resolveTie(
        sessionId,
        body,
        req.adminUser!,
        req.requestId,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  submitForReview = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = (req.validated?.params ?? req.params) as {
        sessionId: string;
      };
      const data = await this.service.submitForReview(
        sessionId,
        req.adminUser!,
        req.requestId,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  publishResult = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = (req.validated?.params ?? req.params) as {
        sessionId: string;
      };
      const data = await this.service.publishResult(
        sessionId,
        req.adminUser!,
        req.requestId,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  correctResult = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = (req.validated?.params ?? req.params) as {
        sessionId: string;
      };
      const body = (req.validated?.body ?? req.body) as CorrectResultInput;
      const data = await this.service.correctResult(
        sessionId,
        body,
        req.adminUser!,
        req.requestId,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  resetSession = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = (req.validated?.params ?? req.params) as {
        sessionId: string;
      };
      const data = await this.service.resetCountingSession(
        sessionId,
        req.adminUser!,
        req.requestId,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================================================
  // Public Controller Actions
  // ==========================================================================

  getPublicResults = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = (req.validated?.query ?? req.query) as Parameters<
        CountingService['getPublicResults']
      >[0];
      const data = await this.service.getPublicResults(query);
      sendSuccess(req, res, data.items, {
        pagination: data.pagination,
        isSimulated: data.isSimulated,
        simulationNotice: data.simulationNotice,
      });
    } catch (err) {
      next(err);
    }
  };

  getPublicResultById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = (req.validated?.params ?? req.params) as {
        sessionId: string;
      };
      const data = await this.service.getPublicResultById(sessionId);
      sendSuccess(req, res, data.result, {
        isSimulated: data.isSimulated,
        simulationNotice: data.simulationNotice,
      });
    } catch (err) {
      next(err);
    }
  };

  getPublicElectionSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { electionId } = (req.validated?.params ?? req.params) as {
        electionId: string;
      };
      const data = await this.service.getPublicElectionSummary(electionId);
      sendSuccess(req, res, data, {
        isSimulated: data.isSimulated,
        simulationNotice: data.simulationNotice,
      });
    } catch (err) {
      next(err);
    }
  };
}
