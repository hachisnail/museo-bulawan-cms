import { Router } from "express";
import { acquisitionController } from "../../controllers/acquisitionController.js";
import { validate } from "../../middlewares/validateRequest.js";
import { requireAuth, checkPermission } from "../../middlewares/authorizationHandler.js";
import multer from 'multer';
import os from 'os';

const router = Router();
const upload = multer({ dest: os.tmpdir() });
const schemas = acquisitionController.schemas;

/**
 * Acquisition Domain Routes
 * 
 * Handles all routes related to the acquisition lifecycle: Intake -> Accession -> Inventory.
 */

// ==========================================
// LISTING & RETRIEVAL
// ==========================================
router.get('/intakes', requireAuth, acquisitionController.listIntakes);
router.get('/intakes/:intakeId', requireAuth, acquisitionController.getIntakeItem);
router.get('/accessions', requireAuth, acquisitionController.listAccessions);
router.get('/inventory', requireAuth, acquisitionController.listInventory);
router.get('/inventory/archive', requireAuth, acquisitionController.listDeaccessioned);

router.get('/intakes/:intakeId/chain', requireAuth, acquisitionController.getFullChain);
router.get('/accessions/:accessionId', requireAuth, acquisitionController.getAccessionItem);
router.get('/inventory/:inventoryId', requireAuth, acquisitionController.getInventoryItem);

// ==========================================
// INTAKE ACTIONS
// ==========================================
router.post('/intakes/internal', 
    requireAuth, 
    checkPermission('create', 'Intake'),
    validate(schemas.internalIntake), 
    acquisitionController.createInternalIntake
);

router.post('/intakes/:intakeId/approve', 
    requireAuth, 
    checkPermission('update', 'Intake'),
    acquisitionController.approveIntake
);

router.post('/intakes/:intakeId/reject', 
    requireAuth, 
    checkPermission('update', 'Intake'),
    validate(schemas.rejectIntake), 
    acquisitionController.rejectIntake
);

router.post('/intakes/:intakeId/reopen', 
    requireAuth, 
    checkPermission('update', 'Intake'),
    acquisitionController.reopenIntake
);

router.post('/intakes/:intakeId/generate-moa', 
    requireAuth, 
    checkPermission('update', 'Intake'),
    validate(schemas.generateMOA), 
    acquisitionController.generateMOA
);

router.post('/intakes/:intakeId/rollback', 
    requireAuth, 
    checkPermission('update', 'Intake'),
    acquisitionController.rollbackIntake
);

router.get('/delivery/verify/:token', acquisitionController.verifyDeliveryToken);
router.post('/intakes/external/:submissionId', 
    requireAuth, 
    checkPermission('create', 'Intake'),
    acquisitionController.processExternalIntake
);

router.post('/intakes/:intakeId/confirm-delivery', 
    requireAuth, 
    validate(schemas.confirmDelivery), 
    acquisitionController.confirmDelivery
);

// ==========================================
// ACCESSION ACTIONS
// ==========================================
router.post('/accessions/from-intake/:intakeId', 
    requireAuth, 
    checkPermission('create', 'Accession'),
    validate(schemas.processAccession), 
    acquisitionController.processAccession
);

router.post('/accessions/:accessionId/upload-moa', 
    requireAuth, 
    checkPermission('update', 'Accession'),
    upload.array('files', 5), 
    acquisitionController.uploadMOA
);

router.post('/accessions/:accessionId/approve', 
    requireAuth, 
    checkPermission('update', 'Accession'),
    validate(schemas.approveAccession), 
    acquisitionController.approveAccession
);

router.patch('/accessions/:accessionId/research', 
    requireAuth, 
    checkPermission('update', 'Accession'),
    validate(schemas.updateResearch), 
    acquisitionController.updateResearch
);

router.get('/intakes/:intakeId/export-moa', requireAuth, acquisitionController.exportMOA);
router.get('/accessions/:accessionId/report', requireAuth, acquisitionController.generateReport);
router.get('/accessions/:accessionId/export', requireAuth, acquisitionController.exportReport);

// ==========================================
// INVENTORY ACTIONS
// ==========================================
router.post('/inventory/from-accession/:accessionId', 
    requireAuth, 
    checkPermission('create', 'Inventory'),
    validate(schemas.finalizeInventory), 
    acquisitionController.finalizeInventory
);

router.post('/inventory/:inventoryId/transfer', 
    requireAuth, 
    checkPermission('update', 'Inventory'),
    validate(schemas.transferLocation), 
    acquisitionController.transferLocation
);

router.post('/inventory/:inventoryId/deaccession', 
    requireAuth, 
    checkPermission('delete', 'Inventory'),
    validate(schemas.deaccession), 
    acquisitionController.deaccessionItem
);

router.post('/inventory/batch-transfer', 
    requireAuth, 
    checkPermission('update', 'Inventory'),
    acquisitionController.batchTransfer
);

router.patch('/inventory/:inventoryId/status', 
    requireAuth, 
    checkPermission('update', 'Inventory'),
    validate(schemas.updateStatus), 
    acquisitionController.updateArtifactStatus
);

router.get('/inventory/:inventoryId/report', requireAuth, acquisitionController.generateInventoryReport);
router.get('/inventory/:inventoryId/export', requireAuth, acquisitionController.exportInventoryReport);

// ==========================================
// COMPLIANCE & HISTORY
// ==========================================
router.get('/inventory/:inventoryId/movement', requireAuth, acquisitionController.getMovementHistory);
router.get('/inventory/:inventoryId/exhibitions', requireAuth, acquisitionController.getArtifactExhibitionHistory);
router.get('/inventory/:inventoryId/conservation', requireAuth, acquisitionController.getConservationLogs);
router.post('/inventory/:inventoryId/conservation', 
    requireAuth, 
    checkPermission('create', 'ConservationLog'),
    validate(schemas.conservationLog),
    acquisitionController.addConservationLog
);

router.get('/:entityType/:entityId/condition-reports', requireAuth, acquisitionController.getConditionReports);
router.post('/:entityType/:entityId/condition-reports', 
    requireAuth, 
    validate(schemas.conditionReport), 
    acquisitionController.addConditionReport
);

// ==========================================
// METADATA
// ==========================================
router.get('/actions/:entityType/:status', requireAuth, acquisitionController.getAvailableActions);
router.get('/tags', requireAuth, acquisitionController.getUniqueTags);

// ==========================================
// PROFESSIONAL COMPLIANCE (SPECTRUM)
// ==========================================
router.get('/constituents', requireAuth, acquisitionController.listConstituents);
router.post('/constituents', requireAuth, acquisitionController.createConstituent);
router.get('/constituents/search', requireAuth, acquisitionController.searchConstituents);

router.get('/inventory/:inventoryId/valuations', requireAuth, acquisitionController.getValuationHistory);
router.post('/inventory/:inventoryId/valuations', requireAuth, checkPermission('update', 'Inventory'), acquisitionController.addValuation);

router.get('/exhibitions', requireAuth, acquisitionController.listExhibitions);
router.post('/exhibitions', requireAuth, checkPermission('create', 'Exhibition'), acquisitionController.createExhibition);
router.get('/exhibitions/:exhibitionId', requireAuth, acquisitionController.getExhibitionDetails);
router.post('/exhibitions/:exhibitionId/artifacts', requireAuth, checkPermission('update', 'Exhibition'), acquisitionController.addArtifactToExhibition);

// ==========================================
// OUTBOUND LOANS
// ==========================================
router.get('/loans', requireAuth, acquisitionController.listLoans);
router.post('/loans', requireAuth, checkPermission('create', 'Loan'), acquisitionController.createLoan);
router.post('/loans/:id/activate', requireAuth, checkPermission('update', 'Loan'), acquisitionController.activateLoan);

export default router;
