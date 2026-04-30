import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController.js';
import { requireAuth } from '../middlewares/authorizationHandler.js';

const router = Router();

router.get('/acquisitions', requireAuth, analyticsController.getAcquisitionStats);
router.get('/collection-health', requireAuth, analyticsController.getCollectionHealth);
router.get('/valuations', requireAuth, analyticsController.getValuationSummary);

export default router;
