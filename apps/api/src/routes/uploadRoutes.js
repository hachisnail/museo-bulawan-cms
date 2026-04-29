import { Router } from "express";
import multer from 'multer';
import { handleUpload, handleDonationUpload } from '../controllers/uploadController.js';
import { requireAuth, buildAbility, checkPermission } from '../middlewares/authorizationHandler.js';
import { strictActionLimiter } from '../middlewares/rateLimiter.js'; 

const router = Router();

const upload = multer({ 
    dest: 'uploads/',
    limits: { 
        fileSize: 50 * 1024 * 1024 
    }
});

router.post('/donation', strictActionLimiter, upload.single('file'), handleDonationUpload);

router.use(requireAuth);
router.use(buildAbility);
router.post('/artifact', checkPermission('create', 'Artifact'), upload.single('file'), handleUpload);

export default router;