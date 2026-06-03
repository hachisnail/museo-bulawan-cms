import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController.js';
import { requireAuth } from '../middlewares/authorizationHandler.js';

const router = Router();

router.get('/acquisitions', requireAuth, analyticsController.getAcquisitionStats);
router.get('/collection-health', requireAuth, analyticsController.getCollectionHealth);
router.get('/valuations', requireAuth, analyticsController.getValuationSummary);
router.get('/inventory-status', requireAuth, analyticsController.getInventoryStatusSummary);
router.get('/audits', requireAuth, analyticsController.getAuditStatistics);
router.get('/umami', requireAuth, analyticsController.getUmamiAnalytics);
router.get('/overview', requireAuth, analyticsController.getOverviewStats);

export default router;
