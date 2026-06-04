import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController.js';
import { requireAuth, buildAbility, checkPermission } from '../middlewares/authorizationHandler.js';

const router = Router();

router.get('/acquisitions', requireAuth, buildAbility, checkPermission('read', 'Telemetry'), analyticsController.getAcquisitionStats);
router.get('/collection-health', requireAuth, buildAbility, checkPermission('read', 'Telemetry'), analyticsController.getCollectionHealth);
router.get('/valuations', requireAuth, buildAbility, checkPermission('read', 'Telemetry'), analyticsController.getValuationSummary);
router.get('/inventory-status', requireAuth, buildAbility, checkPermission('read', 'Telemetry'), analyticsController.getInventoryStatusSummary);
router.get('/audits', requireAuth, buildAbility, checkPermission('read', 'Telemetry'), analyticsController.getAuditStatistics);
router.get('/umami', requireAuth, buildAbility, checkPermission('read', 'Telemetry'), analyticsController.getUmamiAnalytics);
router.get('/overview', requireAuth, buildAbility, checkPermission('read', 'Telemetry'), analyticsController.getOverviewStats);
router.get('/feedback', requireAuth, buildAbility, checkPermission('read', 'Feedback'), analyticsController.getFeedbackStats);
router.get('/dashboard-stats', requireAuth, buildAbility, checkPermission('read', 'Telemetry'), analyticsController.getDashboardStats);

export default router;
