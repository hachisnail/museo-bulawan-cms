import { Router } from 'express';
import multer from 'multer';
import * as acquisitionController from '../controllers/acquisitionController.js';
import { requireAuth, buildAbility, checkPermission } from '../middlewares/authorizationHandler.js';
import { validateBody } from '../middlewares/validateRequest.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Apply global authentication and role resolution
router.use(requireAuth);
router.use(buildAbility);

// ==========================================
// INTAKE STAGE (Gatekeepers: Registrars)
// ==========================================
router.get('/intakes', checkPermission('read', 'Intake'), acquisitionController.listIntakes);
router.post('/external/:submissionId', checkPermission('manage', 'Intake'), validateBody(acquisitionController.schemas.externalIntake), acquisitionController.processExternalIntake);
router.post('/internal', checkPermission('manage', 'Intake'), validateBody(acquisitionController.schemas.internalIntake), acquisitionController.createInternalIntake);
router.post('/:intakeId/approve', checkPermission('manage', 'Intake'), acquisitionController.approveIntake);
router.post('/:intakeId/reject', checkPermission('manage', 'Intake'), validateBody(acquisitionController.schemas.rejectIntake), acquisitionController.rejectIntake);
router.post('/:intakeId/reopen', checkPermission('manage', 'Intake'), acquisitionController.reopenIntake);
router.post('/:intakeId/rollback', checkPermission('manage', 'Intake'), acquisitionController.rollbackIntake);
router.post('/:intakeId/moa', checkPermission('manage', 'Intake'), validateBody(acquisitionController.schemas.generateMOA), acquisitionController.generateMOA);
router.post('/:intakeId/delivery', checkPermission('manage', 'Intake'), validateBody(acquisitionController.schemas.confirmDelivery), acquisitionController.confirmDelivery);

// ==========================================
// ACCESSION STAGE (Gatekeepers: Registrars)
// ==========================================
// ==========================================
// ACCESSION STAGE (Gatekeepers: Registrars)
// ==========================================
router.get('/accessions', checkPermission('read', 'Accession'), acquisitionController.listAccessions);
router.get('/accessions/:accessionId', checkPermission('read', 'Accession'), acquisitionController.getAccessionItem);
router.post('/:intakeId/accession', checkPermission('manage', 'Accession'), validateBody(acquisitionController.schemas.processAccession), acquisitionController.processAccession);
router.post('/accessions/:accessionId/moa', checkPermission('manage', 'Accession'), upload.array('files', 1), acquisitionController.uploadMOA);
router.post('/accessions/:accessionId/approve', checkPermission('manage', 'Accession'), validateBody(acquisitionController.schemas.approveAccession), acquisitionController.approveAccession);
router.post('/accessions/:accessionId/research', checkPermission('manage', 'Accession'), validateBody(acquisitionController.schemas.updateResearch), acquisitionController.updateResearch);
router.post('/accessions/:accessionId/finalize', checkPermission('manage', 'Inventory'), validateBody(acquisitionController.schemas.finalizeInventory), acquisitionController.finalizeInventory);
router.get('/accessions/:accessionId/report', checkPermission('read', 'Accession'), acquisitionController.generateReport);

// ==========================================
// INVENTORY STAGE (Gatekeepers: Inventory Staff / Admin)
// ==========================================
router.get('/inventory', checkPermission('read', 'Inventory'), acquisitionController.listInventory);
router.get('/inventory/:inventoryId', checkPermission('read', 'Inventory'), acquisitionController.getInventoryItem);
router.post('/accession/:accessionId/finalize', checkPermission('manage', 'Inventory'), validateBody(acquisitionController.schemas.finalizeInventory), acquisitionController.finalizeInventory);
router.post('/inventory/:inventoryId/transfer', checkPermission('manage', 'Inventory'), validateBody(acquisitionController.schemas.transferLocation), acquisitionController.transferLocation);
router.post('/inventory/:inventoryId/status', checkPermission('manage', 'Inventory'), validateBody(acquisitionController.schemas.updateStatus), acquisitionController.updateArtifactStatus);
router.post('/inventory/:inventoryId/deaccession', checkPermission('manage', 'Inventory'), validateBody(acquisitionController.schemas.deaccession), acquisitionController.deaccessionItem);

// ==========================================
// PHASE 7: MUSEUM COMPLIANCE (Logs & Movement)
// ==========================================
router.get('/inventory/:inventoryId/movement', checkPermission('read', 'Inventory'), acquisitionController.getMovementHistory);
router.get('/inventory/:inventoryId/conservation', checkPermission('read', 'Inventory'), acquisitionController.getConservationLogs);
router.post('/inventory/:inventoryId/conservation', checkPermission('manage', 'Inventory'), acquisitionController.addConservationLog);

// ==========================================
// TRAVERSAL & CONDITION REPORTS
// ==========================================
router.get('/chain/:intakeId', checkPermission('read', 'Intake'), acquisitionController.getFullChain);
router.post('/condition/:entityType/:entityId', checkPermission('manage', 'Accession'), validateBody(acquisitionController.schemas.conditionReport), acquisitionController.addConditionReport);
router.get('/condition/:entityType/:entityId', checkPermission('read', 'Accession'), acquisitionController.getConditionReports);

// ==========================================
// STATE MACHINE & VERIFICATION
// ==========================================
router.get('/verify-delivery/:token', acquisitionController.verifyDeliveryToken);
router.get('/transitions/:entityType/:status', acquisitionController.getAvailableActions);

export default router;