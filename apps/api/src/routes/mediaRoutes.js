import { Router } from 'express';
import multer from 'multer';
import { mediaService } from '../services/mediaService.js';
import { requireAuth, buildAbility, checkPermission } from '../middlewares/authorizationHandler.js';

const router = Router();

const mediaUpload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB per file
        files: 10
    }
});

// Map entity types to CASL resources for permission checks
const entityPermissionMap = {
    'inventory': 'Inventory',
    'accession': 'Accession',
    'accessions': 'Accession',
    'intake': 'Intake',
    'intakes': 'Intake',
    'submission': 'Submission',
    'form_submissions': 'Submission'
};

router.use(requireAuth);
router.use(buildAbility);

// Upload media to an entity (via body params - matches frontend Accessions.jsx)
router.post('/upload', mediaUpload.array('files', 10), async (req, res, next) => {
    try {
        const { entity_type, entity_id, caption } = req.body;
        const caslResource = entityPermissionMap[entity_type];

        if (!caslResource) {
            return res.status(400).json({ error: `Invalid entity type: ${entity_type}` });
        }
        if (req.ability.cannot('manage', caslResource)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files provided.' });
        }

        const record = await mediaService.attachMedia(
            req.user.id,
            entity_type,
            entity_id,
            req.files,
            caption || ''
        );

        res.status(201).json({ message: 'Media uploaded.', data: record });
    } catch (error) { next(error); }
});

// Upload media to an entity (via URL params)
router.post('/:entityType/:entityId', mediaUpload.array('files', 10), async (req, res, next) => {
    try {
        const { entityType, entityId } = req.params;
        const caslResource = entityPermissionMap[entityType];

        if (!caslResource) {
            return res.status(400).json({ error: `Invalid entity type: ${entityType}` });
        }
        if (req.ability.cannot('manage', caslResource)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files provided.' });
        }

        const record = await mediaService.attachMedia(
            req.user.id,
            entityType,
            entityId,
            req.files,
            req.body.caption || ''
        );

        res.status(201).json({ message: 'Media uploaded.', data: record });
    } catch (error) { next(error); }
});

// List media for an entity
router.get('/:entityType/:entityId', async (req, res, next) => {
    try {
        const { entityType, entityId } = req.params;
        const caslResource = entityPermissionMap[entityType];

        if (!caslResource) {
            return res.status(400).json({ error: `Invalid entity type: ${entityType}` });
        }
        if (req.ability.cannot('read', caslResource)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }

        const result = await mediaService.listMedia(entityType, entityId, req.query);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) { next(error); }
});

// Delete a specific media attachment
router.delete('/:mediaId', checkPermission('manage', 'Inventory'), async (req, res, next) => {
    try {
        await mediaService.deleteMedia(req.user.id, req.params.mediaId);
        res.status(200).json({ message: 'Media deleted.' });
    } catch (error) { next(error); }
});

export default router;
