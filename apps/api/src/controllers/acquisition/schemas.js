import Joi from 'joi';

/**
 * Acquisition Validation Schemas
 * 
 * Centralized schemas for all acquisition-related actions.
 */
export const schemas = {
    externalIntake: Joi.object({}),
    
    // L-5: Added description and quantity validation to internalIntake schema.
    internalIntake: Joi.object({
        itemName: Joi.string().max(255).required(),
        sourceInfo: Joi.string().max(255).default('Internal/Purchase'),
        method: Joi.string().valid('gift', 'loan', 'purchase', 'existing').required(),
        loanEndDate: Joi.date().iso().optional().allow(null),
        description: Joi.string().max(2000).optional().allow('', null),
        quantity: Joi.number().integer().min(1).max(10000).default(1).optional()
    }),
    
    rejectIntake: Joi.object({
        reason: Joi.string().max(1000).required()
    }),

    generateMOA: Joi.object({
        donorName: Joi.string().max(255).optional(),
        loanDuration: Joi.string().max(255).optional(),
        address: Joi.string().max(1000).optional()
    }),
    
    confirmDelivery: Joi.object({
        token: Joi.string().max(255).required()
    }),
    
    // M-1: Added format validation pattern for manually supplied accession numbers.
    processAccession: Joi.object({
        accessionNumber: Joi.string().pattern(/^\d{4}\.\d{3}\.\d{2}$/).optional().messages({
            'string.pattern.base': 'Accession number must match format YYYY.SEQ.BATCH (e.g., 2026.001.01)'
        }),
        conditionReport: Joi.string().max(5000).allow('', null),
        handlingInstructions: Joi.string().max(2000).allow('', null),
        isMoaSigned: Joi.boolean().default(false)
    }),

    approveAccession: Joi.object({
        notes: Joi.string().max(5000).allow('', null).default('')
    }),
    
    updateResearch: Joi.object({
        dimensions: Joi.string().max(255).optional().allow(''),
        materials: Joi.string().max(500).optional().allow(''),
        research_notes: Joi.string().max(10000).optional().allow(''),
        historical_significance: Joi.string().max(10000).optional().allow(''),
        tags: Joi.string().max(255).optional().allow(''),
        research_completed: Joi.boolean().optional(),
        research_data: Joi.object().optional()
    }),
    
    // M-1 & M-3: Added imageSkipReason validation, required location, and format check for catalog number.
    finalizeInventory: Joi.object({
        catalogNumber: Joi.string().pattern(/^CAT-\d{4}-\d{5}$/).optional().messages({
            'string.pattern.base': 'Catalog number must match format CAT-YYYY-NNNNN (e.g., CAT-2026-00042)'
        }),
        location: Joi.string().max(255).required(),
        conditionReport: Joi.string().max(5000).allow('', null),
        imageSkipReason: Joi.string().max(1000).allow('', null).optional()
    }),

    // M-1: Required reason for location transfer.
    transferLocation: Joi.object({
        toLocation: Joi.string().max(255).required(),
        reason: Joi.string().max(1000).required()
    }),

    // M-1: Added missing batchTransfer validation schema.
    batchTransfer: Joi.object({
        inventoryIds: Joi.array().items(Joi.string().required()).min(1).required(),
        toLocation: Joi.string().max(255).required(),
        reason: Joi.string().max(1000).required(),
        extra: Joi.object().optional()
    }),

    deaccession: Joi.object({
        reason: Joi.string().max(1000).required()
    }),

    updateStatus: Joi.object({
        status: Joi.string().valid('active', 'maintenance', 'loan', 'storage', 'deaccessioned').required(),
        isManual: Joi.boolean().default(false),
        reason: Joi.string().max(1000).when('isManual', { is: true, then: Joi.required() })
    }),

    conditionReport: Joi.object({
        condition: Joi.string().max(255).required(),
        notes: Joi.string().max(5000).allow('', null).default('')
    }),

    conservationLog: Joi.object({
        treatment: Joi.string().max(5000).required(),
        findings: Joi.string().max(5000).required(),
        recommendations: Joi.string().max(5000).allow('', null).default('')
    }),

    auditCheck: Joi.object({
        auditType: Joi.string().valid('spot_check', 'full_audit', 'annual_review', 'random_sample').default('spot_check'),
        objectFound: Joi.boolean().default(true),
        locationVerified: Joi.boolean().default(true),
        numberLegible: Joi.boolean().default(true),
        conditionConsistent: Joi.boolean().default(true),
        discrepancyNotes: Joi.string().max(5000).allow('', null).default(null),
        auditedLocation: Joi.string().max(255).allow('', null).optional(),
        observedCondition: Joi.string().valid('Excellent', 'Good', 'Fair', 'Poor', 'Critical').optional()
    })
};
