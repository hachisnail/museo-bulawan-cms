import { Router } from 'express';
import crypto from 'crypto'; 
import { sseManager } from '../utils/sseFactory.js';
import { requireAuth, buildAbility } from '../middlewares/authorizationHandler.js';

const router = Router();

router.use(requireAuth);
router.use(buildAbility);

router.get('/stream', (req, res) => {
    // Channels determined by authenticated user's RBAC abilities
    const allowedChannels = [
        'global', 
        `role_${req.user.role}`
    ];
    
    // MariaDB Resource channels
    if (req.ability.can('read', 'Inventory')) allowedChannels.push('inventory', 'media_attachments');
    if (req.ability.can('read', 'Accession')) allowedChannels.push('accessions');
    if (req.ability.can('read', 'Intake')) allowedChannels.push('intakes', 'form_submissions');
    
    // 3. User-specific private channel
    allowedChannels.push(`user_${req.user.id}`);

    const connectionId = crypto.randomUUID();
    
    sseManager.addClient(req, res, connectionId, allowedChannels);
});

export default router;