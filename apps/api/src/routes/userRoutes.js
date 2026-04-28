import { Router } from "express";
import * as userController from '../controllers/userController.js';
import { buildAbility, checkPermission } from '../middlewares/authorizationHandler.js';
import { strictActionLimiter } from "../middlewares/rateLimiter.js"; // <-- Import it

const router = Router();

router.post('/onboard', strictActionLimiter, userController.onboardAdmin);

router.post('/setup', userController.completeSetup); 

router.post('/forgot-password', strictActionLimiter, userController.requestPasswordReset);
router.post('/reset-password', userController.resetPassword);


router.use(buildAbility); 

router.post('/invite', strictActionLimiter, checkPermission('manage', 'User'), userController.inviteUser);

export default router;