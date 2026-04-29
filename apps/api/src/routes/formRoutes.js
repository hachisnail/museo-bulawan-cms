import { Router } from 'express';
import multer from 'multer';
import * as formController from '../controllers/formController.js';
import { strictActionLimiter } from '../middlewares/rateLimiter.js';
import { requireAuth, buildAbility, checkPermission } from '../middlewares/authorizationHandler.js';

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

// ==========================================
// PUBLIC ROUTES
// ==========================================
// Route to fetch dynamic schema
router.get('/:slug', formController.getFormDefinition);

// Protected OTP request route
router.post('/:slug/request-otp', strictActionLimiter, formController.requestOtp);

// OTP Verification check (pre-submission)
router.post('/:slug/verify-otp', strictActionLimiter, formController.verifyOtp);

// Submission route with file support
router.post('/:slug/submit', strictActionLimiter, formUpload.array('attachments', 5), formController.submitForm);

// ==========================================
// ADMIN/STAFF ROUTES
// ==========================================

// All submissions across all forms (admin overview)
router.get('/admin/submissions', requireAuth, buildAbility, checkPermission('read', 'Intake'), formController.listAllSubmissions);

// Single submission detail with linked items
router.get('/admin/submissions/:submissionId', requireAuth, buildAbility, checkPermission('read', 'Intake'), formController.getSubmission);

// Submissions filtered by form slug
router.get('/:slug/submissions', requireAuth, buildAbility, checkPermission('read', 'Intake'), formController.listSubmissions);

export default router;