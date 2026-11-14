import type { Request, Response, NextFunction } from 'express';
import { MasterAdminSimulationService } from './simulation.service.js';
import { sendSuccess } from '../../common/utils/response.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

export class SimulationController {
  constructor(
    private readonly simulationService: MasterAdminSimulationService = new MasterAdminSimulationService()
  ) {}

  private getActorMeta(req: Request) {
    const authReq = req as AuthenticatedRequest;
    return {
      adminUserId: authReq.adminUser?.id ?? authReq.user?.id,
      actorIdentifier: authReq.adminUser?.officerCode ?? authReq.user?.identifier,
      actorRole: authReq.adminUser?.role,
    };
  }

  runPanIndia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const meta = this.getActorMeta(req);
      const { candidatesPerState, targetStateIds, simulateTurnout, simulateCounting } = req.body ?? {};

      const result = await this.simulationService.runPanIndiaSimulation({
        candidatesPerState: typeof candidatesPerState === 'number' ? candidatesPerState : undefined,
        targetStateIds: Array.isArray(targetStateIds) ? targetStateIds : undefined,
        simulateTurnout: simulateTurnout === true,
        simulateCounting: simulateCounting !== false,
        adminUserId: meta.adminUserId,
        actorIdentifier: meta.actorIdentifier,
      });

      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  };

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.simulationService.getSimulationStatus();
      sendSuccess(req, res, status);
    } catch (err) {
      next(err);
    }
  };

  purgeData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const meta = this.getActorMeta(req);
      const result = await this.simulationService.purgeSimulatedData(
        meta.adminUserId,
        meta.actorIdentifier
      );
      sendSuccess(req, res, {
        message: 'Pan-India simulation benchmark data purged successfully.',
        ...result,
      });
    } catch (err) {
      next(err);
    }
  };
}
