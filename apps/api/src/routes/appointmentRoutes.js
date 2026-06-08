import { Router } from 'express';
import { requireAuth } from '../middlewares/authorizationHandler.js';
import * as appointmentController from '../controllers/appointmentController.js';

const router = Router();
router.use(requireAuth);

// ── Static routes (must be declared before /:id to avoid shadowing) ───────────
router.get('/stats',            appointmentController.getAppointmentStats);
router.get('/visitor-records',  appointmentController.getVisitorRecords);

// ── Collection routes ─────────────────────────────────────────────────────────
router.get('/',              appointmentController.getAppointments);
router.post('/',             appointmentController.createAppointment);

// ── Single-resource routes ────────────────────────────────────────────────────
router.get('/:id',           appointmentController.getAppointmentById);
router.patch('/:id/status',  appointmentController.updateAppointmentStatus);
router.post('/:id/email',    appointmentController.sendAppointmentEmail);
router.delete('/:id',        appointmentController.deleteAppointment);

export default router;
