import { baseService } from './baseService.js';
import { db } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { globalMutex } from '../../utils/mutex.js';

function toDateString(val) {
    if (!val) return null;
    if (val instanceof Date) {
        return val.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
        return val.split('T')[0];
    }
    return val;
}

function validateDateFormat(dateVal, fieldName) {
    if (dateVal === undefined || dateVal === null) return;
    if (typeof dateVal !== 'string') {
        throw new Error(`VALIDATION_FAILED: ${fieldName} must be a string.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        throw new Error(`VALIDATION_FAILED: ${fieldName} must match YYYY-MM-DD format.`);
    }
    const valDate = new Date(dateVal + 'T00:00:00Z');
    if (isNaN(valDate.getTime())) {
        throw new Error(`VALIDATION_FAILED: Invalid ${fieldName}.`);
    }
    // Ensure calendar validity (e.g. reject 2026-02-30)
    const [y, m, d] = dateVal.split('-').map(Number);
    if (valDate.getUTCFullYear() !== y || (valDate.getUTCMonth() + 1) !== m || valDate.getUTCDate() !== d) {
        throw new Error(`VALIDATION_FAILED: Invalid calendar date for ${fieldName}.`);
    }
}

/**
 * ExhibitionService
 * 
 * Tracks museum events and artifact participation.
 */
export const exhibitionService = {
    async createExhibition(staffId, data) {
        if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
            throw new Error('VALIDATION_FAILED: Title is required and must be a non-empty string.');
        }
        if (!data.venue || typeof data.venue !== 'string' || data.venue.trim() === '') {
            throw new Error('VALIDATION_FAILED: Venue is required and must be a non-empty string.');
        }
        if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
            throw new Error('VALIDATION_FAILED: Description must be a string.');
        }
        if (data.status !== undefined && data.status !== null && typeof data.status !== 'string') {
            throw new Error('VALIDATION_FAILED: Status must be a string.');
        }

        const startDate = data.startDate !== undefined ? data.startDate : data.start_date;
        const endDate = data.endDate !== undefined ? data.endDate : data.end_date;

        validateDateFormat(startDate, 'Start date');
        validateDateFormat(endDate, 'End date');

        if (startDate && endDate && startDate > endDate) {
            throw new Error('VALIDATION_FAILED: Start date cannot be after end date.');
        }

        return await baseService._createRecord(staffId, 'exhibitions', {
            title: data.title.trim(),
            venue: data.venue.trim(),
            start_date: startDate || null,
            end_date: endDate || null,
            curator_id: data.curatorId || data.curator_id || staffId,
            description: data.description || '',
            status: data.status || 'planning'
        });
    },

    async updateExhibition(staffId, id, data) {
        const existing = await baseService._getRecord('exhibitions', id);

        if (data.title !== undefined) {
            if (typeof data.title !== 'string' || data.title.trim() === '') {
                throw new Error('VALIDATION_FAILED: Title must be a non-empty string.');
            }
        }
        if (data.venue !== undefined) {
            if (typeof data.venue !== 'string' || data.venue.trim() === '') {
                throw new Error('VALIDATION_FAILED: Venue must be a non-empty string.');
            }
        }
        if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
            throw new Error('VALIDATION_FAILED: Description must be a string.');
        }
        if (data.status !== undefined && data.status !== null && typeof data.status !== 'string') {
            throw new Error('VALIDATION_FAILED: Status must be a string.');
        }

        const newStartDate = data.startDate !== undefined ? data.startDate : data.start_date;
        const newEndDate = data.endDate !== undefined ? data.endDate : data.end_date;

        if (newStartDate !== undefined) {
            validateDateFormat(newStartDate, 'Start date');
        }
        if (newEndDate !== undefined) {
            validateDateFormat(newEndDate, 'End date');
        }

        const finalStartDate = toDateString(newStartDate !== undefined ? newStartDate : existing.start_date);
        const finalEndDate = toDateString(newEndDate !== undefined ? newEndDate : existing.end_date);

        if (finalStartDate && finalEndDate && finalStartDate > finalEndDate) {
            throw new Error('VALIDATION_FAILED: Start date cannot be after end date.');
        }

        const updateData = { ...data };
        if (newStartDate !== undefined) {
            updateData.start_date = newStartDate;
            delete updateData.startDate;
        }
        if (newEndDate !== undefined) {
            updateData.end_date = newEndDate;
            delete updateData.endDate;
        }
        if (data.curatorId !== undefined) {
            updateData.curator_id = data.curatorId;
            delete updateData.curatorId;
        }

        return await baseService._updateRecord(staffId, 'exhibitions', id, updateData);
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
