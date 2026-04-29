import { Router } from 'express';
import * as auditController from '../controllers/auditController.js';
import { requireAuth, buildAbility, checkPermission } from '../middlewares/authorizationHandler.js';

const router = Router();

router.use(requireAuth);
router.use(buildAbility);

router.get('/', checkPermission('manage', 'AuditLog'), auditController.listAuditLogs);
router.get('/export', checkPermission('manage', 'AuditLog'), auditController.exportAuditLogs);

export default router;
