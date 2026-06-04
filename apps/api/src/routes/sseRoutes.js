import { Router } from 'express';
import crypto from 'crypto'; 
import { sseManager } from '../utils/sseFactory.js';
import { requireAuth, buildAbility } from '../middlewares/authorizationHandler.js';

const router = Router();

// Allow any authenticated user (staff or donor) with a valid session
router.use((req, res, next) => {
    if (!req.isAuthenticated() || req.session.loginInstanceId !== req.user.current_session_id) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
});
router.use(buildAbility);

router.get('/stream', (req, res) => {
    // Channels determined by authenticated user's RBAC abilities
    const allowedChannels = [
        'global', 
        `role_${req.user.role}`
    ];
    
    // MariaDB Resource channels
    if (req.ability.can('read', 'Inventory')) {
        allowedChannels.push('inventory', 'media_attachments');
    }
    if (req.ability.can('read', 'Accession') || req.user.role === 'donor') {
        allowedChannels.push('accessions');
    }
    if (req.ability.can('read', 'Intake') || req.user.role === 'donor') {
        allowedChannels.push('intakes', 'form_submissions');
    }

    // Appointments & Schedules — available to appointment coordinators and above
    if (req.ability.can('manage', 'Appointment') || req.ability.can('create', 'Appointment')) {
        allowedChannels.push('appointments', 'appointment', 'appointmentstatus');
    }
    // Schedules are managed by appointment coordinators (who can manage Appointment)
    if (req.ability.can('manage', 'Appointment')) {
        allowedChannels.push('schedules', 'schedule');
    }

    // Forms — available to users who can manage submissions or all
    if (req.ability.can('manage', 'Submission') || req.ability.can('manage', 'all')) {
        allowedChannels.push('form_definitions', 'submission');
    }

    // User management (admins only)
    if (req.ability.can('manage', 'User')) {
        allowedChannels.push('users');
    }

    // User-specific private channel
    allowedChannels.push(`user_${req.user.id}`);

    const connectionId = crypto.randomUUID();
    
    sseManager.addClient(req, res, connectionId, allowedChannels);
});

export default router;