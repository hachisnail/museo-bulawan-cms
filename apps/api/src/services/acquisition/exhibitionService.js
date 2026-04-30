import { baseService } from './baseService.js';
import { db } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { globalMutex } from '../../utils/mutex.js';

/**
 * ExhibitionService
 * 
 * Tracks museum events and artifact participation.
 */
export const exhibitionService = {
    async createExhibition(staffId, data) {
        return await baseService._createRecord(staffId, 'exhibitions', {
            title: data.title,
            venue: data.venue,
            start_date: data.startDate || null,
            end_date: data.endDate || null,
            curator_id: data.curatorId || staffId,
            description: data.description || '',
            status: data.status || 'planning'
        });
    },

    async updateExhibition(staffId, id, data) {
        return await baseService._updateRecord(staffId, id, data);
    },

    async addArtifactToExhibition(staffId, exhibitionId, inventoryId, displayNotes = '') {
        return await globalMutex.runExclusive(`exh_${exhibitionId}`, async () => {
            // Check if already in exhibition
            const existing = await db.query(
                `SELECT * FROM exhibition_artifacts WHERE exhibition_id = ? AND inventory_id = ?`,
                [exhibitionId, inventoryId]
            );
            if (existing.length > 0) return existing[0];

            return await baseService._createRecord(staffId, 'exhibition_artifacts', {
                exhibition_id: exhibitionId,
                inventory_id: inventoryId,
                display_notes: displayNotes
            });
        });
    },

    async removeArtifactFromExhibition(staffId, exhibitionId, inventoryId) {
        return await db.query(
            `DELETE FROM exhibition_artifacts WHERE exhibition_id = ? AND inventory_id = ?`,
            [exhibitionId, inventoryId]
        );
    },

    async getExhibitionDetails(id) {
        const exhibition = await baseService._getRecord('exhibitions', id);
        const artifacts = await db.query(`
            SELECT i.*, ea.display_notes, a.accession_number
            FROM exhibition_artifacts ea
            JOIN inventory i ON ea.inventory_id = i.id
            JOIN accessions a ON i.accession_id = a.id
            WHERE ea.exhibition_id = ?
        `, [id]);
        
        return { ...exhibition, artifacts };
    },

    async listExhibitions(query = {}) {
        return await baseService._listRecords('exhibitions', query);
    },

    /**
     * Get the exhibition history for a specific artifact
     */
    async getArtifactHistory(inventoryId) {
        return await db.query(`
            SELECT e.*, ea.display_notes
            FROM exhibition_artifacts ea
            JOIN exhibitions e ON ea.exhibition_id = e.id
            WHERE ea.inventory_id = ?
            ORDER BY e.start_date DESC
        `, [inventoryId]);
    }
};
