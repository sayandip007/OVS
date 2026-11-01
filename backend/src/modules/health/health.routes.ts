import { Router } from 'express';
import {
  checkDatabaseReadiness,
  type DatabaseReadinessResult,
} from '../../config/database.js';
import { sendSuccess } from '../../common/utils/response.js';
import { ServiceUnavailableProblemError } from '../../common/errors/problemDetails.js';

export interface HealthRouterOptions {
  readinessCheck?: () => Promise<DatabaseReadinessResult>;
}

export function createHealthRouter(options: HealthRouterOptions = {}): Router {
  const router = Router();
  const runReadinessCheck = options.readinessCheck ?? checkDatabaseReadiness;

  router.get('/live', (req, res) => {
    sendSuccess(req, res, {
      status: 'UP',
      service: 'ovs-backend',
      phase: '8.2-foundation',
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  router.get('/ready', async (req, res, next) => {
    try {
      const dbCheck = await runReadinessCheck();
      if (!dbCheck.connected) {
        next(
          new ServiceUnavailableProblemError(
            dbCheck.error ??
              'PostgreSQL database connectivity check failed during readiness probe.'
          )
        );
        return;
      }

      sendSuccess(req, res, {
        status: 'READY',
        service: 'ovs-backend',
        phase: '8.2-foundation',
        database: {
          status: 'UP',
          latencyMs: dbCheck.latencyMs,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
