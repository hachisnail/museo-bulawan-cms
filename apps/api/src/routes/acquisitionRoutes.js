import { Router } from 'express';
import * as acquisitionController from '../controllers/acquisitionController.js';
import { requireAuth, buildAbility, checkPermission } from '../middlewares/authorizationHandler.js';

const router = Router();

// Apply global authentication and role resolution
router.use(requireAuth);
router.use(buildAbility);

// ==========================================
// INTAKE STAGE (Gatekeepers: Registrars)
// ==========================================
router.post('/external/:submissionId', checkPermission('manage', 'Intake'), acquisitionController.processExternalIntake);
router.post('/internal', checkPermission('manage', 'Intake'), acquisitionController.createInternalIntake);
router.post('/:intakeId/moa', checkPermission('manage', 'Intake'), acquisitionController.generateMOA);
router.post('/:intakeId/delivery', checkPermission('manage', 'Intake'), acquisitionController.confirmDelivery);

// ==========================================
// ACCESSION STAGE (Gatekeepers: Registrars)
// ==========================================
router.post('/:intakeId/accession', checkPermission('manage', 'Accession'), acquisitionController.processAccession);
router.patch('/accession/:accessionId/research', checkPermission('manage', 'Accession'), acquisitionController.updateResearch);

// ==========================================
// INVENTORY STAGE (Gatekeepers: Inventory Staff / Admin)
// ==========================================
router.post('/accession/:accessionId/finalize', checkPermission('manage', 'Inventory'), acquisitionController.finalizeInventory);

export default router;