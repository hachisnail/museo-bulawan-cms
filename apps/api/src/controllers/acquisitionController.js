import Joi from 'joi';
import { acquisitionService } from '../services/acquisitionService.js';
import { formPipelineService } from '../services/formPipelineService.js';
import { getValidTransitions } from '../utils/stateMachine.js';

// ==========================================
// JOI VALIDATION SCHEMAS
// ==========================================
export const schemas = {
    externalIntake: Joi.object({}),
    
    internalIntake: Joi.object({
        itemName: Joi.string().required(),
        sourceInfo: Joi.string().default('Internal/Purchase'),
        method: Joi.string().valid('gift', 'loan', 'purchase', 'existing').required(),
        loanEndDate: Joi.date().iso().optional().allow(null)
    }),
    
    rejectIntake: Joi.object({
        reason: Joi.string().required()
    }),

    generateMOA: Joi.object({
        donorName: Joi.string().optional(),
        loanDuration: Joi.string().optional()
    }),
    
    confirmDelivery: Joi.object({
        token: Joi.string().required()
    }),
    
    processAccession: Joi.object({
        accessionNumber: Joi.string().optional(), // Auto-generated if omitted
        conditionReport: Joi.string().allow('', null),
        handlingInstructions: Joi.string().allow('', null),
        isMoaSigned: Joi.boolean().default(false)
    }),

    approveAccession: Joi.object({
        notes: Joi.string().allow('', null).default('')
    }),
    
    updateResearch: Joi.object({
        dimensions: Joi.string().optional().allow(''),
        materials: Joi.string().optional().allow(''),
        research_notes: Joi.string().optional().allow(''),
        historical_significance: Joi.string().optional().allow(''),
        research_data: Joi.object().optional()
    }),
    
    finalizeInventory: Joi.object({
        catalogNumber: Joi.string().optional(), // Auto-generated if omitted
        location: Joi.string().allow('', null),
        conditionReport: Joi.string().allow('', null)
    }),

    transferLocation: Joi.object({
        toLocation: Joi.string().required(),
        reason: Joi.string().allow('', null).default('')
    }),

    deaccession: Joi.object({
        reason: Joi.string().required()
    }),

    updateStatus: Joi.object({
        status: Joi.string().valid('active', 'maintenance', 'loan', 'storage', 'deaccessioned').required(),
        isManual: Joi.boolean().default(false),
        reason: Joi.string().when('isManual', { is: true, then: Joi.required() })
    }),

    conditionReport: Joi.object({
        condition: Joi.string().required(),
        notes: Joi.string().allow('', null).default('')
    })
};

// ==========================================
// LISTING ENDPOINTS
// ==========================================
export const listIntakes = async (req, res, next) => {
    try {
        const result = await acquisitionService._listRecords('intakes', req.query);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) { next(error); }
};

export const listAccessions = async (req, res, next) => {
    try {
        const result = await acquisitionService._listRecords('accessions', req.query);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) { next(error); }
};

export const listInventory = async (req, res, next) => {
    try {
        const query = { ...req.query, expand: req.query.expand || 'accession_id.intake_id' };
        const result = await acquisitionService._listRecords('inventory', query);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) { next(error); }
};

export const getInventoryItem = async (req, res, next) => {
    try {
        const { inventoryId } = req.params;
        const item = await acquisitionService.getInventoryItem(inventoryId, req.query);
        res.status(200).json({ status: 'success', data: item });
    } catch (error) { next(error); }
};

export const getAccessionItem = async (req, res, next) => {
    try {
        const { accessionId } = req.params;
        const item = await acquisitionService.getAccessionItem(accessionId, req.query);
        res.status(200).json({ status: 'success', data: item });
    } catch (error) { next(error); }
};

// ==========================================
// INTAKE ACTIONS
// ==========================================
export const processExternalIntake = async (req, res, next) => {
    try {
        const { submissionId } = req.params;
        const staffId = req.user ? req.user.id : 'system';
        const result = await formPipelineService.processExternalIntake(staffId, submissionId);
        res.status(200).json({ message: `External submission processed into ${result.intakes.length} intake(s).`, ...result });
    } catch (error) { next(error); }
};

export const createInternalIntake = async (req, res, next) => {
    try {
        const value = req.body;
        const staffId = req.user.id;
        const intake = await acquisitionService.createInternalIntake(staffId, value, value.method, value.loanEndDate);
        res.status(201).json({ message: "Internal intake created.", intake });
    } catch (error) { next(error); }
};

export const approveIntake = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const intake = await acquisitionService.approveIntake(req.user.id, intakeId);
        res.status(200).json({ message: "Intake approved.", intake });
    } catch (error) { next(error); }
};

export const rejectIntake = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const intake = await acquisitionService.rejectIntake(req.user.id, intakeId, req.body.reason);
        res.status(200).json({ message: "Intake rejected.", intake });
    } catch (error) { next(error); }
};

export const reopenIntake = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const intake = await acquisitionService.reopenIntake(req.user.id, intakeId);
        res.status(200).json({ message: "Intake reopened for review.", intake });
    } catch (error) { next(error); }
};

export const generateMOA = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const result = await acquisitionService.generateDynamicMOA(req.user.id, intakeId, req.body);
        res.status(200).json(result);
    } catch (error) { next(error); }
};

export const rollbackIntake = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const intake = await acquisitionService.rollbackToReview(req.user.id, intakeId);
        res.status(200).json({ message: "Intake rolled back to under review.", intake });
    } catch (error) { next(error); }
};

export const confirmDelivery = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const intake = await acquisitionService.confirmPhysicalDelivery(req.user.id, intakeId, req.body.token);
        res.status(200).json({ message: "Physical delivery confirmed.", intake });
    } catch (error) { next(error); }
};

// ==========================================
// ACCESSION ACTIONS
// ==========================================
export const uploadMOA = async (req, res, next) => {
    try {
        const { accessionId } = req.params;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No file provided." });
        }
        const accession = await acquisitionService.uploadMOA(req.user.id, accessionId, req.files);
        res.status(200).json({ message: "Signed MOA uploaded successfully.", accession });
    } catch (error) { next(error); }
};

export const processAccession = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const accession = await acquisitionService.processAccession(req.user.id, intakeId, req.body);
        res.status(201).json({ message: "Artifact formally accessioned.", accession });
    } catch (error) { next(error); }
};

export const approveAccession = async (req, res, next) => {
    try {
        const { accessionId } = req.params;
        const accession = await acquisitionService.approveAccession(req.user.id, accessionId, req.body.notes);
        res.status(200).json({ message: "Accession approved and moved to research.", accession });
    } catch (error) { next(error); }
};

export const updateResearch = async (req, res, next) => {
    try {
        const { accessionId } = req.params;
        const accession = await acquisitionService.updateAccessionResearch(req.user.id, accessionId, req.body);
        res.status(200).json({ message: "Research notes saved.", accession });
    } catch (error) { next(error); }
};

export const generateReport = async (req, res, next) => {
    try {
        const { accessionId } = req.params;
        const html = await acquisitionService.generateFormalReport(accessionId);
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);
    } catch (error) { next(error); }
};

// ==========================================
// INVENTORY ACTIONS
// ==========================================
export const finalizeInventory = async (req, res, next) => {
    try {
        const { accessionId } = req.params;
        const inventory = await acquisitionService.finalizeToInventory(req.user.id, accessionId, req.body);
        res.status(201).json({ message: "Artifact fully cataloged into active inventory.", inventory });
    } catch (error) { 
        if (error.message.includes('Missing required research fields') || error.message.includes('Cannot finalize')) {
            return res.status(400).json({ error: error.message });
        }
        next(error); 
    }
};

export const transferLocation = async (req, res, next) => {
    try {
        const { inventoryId } = req.params;
        const item = await acquisitionService.transferLocation(req.user.id, inventoryId, req.body.toLocation, req.body.reason);
        res.status(200).json({ message: "Location updated.", item });
    } catch (error) { next(error); }
};

export const deaccessionItem = async (req, res, next) => {
    try {
        const { inventoryId } = req.params;
        const item = await acquisitionService.deaccessionItem(req.user.id, inventoryId, req.body.reason);
        res.status(200).json({ message: "Item deaccessioned.", item });
    } catch (error) { next(error); }
};
export const updateArtifactStatus = async (req, res, next) => {
    try {
        const { inventoryId } = req.params;
        const { status, isManual, reason } = req.body;
        const item = await acquisitionService.updateArtifactStatus(req.user.id, inventoryId, status, isManual, reason);
        res.status(200).json({ message: "Artifact status updated successfully.", item });
    } catch (error) { next(error); }
};

// ==========================================
// STATE MACHINE & VERIFICATION
// ==========================================
export const verifyDeliveryToken = async (req, res, next) => {
    try {
        const { token } = req.params;
        const result = await acquisitionService.verifyDeliveryToken(token);
        if (!result.valid) {
            return res.status(400).json({ error: result.error, intake: result.intake });
        }
        res.status(200).json({ status: 'success', data: result.intake });
    } catch (error) { next(error); }
};

// ==========================================
// PHASE 7: MUSEUM COMPLIANCE
// ==========================================
export const getMovementHistory = async (req, res, next) => {
    try {
        const { inventoryId } = req.params;
        const history = await acquisitionService.getMovementHistory(inventoryId);
        res.status(200).json({ status: 'success', data: history });
    } catch (error) { next(error); }
};

export const addConservationLog = async (req, res, next) => {
    try {
        const { inventoryId } = req.params;
        const { treatment, findings, recommendations } = req.body;
        if (!treatment) return res.status(400).json({ error: "Treatment is required." });
        const log = await acquisitionService.createConservationLog(req.user.id, inventoryId, treatment, findings, recommendations);
        res.status(201).json({ message: "Conservation log added.", log });
    } catch (error) { next(error); }
};

export const getConservationLogs = async (req, res, next) => {
    try {
        const { inventoryId } = req.params;
        const logs = await acquisitionService.getConservationLogs(inventoryId);
        res.status(200).json({ status: 'success', data: logs });
    } catch (error) { next(error); }
};

// ==========================================
// TRAVERSAL & CONDITION REPORTS
// ==========================================
export const getFullChain = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const chain = await acquisitionService.getFullChain(intakeId);
        res.status(200).json({ status: 'success', data: chain });
    } catch (error) { next(error); }
};

export const addConditionReport = async (req, res, next) => {
    try {
        const { entityType, entityId } = req.params;
        const report = await acquisitionService.createConditionReport(req.user.id, entityType, entityId, req.body.condition, req.body.notes);
        res.status(201).json({ message: "Condition report added.", report });
    } catch (error) { next(error); }
};

export const getConditionReports = async (req, res, next) => {
    try {
        const { entityType, entityId } = req.params;
        const reports = await acquisitionService.getConditionReports(entityType, entityId);
        res.status(200).json({ status: 'success', data: reports });
    } catch (error) { next(error); }
};

/**
 * Returns available next actions for a given entity.
 * Useful for the frontend to render available action buttons.
 */
export const getAvailableActions = async (req, res, next) => {
    try {
        const { entityType, status } = req.params;
        const transitions = getValidTransitions(entityType, status);
        res.status(200).json({ entityType, currentStatus: status, availableTransitions: transitions });
    } catch (error) { next(error); }
};