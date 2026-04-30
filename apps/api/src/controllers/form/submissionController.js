import { formService } from '../../services/formService.js';
import { schemas } from './schemas.js';

/**
 * SubmissionController
 * 
 * Handles public-facing form actions: definition retrieval, OTP flows, and submissions.
 */
export const submissionController = {
    async getFormDefinition(req, res, next) {
        try {
            const definition = await formService.getFormDefinition(req.params.slug);
            res.status(200).json(definition);
        } catch (error) { next(error); }
    },

    async requestOtp(req, res, next) {
        try {
            const { slug } = req.params;
            const { error, value } = schemas.requestOtp.validate(req.body);
            if (error) return res.status(400).json({ error: error.details[0].message });

            const result = await formService.requestEmailOtp(slug, value.email);
            res.status(200).json(result);
        } catch (error) { next(error); }
    },

    async verifyOtp(req, res, next) {
        try {
            const { email, otp } = req.body;
            const result = await formService.verifyOtp(email, otp);
            res.status(200).json(result);
        } catch (error) { next(error); }
    },

    async submitForm(req, res, next) {
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
            const requestMeta = {
                ip: req.ip || req.connection?.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown'
            };

            const result = await formService.submitForm(slug, parsedData, value.otp, files, requestMeta, req.user?.id);
            
            res.status(201).json({
                message: "Submission received successfully.",
                id: result.id
            });
        } catch (error) { next(error); }
    }
};
