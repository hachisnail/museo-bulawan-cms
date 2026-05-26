import { Router } from "express";
import * as authController from '../controllers/authController.js';
import { authLimiter } from "../middlewares/rateLimiter.js"; 

const router = Router();

router.post('/login', authLimiter, authController.login);
router.post('/login-visitor', authLimiter, authController.loginVisitor);
router.post('/logout', authController.logout); 
router.get('/check', authController.check);

export default router;