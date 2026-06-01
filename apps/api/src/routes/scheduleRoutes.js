import { Router } from 'express';
import { requireAuth } from '../middlewares/authorizationHandler.js';
import * as scheduleController from '../controllers/scheduleController.js';

const router = Router();
router.use(requireAuth);

router.get('/',          scheduleController.getSchedules);
router.get('/:id',       scheduleController.getScheduleById);
router.post('/',         scheduleController.createSchedule);
router.patch('/:id/status', scheduleController.updateScheduleStatus);
router.delete('/:id',    scheduleController.deleteSchedule);

export default router;
