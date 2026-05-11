import { baseService } from './baseService.js';
import { db } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { globalMutex } from '../../utils/mutex.js';

/**
 * ConstituentService
 * 
 * Manages the authority list for People and Organizations.
 * Used for Donors, Makers, Lenders, and Copyright Holders.
 */
export const constituentService = {
    async createConstituent(staffId, data) {
        return await baseService._createRecord(staffId, 'constituents', {
            name: data.name,
            type: data.type || 'individual',
            contact_info: data.contactInfo || {},
            biography: data.biography || '',
            external_id: data.externalId || null
        });
    },

    async updateConstituent(staffId, id, data) {
        return await baseService._updateRecord(staffId, 'constituents', id, data);
    },

    async getConstituent(id) {
        return await baseService._getRecord('constituents', id);
    },

    async listConstituents(query = {}) {
        return await baseService._listRecords('constituents', query);
    },

    /**
     * Search for constituents by name (for auto-suggest)
     */
    async search(nameQuery) {
        try {
            const results = await db.query(
                `SELECT id, name, type FROM constituents WHERE name LIKE ? LIMIT 10`,
                [`%${nameQuery}%`]
            );
            return results;
        } catch (error) {
            logger.error(`Error searching constituents: ${error.message}`);
            throw error;
        }
    },

    /**
     * Find all artifacts (accessions) linked to this constituent
     */
    async getLinkedArtifacts(constituentId) {
        try {
            const results = await db.query(
                `SELECT id, accession_number, object_type, classification, status 
                 FROM accessions 
                 WHERE maker_id = ? OR copyright_holder_id = ? 
                 ORDER BY created_at DESC`,
                [constituentId, constituentId]
            );
            return results;
        } catch (error) {
            logger.error(`Error fetching linked artifacts for constituent ${constituentId}: ${error.message}`);
            throw error;
        }
    }
};
