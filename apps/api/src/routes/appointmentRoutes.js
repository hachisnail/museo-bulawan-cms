import { Router } from 'express';
import { requireAuth } from '../middlewares/authorizationHandler.js';
import * as appointmentController from '../controllers/appointmentController.js';

const router = Router();
router.use(requireAuth);

router.get('/',              appointmentController.getAppointments);
router.get('/:id',           appointmentController.getAppointmentById);
router.post('/',             appointmentController.createAppointment);
router.patch('/:id/status',  appointmentController.updateAppointmentStatus);
router.delete('/:id',        appointmentController.deleteAppointment);

export default router;
