import Joi from 'joi';
import { formService } from '../services/formService.js';
// import { validateRequest } from '../utils/validateRequest.js';

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

export const submitForm = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { error, value } = schemas.submitForm.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        // Parse the stringified JSON data sent by Multer/FormData
        let parsedData;
        try {
            parsedData = JSON.parse(value.data);
        } catch (err) {
            return res.status(400).json({ error: "Invalid JSON format in data field." });
        }

        // Multiple files from formUpload.array('attachments') are in req.files
        const files = req.files || null;

        const result = await formService.submitForm(slug, parsedData, value.otp, files);
        
        res.status(201).json({
            message: "Submission received successfully.",
            id: result.id
        });
    } catch (error) {
        next(error);
    }
};