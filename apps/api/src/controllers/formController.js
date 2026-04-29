import Joi from 'joi';
import { formService } from '../services/formService.js';

const schemas = {
    requestOtp: Joi.object({
        email: Joi.string().email().required()
    }),
    submitForm: Joi.object({
        data: Joi.string().required(), // JSON string from multipart/form-data
        otp: Joi.string().length(6).pattern(/^[0-9]+$/).optional()
    })
};

export const getFormDefinition = async (req, res, next) => {
    try {
        const definition = await formService.getFormDefinition(req.params.slug);
        res.status(200).json(definition);
    } catch (error) {
        next(error);
    }
};

export const requestOtp = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { error, value } = schemas.requestOtp.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const result = await formService.requestEmailOtp(slug, value.email);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const verifyOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        const result = await formService.verifyOtp(email, otp);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const submitForm = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { error, value } = schemas.submitForm.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        let parsedData;
        try {
            parsedData = JSON.parse(value.data);
        } catch (err) {
            return res.status(400).json({ error: "Invalid JSON format in data field." });
        }

        const files = req.files || null;

        // Pass request metadata for anonymous fingerprinting
        const requestMeta = {
            ip: req.ip || req.connection?.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown'
        };

        const result = await formService.submitForm(slug, parsedData, value.otp, files, requestMeta, req.user?.id);
        
        res.status(201).json({
            message: "Submission received successfully.",
            id: result.id
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// STAFF / ADMIN ENDPOINTS
// ==========================================

export const listSubmissions = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const result = await formService.listSubmissions(slug, req.query);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * List all submissions across all forms (no slug needed).
 * Used by the admin Submissions overview page.
 */
export const listAllSubmissions = async (req, res, next) => {
    try {
        const result = await formService.listAllSubmissions(req.query);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single submission with full detail + linked donation items.
 */
export const getSubmission = async (req, res, next) => {
    try {
        const { submissionId } = req.params;
        const submission = await formService.getSubmission(submissionId);
        const items = await formService.getSubmissionItems(submissionId);
        res.status(200).json({ status: 'success', data: { submission, items } });
    } catch (error) {
        next(error);
    }
};