import Joi from 'joi';

/**
 * Form Validation Schemas
 * 
 * Schemas for OTP requests and form submissions.
 */
export const schemas = {
    requestOtp: Joi.object({
        email: Joi.string().email().required()
    }),
    submitForm: Joi.object({
        data: Joi.string().required(), // JSON string from multipart/form-data
        otp: Joi.string().length(6).pattern(/^[0-9]+$/).optional()
    })
};
