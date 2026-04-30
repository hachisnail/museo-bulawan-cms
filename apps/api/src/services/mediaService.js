import { db } from '../config/db.js';
import { minioClient } from '../services/minioService.js';
import { auditService } from '../services/auditService.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { ulid } from 'ulidx';

export const mediaService = {
    /**
     * Upload media files directly to MinIO and attach them to a DB entity using a junction link.
     */
    async attachMedia(userId, entityType, entityId, files, context = 'attachment', connection = null) {
        const uploadedLinks = [];

        for (const file of files) {
            const mediaId = ulid();
            const linkId = ulid();
            
            const extension = file.originalname.split('.').pop();
            const storageKey = `media/${mediaId}.${extension}`; // Normalized storage path

            // 1. Stream to MinIO
            if (file.buffer) {
                await minioClient.putObject(env.minio.bucket, storageKey, file.buffer, file.size, {
                    'Content-Type': file.mimetype
                });
            } else {
                await minioClient.fPutObject(env.minio.bucket, storageKey, file.path, {
                    'Content-Type': file.mimetype
                });
            }

            // 2. Write to Media Metadata (Single Source of Truth)
            await db.executeAndBroadcast(`
                INSERT INTO media_metadata 
                (id, file_name, storage_key, mime_type, size_bytes, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [mediaId, file.originalname, storageKey, file.mimetype, file.size, userId], 
            'create', 'media_metadata', mediaId, connection);

            // 3. Create the Junction Link
            await db.executeAndBroadcast(`
                INSERT INTO media_links 
                (id, media_id, entity_type, entity_id, context)
                VALUES (?, ?, ?, ?, ?)
            `, [linkId, mediaId, entityType, entityId, context], 
            'create', 'media_links', linkId, connection);

            uploadedLinks.push({
                link_id: linkId,
                media_id: mediaId,
                entity_type: entityType,
                entity_id: entityId,
                storage_key: storageKey
            });

            // Log Audit
            await auditService.log({
                collection: 'media_links',
                recordId: linkId,
                action: 'create',
                userId: userId,
                after: { mediaId, entityType, entityId, context }
            });
        }

        return uploadedLinks;
    },

    /**
     * List all media for an entity via the junction table.
     */
    async listMedia(entityType, entityId, query = {}, connection = null) {
        const page = query.page || 1;
        const perPage = query.perPage || 50;
        const offset = (page - 1) * perPage;

        const rows = await db.query(
            `SELECT m.*, l.id as link_id, l.context 
             FROM media_metadata m
             JOIN media_links l ON m.id = l.media_id
             WHERE l.entity_type = ? AND l.entity_id = ? 
             ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
            [entityType, entityId, perPage, offset],
            connection
        );
        
        return { items: rows, page, perPage };
    },

    /**
     * Delete a media link (and optionally the metadata if no other links exist).
     */
    async deleteMedia(userId, linkId, connection = null) {
        // 1. Fetch the link to find the media_id
        const links = await db.query(`SELECT * FROM media_links WHERE id = ?`, [linkId], connection);
        const link = links[0];
        if (!link) return { deleted: false };

        const mediaId = link.media_id;

        // 2. Remove the junction link
        await db.executeAndBroadcast(`DELETE FROM media_links WHERE id = ?`, [linkId], 'delete', 'media_links', linkId, connection);

        // 3. Check if any other links exist for this media
        const otherLinks = await db.query(`SELECT COUNT(*) as count FROM media_links WHERE media_id = ?`, [mediaId], connection);
        
        if (otherLinks[0].count === 0) {
            // No more references, safe to delete physical file and metadata
            const metadata = await db.query(`SELECT storage_key FROM media_metadata WHERE id = ?`, [mediaId], connection);
            if (metadata[0]) {
                await minioClient.removeObject(env.minio.bucket, metadata[0].storage_key);
            }
            await db.executeAndBroadcast(`DELETE FROM media_metadata WHERE id = ?`, [mediaId], 'delete', 'media_metadata', mediaId, connection);
            logger.info(`Purged unreferenced media metadata: ${mediaId}`);
        }

        await auditService.log({
            collection: 'media_links',
            recordId: linkId,
            action: 'delete',
            userId: userId,
            before: link,
            after: null
        });

        return { deleted: true };
    },

    /**
     * Promotes media from a submission to a formal entity (e.g., Accession).
     * Creates new junction links pointing to the same media metadata.
     */
    async promoteSubmissionMedia(userId, submissionId, targetType, targetId, connection = null) {
        const submissionMedia = await this.listMedia('form_submissions', submissionId, {}, connection);
        const promoted = [];

        for (const item of submissionMedia.items) {
            const linkId = ulid();
            await db.executeAndBroadcast(`
                INSERT INTO media_links 
                (id, media_id, entity_type, entity_id, context)
                VALUES (?, ?, ?, ?, ?)
            `, [linkId, item.id, targetType, targetId, 'Promoted from Submission'], 
            'create', 'media_links', linkId, connection);

            promoted.push(linkId);

            await auditService.log({
                collection: 'media_links',
                recordId: linkId,
                action: 'promote',
                userId: userId,
                after: { mediaId: item.id, targetType, targetId }
            });
        }

        if (promoted.length > 0) {
            logger.info(`Promoted ${promoted.length} media items from submission ${submissionId} to ${targetType} ${targetId}`);
        }

        return promoted;
    }
};