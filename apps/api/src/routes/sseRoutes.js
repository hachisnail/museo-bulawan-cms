import { Router } from 'express';
import crypto from 'crypto'; 
import { sseManager } from '../utils/sseFactory.js';
import { buildAbility } from '../middlewares/authorizationHandler.js';

const router = Router();

router.use(buildAbility);

router.get('/stream', (req, res) => {
    if (!req.user || req.user.role === 'guest') {
        return res.status(401).json({ error: "Unauthorized. You must be logged in to access real-time streams." });
    }

    // 1. Initialize with Global and Role-based channels
    const allowedChannels = [
        'global', 
        `role_${req.user.role}`
    ];
    
    // 2. Resource-based channels (via CASL RBAC)
    if (req.ability.can('read', 'Inventory')) allowedChannels.push('inventory');
    if (req.ability.can('read', 'Accession')) allowedChannels.push('accessions');
    if (req.ability.can('read', 'Intake')) allowedChannels.push('intakes');
    if (req.ability.can('read', 'Appointment')) allowedChannels.push('appointments');

    // 3. User-specific private channel
    allowedChannels.push(`user_${req.user.id}`);

    const connectionId = crypto.randomUUID();
    
    sseManager.addClient(req, res, connectionId, allowedChannels);
});

export default router;