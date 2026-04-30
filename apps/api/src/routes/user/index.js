import { Router } from "express";
import { userController } from "../../controllers/userController.js";
import { requireAuth, checkPermission } from "../../middlewares/authorizationHandler.js";
import { validate } from "../../middlewares/validateRequest.js";

const router = Router();
const schemas = userController.schemas;

/**
 * User Domain Routes
 * 
 * Handles all routes related to users: profile, security, and administrative management.
 */

// ==========================================
// PUBLIC / PRE-AUTH ROUTES
// ==========================================
router.post('/onboard-admin', userController.onboardAdmin);
router.post('/complete-setup', userController.completeSetup);
router.post('/request-reset', userController.requestPasswordReset);
router.post('/reset-password', userController.resetPassword);

// ==========================================
// SELF-EDIT (AUTHENTICATED)
// ==========================================
router.get('/me', requireAuth, userController.getMe);
router.patch('/me', requireAuth, validate(schemas.updateProfile), userController.updateMe);
router.post('/me/change-password', requireAuth, validate(schemas.changePassword), userController.changeMyPassword);

// ==========================================
// ADMIN MANAGEMENT (STAFF ONLY)
// ==========================================
router.get('/', requireAuth, checkPermission('read', 'User'), userController.listUsers);

router.post('/invite', 
    requireAuth, 
    checkPermission('create', 'User'), 
    validate(schemas.invite), 
    userController.inviteUser
);

router.post('/:id/resend-invite', 
    requireAuth, 
    checkPermission('update', 'User'), 
    userController.resendInvite
);

router.patch('/:id', 
    requireAuth, 
    checkPermission('update', 'User'), 
    validate(schemas.adminUpdateUser), 
    userController.updateUser
);

router.post('/:id/deactivate', 
    requireAuth, 
    checkPermission('delete', 'User'), 
    userController.deactivateUser
);

router.post('/:id/force-logout', 
    requireAuth, 
    checkPermission('manage', 'all'), 
    userController.forceLogoutUser
);

export default router;
