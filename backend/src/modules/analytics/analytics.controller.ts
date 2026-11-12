import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsExportService } from './analytics.export.service.js';
import {
  nationalAnalyticsQuerySchema,
  stateAnalyticsParamSchema,
  stateAnalyticsQuerySchema,
  electionAnalyticsParamSchema,
  participationAnalyticsQuerySchema,
  countingAnalyticsQuerySchema,
  auditAnalyticsQuerySchema,
  exportQuerySchema,
  publicAnalyticsQuerySchema,
} from './analytics.schemas.js';
import { ValidationProblemError } from '../../common/errors/problemDetails.js';
import { prisma } from '../../config/database.js';

export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService = new AnalyticsService(),
    private readonly exportService: AnalyticsExportService = new AnalyticsExportService()
  ) {}

  public getNationalOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const parsed = nationalAnalyticsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationProblemError(
          'Invalid query parameters for national analytics.',
          parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message }))
        );
      }
      const data = await this.analyticsService.getNationalOverview(authReq.adminUser!, parsed.data);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public getStateOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const paramParsed = stateAnalyticsParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new ValidationProblemError(
          'Invalid state ID parameter.',
          paramParsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message }))
        );
      }
      const queryParsed = stateAnalyticsQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        throw new ValidationProblemError(
          'Invalid query parameters for state analytics.',
          queryParsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message }))
        );
      }
      const data = await this.analyticsService.getStateOverview(
        authReq.adminUser!,
        paramParsed.data.stateId,
        queryParsed.data
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public getElectionOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const parsed = electionAnalyticsParamSchema.safeParse(req.params);
      if (!parsed.success) {
        throw new ValidationProblemError(
          'Invalid election ID parameter.',
          parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message }))
        );
      }
      const data = await this.analyticsService.getElectionOverview(authReq.adminUser!, parsed.data.electionId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public getParticipationAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const parsed = participationAnalyticsQuerySchema.safeParse({
        ...req.query,
        ...(req.params.electionId ? { electionId: req.params.electionId } : {}),
      });
      if (!parsed.success) {
        throw new ValidationProblemError(
          'Invalid query parameters for participation analytics.',
          parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message }))
        );
      }
      const data = await this.analyticsService.getParticipationAnalytics(authReq.adminUser!, parsed.data);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public getCandidatePartyAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const electionId = typeof req.params.electionId === 'string' ? req.params.electionId : undefined;
      const data = await this.analyticsService.getCandidatePartyAnalytics(authReq.adminUser!, {
        electionId,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public getCountingAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const parsed = countingAnalyticsQuerySchema.safeParse({
        ...req.query,
        ...(req.params.electionId ? { electionId: req.params.electionId } : {}),
      });
      if (!parsed.success) {
        throw new ValidationProblemError(
          'Invalid query parameters for counting analytics.',
          parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message }))
        );
      }
      const data = await this.analyticsService.getCountingAnalytics(authReq.adminUser!, parsed.data);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public getAuditAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const parsed = auditAnalyticsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationProblemError(
          'Invalid query parameters for audit analytics.',
          parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message }))
        );
      }
      const data = await this.analyticsService.getAuditAnalytics(authReq.adminUser!, parsed.data);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public exportReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const parsed = exportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationProblemError(
          'Invalid export request parameters.',
          parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message }))
        );
      }

      const { domain, format, electionId, stateId } = parsed.data;
      let rawData: any;

      switch (domain) {
        case 'national':
          rawData = (await this.analyticsService.getNationalOverview(authReq.adminUser!, { stateId })).data;
          break;
        case 'state':
          if (!stateId) throw new ValidationProblemError("State ID is required for 'state' domain export.");
          rawData = (await this.analyticsService.getStateOverview(authReq.adminUser!, stateId)).data;
          break;
        case 'election':
          if (!electionId) throw new ValidationProblemError("Election ID is required for 'election' domain export.");
          rawData = (await this.analyticsService.getElectionOverview(authReq.adminUser!, electionId)).data;
          break;
        case 'participation':
          rawData = (await this.analyticsService.getParticipationAnalytics(authReq.adminUser!, { electionId, stateId })).data;
          break;
        case 'counting':
          rawData = (await this.analyticsService.getCountingAnalytics(authReq.adminUser!, { electionId, stateId })).data;
          break;
        case 'audit':
          rawData = (await this.analyticsService.getAuditAnalytics(authReq.adminUser!, {})).data;
          break;
      }

      const exportResult = this.exportService.exportData(domain, format, rawData, { electionId, stateId });

      // Audit log the export operation
      try {
        await prisma.adminActionLog.create({
          data: {
            adminUserId: authReq.adminUser?.id,
            actorUserId: authReq.adminUser?.userId,
            actorIdentifier: authReq.adminUser?.officerCode || authReq.adminUser?.userId || 'ADMIN',
            actorRole: authReq.adminUser?.role,
            actionType: 'DATA_EXPORT',
            domain: 'ANALYTICS',
            targetEntityId: `${domain.toUpperCase()}_EXPORT`,
            outcome: 'SUCCESS',
            details: { domain, format, electionId, stateId, filename: exportResult.filename },
            ipAddress: req.ip,
          },
        });
      } catch {
        // Logging failure should not disrupt the export response
      }

      res.setHeader('Content-Type', exportResult.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.status(200).send(exportResult.content);
    } catch (error) {
      next(error);
    }
  };

  public getPublicAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = publicAnalyticsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationProblemError(
          'Invalid query parameters for public analytics.',
          parsed.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message }))
        );
      }
      const data = await this.analyticsService.getPublicAnalytics(parsed.data);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
