import { pbService } from '../services/pocketbaseService.js';
import { auditService } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

/**
 * Central media attachments service.
 * Uses polymorphic entity_type + entity_id pattern to link media
 * to any entity: inventory items, accessions, intakes, etc.
 */
export const mediaService = {
    /**
     * Upload media files and attach them to an entity.
     */
    async attachMedia(userId, entityType, entityId, files, caption = '') {
        const pbUserId = await pbService.getAppUserId(userId);

        const record = await pbService.uploadInternal('media_attachments', files, {
            entity_type: entityType,
            entity_id: entityId,
            caption: caption,
            uploaded_by: pbUserId
        }, 'files');

        await auditService.log({
            collection: 'media_attachments',
            recordId: record.id,
            action: 'create',
            userId: userId,
            before: null,
            after: record
        });

        return record;
    },

    /**
     * List all media for an entity.
     */
    async listMedia(entityType, entityId, query = {}) {
        const page = query.page || 1;
        const perPage = query.perPage || 50;

        return await pbService.pb.collection('media_attachments').getList(page, perPage, {
            filter: `entity_type="${entityType}" && entity_id="${entityId}"`,
            sort: query.sort || '-created'
        });
    },

    /**
     * Delete a media attachment.
     */
    async deleteMedia(userId, mediaId) {
        const existing = await pbService.pb.collection('media_attachments').getOne(mediaId);
        await pbService.pb.collection('media_attachments').delete(mediaId);

        await auditService.log({
            collection: 'media_attachments',
            recordId: mediaId,
            action: 'delete',
            userId: userId,
            before: existing,
            after: null
        });

        return { deleted: true };
    }
};
