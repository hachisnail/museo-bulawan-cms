import { pbService } from '../services/pocketbaseService.js';
import { logger } from '../utils/logger.js';
import { Readable } from 'stream';

// Map PocketBase collection names to your CASL Resource names
const resourceMap = {
    'artifacts': 'Artifact',
    'inventory': 'Inventory',
    'accessions': 'Accession',
    'intakes': 'Intake',
    'articles': 'Article',
    'form_submissions': 'Intake',
    'users': 'User',
    'media_attachments': 'Inventory',
    'condition_reports': 'Inventory'
};

// Resolve collection name/ID to CASL resource
const getCaslResource = (collection) => {
    if (resourceMap[collection]) return resourceMap[collection];
    // Handle system-prefixed IDs
    if (collection.startsWith('pbc_media_attachments')) return 'Inventory';
    if (collection.startsWith('pbc_condition_reports')) return 'Inventory';
    if (collection.startsWith('pbc_accessions')) return 'Accession';
    return null;
};

export const getPrivateFile = async (req, res, next) => {
    try {
        const { collection, recordId, filename } = req.params;

        // 1. Check CASL RBAC
        const caslResource = getCaslResource(collection);
        
        // Admins can bypass resource mapping if it's a known system collection
        if (!caslResource && req.user?.role !== 'admin') {
            return res.status(400).json({ error: "Invalid collection requested." });
        }

        // Only enforce RBAC if we found a resource mapping
        if (caslResource && req.ability.cannot('read', caslResource)) {
            logger.warn(`Unauthorized file access attempt`, { user: req.user?.id, collection, filename });
            return res.status(403).json({ error: "Forbidden: You do not have permission to view this file." });
        }

        // 2. Request the file from PocketBase using the official SDK method
        // This handles MinIO/S3 vs Local storage automatically
        try {
            const record = await pbService.pb.collection(collection).getOne(recordId);
            
            let targetRecord = record;
            let targetCollection = collection;

            // Handle Promoted Media from Submission
            // If this is a media attachment record pointing to a submission source
            if (collection === 'media_attachments' && record.metadata?.source_collection) {
                try {
                    targetCollection = record.metadata.source_collection;
                    targetRecord = await pbService.pb.collection(targetCollection).getOne(record.metadata.source_id);
                } catch (sourceErr) {
                    logger.warn(`Could not resolve promoted source record`, { sourceId: record.metadata.source_id });
                    // Fall back to the original record (it might still have the files if they were re-uploaded)
                }
            }
            
            // Generate a file token for the specific record
            // This is the most reliable way to access protected files in PB
            const fileToken = await pbService.pb.files.getToken();
            const fileUrl = pbService.pb.files.getURL(targetRecord, filename, { token: fileToken });
            
            logger.info(`Proxying file from PB`, { fileUrl, isPromoted: targetCollection !== collection });

            const response = await fetch(fileUrl, {
                headers: {
                    'Authorization': `Admin ${pbService.pb.authStore.token}`
                }
            });
            
            if (!response.ok) {
                // Log the sensitive details to the SERVER console only
                const errorBody = await response.text().catch(() => 'No body');
                logger.error(`File fetch from PocketBase failed with status ${response.status}`, { 
                    fileUrl, 
                    errorBody 
                });
                
                // Return a safe, generic error to the CLIENT
                return res.status(response.status).json({ 
                    error: "File not found in storage or is inaccessible." 
                });
            }

            // 3. Forward headers and stream
            res.setHeader('Content-Type', response.headers.get('Content-Type'));
            res.setHeader('Content-Length', response.headers.get('Content-Length'));
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

            const nodeStream = Readable.fromWeb(response.body);
            nodeStream.pipe(res);
            
        } catch (pbError) {
            logger.error(`PB Record Fetch Failed`, { collection, recordId, error: pbError.message });
            return res.status(404).json({ error: "Record not found or inaccessible." });
        }

    } catch (error) {
        logger.error('File Proxy Error', { error: error.message });
        next(error);
    }
};