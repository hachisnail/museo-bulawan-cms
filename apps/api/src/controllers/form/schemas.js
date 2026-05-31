import Joi from 'joi';

/**
 * Form Validation Schemas
 * 
 * Schemas for OTP requests, form submissions, and definitions.
 */
export const schemas = {
    requestOtp: Joi.object({
        email: Joi.string().email().required()
    }),
    submitForm: Joi.object({
        data: Joi.string().required(), // JSON string from multipart/form-data
        otp: Joi.string().length(6).pattern(/^[0-9]+$/).optional()
    }),
    createDefinition: Joi.object({
        title: Joi.string().required(),
        slug: Joi.string().required().pattern(/^[a-z0-9-]+$/),
        type: Joi.string().valid('donation', 'appointment', 'feedback', 'custom', 'artifact_health', 'artifact_movement', 'artifact_conservation').default('custom'),
        schema_data: Joi.object().required(),
        settings: Joi.object().required(),
        otp: Joi.boolean().default(false)
    }),
    updateDefinition: Joi.object({
        title: Joi.string().optional(),
        slug: Joi.string().optional().pattern(/^[a-z0-9-]+$/),
        type: Joi.string().valid('donation', 'appointment', 'feedback', 'custom', 'artifact_health', 'artifact_movement', 'artifact_conservation').optional(),
        schema_data: Joi.object().optional(),
        settings: Joi.object().optional(),
        otp: Joi.boolean().optional()
    })
};

