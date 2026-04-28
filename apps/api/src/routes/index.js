import { Router } from 'express';
import testRoutes from './testRoutes.js'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import sseRoutes from './sseRoutes.js'
import fileRoutes from './fileRoutes.js'
import uploadRoutes from './uploadRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import acquisitionRoutes from './acquisitionRoutes.js' 
import formRoutes from './formRoutes.js' // 1. Import form routes

const router = Router();

router.use('/test', testRoutes);
router.use('/auth', authRoutes); 
router.use('/user', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/upload', uploadRoutes); 
router.use('/file', fileRoutes);
router.use('/realtime', sseRoutes);
router.use('/acquisitions', acquisitionRoutes);
router.use('/forms', formRoutes); // 2. Mount to /forms

export default router;