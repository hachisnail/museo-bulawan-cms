import Joi from 'joi';
import { acquisitionService } from '../services/acquisitionService.js';
import { validateRequest } from '../utils/validateRequest.js';

// ==========================================
// JOI VALIDATION SCHEMAS
// ==========================================
const schemas = {
    externalIntake: Joi.object({
        itemName: Joi.string().required(),
        donorName: Joi.string().required(),
        donorEmail: Joi.string().email().optional(),
        method: Joi.string().valid('gift', 'loan').default('gift'),
        loanEndDate: Joi.date().iso().optional().allow(null)
    }),
    
    internalIntake: Joi.object({
        itemName: Joi.string().required(),
        sourceInfo: Joi.string().default('Internal/Purchase'),
        method: Joi.string().valid('gift', 'loan', 'purchase', 'existing').required(),
        loanEndDate: Joi.date().iso().optional().allow(null)
    }),
    
    generateMOA: Joi.object({
        donorName: Joi.string().optional(),
        loanDuration: Joi.string().optional()
    }),
    
    confirmDelivery: Joi.object({
        slipId: Joi.string().required()
    }),
    
    processAccession: Joi.object({
        accessionNumber: Joi.string().required(),
        conditionReport: Joi.string().allow('', null),
        handlingInstructions: Joi.string().allow('', null),
        isMoaSigned: Joi.boolean().default(false)
    }),
    
    updateResearch: Joi.object({
        dimensions: Joi.string().optional(),
        materials: Joi.string().optional(),
        research_notes: Joi.string().optional(),
        historical_significance: Joi.string().optional(),
        initial_condition_report: Joi.string().optional()
    }),
    
    finalizeInventory: Joi.object({
        catalogNumber: Joi.string().required(),
        location: Joi.string().allow('', null),
        conditionReport: Joi.string().allow('', null)
    })
};

// ==========================================
// CONTROLLER METHODS
// ==========================================
export const processExternalIntake = async (req, res, next) => {
    try {
        const { submissionId } = req.params;
        const { isValid, value } = validateRequest(schemas.externalIntake, req, res);
        if (!isValid) return; // Halt execution if invalid
        
        const intake = await acquisitionService.processExternalIntake(submissionId, value)
        res.status(200).json({ message: "External submission processed into Intake.", intake });
    } catch (error) { next(error); }
};

export const createInternalIntake = async (req, res, next) => {
    try {
        const { error, value } = schemas.internalIntake.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const intake = await acquisitionService.createInternalIntake(req.user.id, value, value.method, value.loanEndDate);
        res.status(201).json({ message: "Internal intake created.", intake });
    } catch (error) { next(error); }
};

export const generateMOA = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const { error, value } = schemas.generateMOA.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const result = await acquisitionService.generateDynamicMOA(intakeId, value);
        res.status(200).json(result);
    } catch (error) { next(error); }
};

export const confirmDelivery = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const { error, value } = schemas.confirmDelivery.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const intake = await acquisitionService.confirmPhysicalDelivery(intakeId, value.slipId);
        res.status(200).json({ message: "Physical delivery confirmed.", intake });
    } catch (error) { next(error); }
};

export const processAccession = async (req, res, next) => {
    try {
        const { intakeId } = req.params;
        const { error, value } = schemas.processAccession.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const accession = await acquisitionService.processAccession(intakeId, value);
        res.status(201).json({ message: "Artifact formally accessioned.", accession });
    } catch (error) { next(error); }
};

export const updateResearch = async (req, res, next) => {
    try {
        const { accessionId } = req.params;
        const { error, value } = schemas.updateResearch.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const accession = await acquisitionService.updateAccessionResearch(accessionId, value);
        res.status(200).json({ message: "Research notes saved.", accession });
    } catch (error) { next(error); }
};

export const finalizeInventory = async (req, res, next) => {
    try {
        const { accessionId } = req.params;
        const { error, value } = schemas.finalizeInventory.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const inventory = await acquisitionService.finalizeToInventory(accessionId, value);
        res.status(201).json({ message: "Artifact fully cataloged into active inventory.", inventory });
    } catch (error) { 
        // Catch the specific strict validation error from the service
        if (error.message.includes('Missing required research fields')) {
            return res.status(400).json({ error: error.message });
        }
        next(error); 
    }
};