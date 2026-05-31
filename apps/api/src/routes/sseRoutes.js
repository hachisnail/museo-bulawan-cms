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
    if (req.ability.can('read', 'Inventory')) allowedChannels.push('inventory', 'media_attachments');
    if (req.ability.can('read', 'Accession') || req.user.role === 'donor') allowedChannels.push('accessions');
    if (req.ability.can('read', 'Intake') || req.user.role === 'donor') allowedChannels.push('intakes', 'form_submissions');
    
    // 3. User-specific private channel
    allowedChannels.push(`user_${req.user.id}`);

    const connectionId = crypto.randomUUID();
    
    sseManager.addClient(req, res, connectionId, allowedChannels);
});

export default router;