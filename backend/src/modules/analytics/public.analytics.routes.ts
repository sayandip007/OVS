import { Router } from 'express';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsExportService } from './analytics.export.service.js';
import { AnalyticsController } from './analytics.controller.js';

export interface CreatePublicAnalyticsRouterOptions {
  analyticsService?: AnalyticsService;
  exportService?: AnalyticsExportService;
}

export function createPublicAnalyticsRouter(
  options: CreatePublicAnalyticsRouterOptions = {}
): Router {
  const router = Router();
  const analyticsService = options.analyticsService ?? new AnalyticsService();
  const exportService = options.exportService ?? new AnalyticsExportService();
  const controller = new AnalyticsController(analyticsService, exportService);

  router.get('/elections', controller.getPublicAnalytics);
  router.get('/elections/:electionId', controller.getPublicAnalytics);
  router.get('/results', controller.getPublicAnalytics);
  router.get('/constituencies/:constituencyId', controller.getPublicAnalytics);

  return router;
}
