import { Router } from "express";
import { getPrivateFile } from '../controllers/fileController.js';
import { requireAuth, buildAbility } from '../middlewares/authorizationHandler.js';

const router = Router();

router.use(requireAuth);
router.use(buildAbility);

router.get('/:collection/:recordId/:filename', getPrivateFile);

export default router;