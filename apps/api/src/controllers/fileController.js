import { pbService } from '../services/pocketbaseService.js';
import { logger } from '../utils/logger.js';

// Map PocketBase collection names to your CASL Resource names
const resourceMap = {
    'artifacts': 'Artifact',
    'inventory': 'Inventory',
    'accessions': 'Accession',
    'articles': 'Article',
    'users': 'User' // Add this line
};

export const getPrivateFile = async (req, res, next) => {
    try {
        const { collection, recordId, filename } = req.params;

        // 1. Check CASL RBAC
        const caslResource = resourceMap[collection];
        
        if (!caslResource) {
            return res.status(400).json({ error: "Invalid collection requested." });
        }

        if (req.ability.cannot('read', caslResource)) {
            logger.warn(`Unauthorized file access attempt`, { user: req.user?.id, collection, filename });
            return res.status(403).json({ error: "Forbidden: You do not have permission to view this file." });
        }

        // 2. Request the file from PocketBase using the Admin Client
        // Using pb.buildUrl to get the correct internal S3-proxied URL
        const fileUrl = pbService.pb.buildUrl(`/api/files/${collection}/${recordId}/${filename}`);
        
        // Use native Node fetch with the PB Admin Auth Token
        const response = await fetch(fileUrl, {
            headers: {
                'Authorization': pbService.pb.authStore.token
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: "File not found or inaccessible in storage." });
        }

        // 3. Forward the content headers (e.g., image/jpeg)
        res.setHeader('Content-Type', response.headers.get('Content-Type'));
        res.setHeader('Content-Length', response.headers.get('Content-Length'));

        // 4. Stream the file data from PocketBase -> Express -> Frontend
        // Node's Web Streams API allows us to pipe it efficiently without eating RAM
        const nodeStream = require('stream').Readable.fromWeb(response.body);
        nodeStream.pipe(res);

    } catch (error) {
        logger.error('File Proxy Error', { error: error.message });
        next(error);
    }
};