import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import fs from 'fs';
import path from 'path';

const resourceMap = {
    'inventory': 'Inventory',
    'accession': 'Accession',
    'accessions': 'Accession',
    'intake': 'Intake',
    'intakes': 'Intake',
    'submission': 'Submission',
    'form_submissions': 'Submission',
    'articles': 'Article',
    'users': 'User',
    'media_attachments': 'Inventory',
    'condition_reports': 'Inventory',
    'appointments': 'Appointment'
};

const getCaslResource = (collection) => {
    if (resourceMap[collection]) return resourceMap[collection];
    return null;
};

export const getPrivateFile = async (req, res, next) => {
    try {
        const { collection, recordId, filename } = req.params;

        // 1. Enforce RBAC mapping
        const caslResource = getCaslResource(collection);
        if (caslResource && req.ability.cannot('read', caslResource)) {
            logger.warn(`Unauthorized file access attempt`, { user: req.user?.id, collection, filename });
            return res.status(403).json({ error: "Forbidden: You do not have permission to view this file." });
        }

        // 2. Fetch File Metadata via Junction Link
        const rows = await db.query(
            `SELECT m.* 
             FROM media_metadata m
             JOIN media_links l ON m.id = l.media_id
             WHERE l.entity_type = ? AND l.entity_id = ? AND m.file_name = ?`,
            [collection, recordId, filename]
        );

        const fileData = rows[0];

        if (!fileData) {
            return res.status(404).json({ error: "File not found." });
        }

        // 3. Stream from local file system
        const targetPath = path.join(env.uploadDir, fileData.storage_key);

        if (!fs.existsSync(targetPath)) {
            logger.error(`File missing on disk: ${targetPath}`);
            return res.status(404).json({ error: "File not found on disk." });
        }

        res.setHeader('Content-Type', fileData.mime_type);
        res.setHeader('Content-Length', fileData.size_bytes);
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        const dataStream = fs.createReadStream(targetPath);
        dataStream.pipe(res);

    } catch (error) {
        logger.error('File Proxy Error', { error: error.message });
        res.status(500).json({ error: "Error retrieving file." });
    }
};