import { Router } from 'express';
import multer from 'multer';
import { formController } from '../../controllers/formController.js';
import { strictActionLimiter, publicFormLimiter } from '../../middlewares/rateLimiter.js';
import { requireAuth, buildAbility, checkPermission } from '../../middlewares/authorizationHandler.js';

const router = Router();

// ==========================================
// ABUSE PREVENTION: Strict Form Upload Limits
// ==========================================
const formUpload = multer({ 
    dest: 'uploads/',
    limits: { 
        fileSize: 15 * 1024 * 1024, // 15MB
        files: 5                    // Max 5
    }
});

/**
 * Form Domain Routes
 * 
 * Handles public form definitions, OTP flows, and staff-facing submission management.
 */

// ==========================================
// PUBLIC ROUTES
// ==========================================
router.get('/:slug', formController.getFormDefinition);
router.post('/:slug/request-otp', strictActionLimiter, formController.requestOtp);
router.post('/:slug/verify-otp', strictActionLimiter, formController.verifyOtp);
router.post('/:slug/submit', publicFormLimiter, formUpload.array('attachments', 5), formController.submitForm);

// ==========================================
// ADMIN/STAFF ROUTES
// ==========================================
router.get('/admin/submissions', 
    requireAuth, 
    buildAbility, 
    checkPermission('read', 'Intake'), 
    formController.listAllSubmissions
);

router.get('/admin/submissions/:submissionId', 
    requireAuth, 
    buildAbility, 
    checkPermission('read', 'Intake'), 
    formController.getSubmission
);

router.get('/:slug/submissions', 
    requireAuth, 
    buildAbility, 
    checkPermission('read', 'Intake'), 
    formController.listSubmissions
);

export default router;
