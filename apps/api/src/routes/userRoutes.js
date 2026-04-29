import { Router } from "express";
import * as userController from '../controllers/userController.js';
import { requireAuth, buildAbility, checkPermission } from '../middlewares/authorizationHandler.js';
import { strictActionLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

// ==========================================
// PUBLIC ROUTES (no auth required)
// ==========================================
router.post('/onboard', strictActionLimiter, userController.onboardAdmin);
router.post('/setup', userController.completeSetup);
router.post('/forgot-password', strictActionLimiter, userController.requestPasswordReset);
router.post('/reset-password', userController.resetPassword);

// ==========================================
// AUTHENTICATED ROUTES (self-edit)
// ==========================================
router.use(requireAuth);
router.use(buildAbility);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.patch('/me/password', userController.changeMyPassword);

// ==========================================
// ADMIN-ONLY ROUTES (manage other users)
// ==========================================
router.get('/', checkPermission('manage', 'User'), userController.listUsers);
router.post('/invite', strictActionLimiter, checkPermission('manage', 'User'), userController.inviteUser);
router.patch('/:id', checkPermission('manage', 'User'), userController.updateUser);
router.patch('/:id/deactivate', checkPermission('manage', 'User'), userController.deactivateUser);
router.post('/:id/force-logout', checkPermission('manage', 'User'), userController.forceLogoutUser);
router.post('/:id/resend-invite', checkPermission('manage', 'User'), userController.resendInvite);

export default router;