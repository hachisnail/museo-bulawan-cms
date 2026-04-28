import { Router } from 'express';
import multer from 'multer';
import * as formController from '../controllers/formController.js';
import { strictActionLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// ==========================================
// ABUSE PREVENTION: Strict Form Upload Limits
// ==========================================
const formUpload = multer({ 
    dest: 'uploads/',
    limits: { 
        fileSize: 15 * 1024 * 1024, // Hard limit: 15MB per file
        files: 5                    // Hard limit: Max 5 files per submission
    }
});

// Route to fetch dynamic schema
router.get('/:slug', formController.getFormDefinition);

// Protected OTP request route
router.post('/:slug/request-otp', strictActionLimiter, formController.requestOtp);

// Submission route with file support
router.post('/:slug/submit', formUpload.array('attachments', 5), formController.submitForm);

export default router;