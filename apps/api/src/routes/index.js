import { Router } from 'express';
import { buildAbility } from '../middlewares/authorizationHandler.js';
import authRoutes from './authRoutes.js'
import userRoutes from './user/index.js'
import sseRoutes from './sseRoutes.js'
import fileRoutes from './fileRoutes.js'
import uploadRoutes from './uploadRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import acquisitionRoutes from './acquisition/index.js' 
import formRoutes from './form/index.js'
import auditRoutes from './auditRoutes.js'
import mediaRoutes from './mediaRoutes.js'
import analyticsRoutes from './analyticsRoutes.js'

const router = Router();

// Apply ability builder globally for all API routes to ensure RBAC is initialized
router.use(buildAbility);

router.use('/auth', authRoutes); 
router.use('/user', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/upload', uploadRoutes); 
router.use('/files', fileRoutes);
router.use('/realtime', sseRoutes);
router.use('/acquisitions', acquisitionRoutes);
router.use('/forms', formRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/media', mediaRoutes);
router.use('/analytics', analyticsRoutes);

export default router;