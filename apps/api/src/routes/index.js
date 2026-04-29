import { Router } from 'express';
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import sseRoutes from './sseRoutes.js'
import fileRoutes from './fileRoutes.js'
import uploadRoutes from './uploadRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import acquisitionRoutes from './acquisitionRoutes.js' 
import formRoutes from './formRoutes.js'
import auditRoutes from './auditRoutes.js'
import mediaRoutes from './mediaRoutes.js'

const router = Router();

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

export default router;