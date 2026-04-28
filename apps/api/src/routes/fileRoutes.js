import { Router } from "express";
import { getPrivateFile } from '../controllers/fileController.js';
import { buildAbility } from '../middlewares/authorizationHandler.js';

const router = Router();

router.use(buildAbility);

router.get('/:collection/:recordId/:filename', getPrivateFile);

export default router;