import Joi from 'joi';

/**
 * Acquisition Validation Schemas
 * 
 * Centralized schemas for all acquisition-related actions.
 */
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
        accessionNumber: Joi.string().optional(),
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
        catalogNumber: Joi.string().optional(),
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
    }),

    conservationLog: Joi.object({
        treatment: Joi.string().required(),
        findings: Joi.string().required(),
        recommendations: Joi.string().allow('', null).default('')
    })
};
