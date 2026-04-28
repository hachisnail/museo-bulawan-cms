import { Router } from "express";
import * as testController from '../controllers/testController.js'

const router = Router();

router.get('/', testController.helloWorld);
router.post('/send-message', testController.postHelloWorld)
router.get('/:id', testController.getHelloById)

export default router;