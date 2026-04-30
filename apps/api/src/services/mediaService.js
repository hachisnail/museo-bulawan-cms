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
     * Promote files from a form submission directly to the media_attachments collection.
     * This is used when a submission is processed into a formal intake/accession.
     */
    async promoteSubmissionMedia(userId, submissionId, entityType, entityId) {
        try {
            const submission = await pbService.pb.collection('form_submissions').getOne(submissionId);
            const files = submission.supporting_documents || [];
            
            if (files.length === 0) return [];

            const pbUserId = await pbService.getAppUserId(userId);
            
            // Create a formal attachment record pointing to the same files
            // Note: In PocketBase, moving files between collections usually requires re-uploading,
            // but we can create the record and staff can re-upload or we can handle it via proxy.
            // For now, we formally register the event.
            const record = await pbService.pb.collection('media_attachments').create({
                entity_type: entityType,
                entity_id: entityId,
                caption: 'Original Donor Documentation (Promoted)',
                uploaded_by: pbUserId,
                // We store the source info to help the proxy find the original file
                metadata: {
                    source_collection: 'form_submissions',
                    source_id: submissionId,
                    original_field: 'supporting_documents'
                }
            });

            return record;
        } catch (error) {
            logger.error(`Error promoting submission media: ${error.message}`);
            return null;
        }
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
