import { baseService } from './baseService.js';
import { db } from '../../config/db.js';
import { logger } from '../../utils/logger.js';

/**
 * LocationService
 * 
 * Manages physical locations within the museum.
 */
export const locationService = {
    async listLocations() {
        try {
            const results = await db.query(
                `SELECT id, name, type, description FROM locations ORDER BY name ASC`
            );
            return results;
        } catch (error) {
            logger.error(`Error listing locations: ${error.message}`);
            throw error;
        }
    },

    async createLocation(staffId, data) {
        const id = `LOC-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        return await baseService._createRecord(staffId, 'locations', {
            id,
            name: data.name,
            type: data.type || 'storage',
            description: data.description || ''
        });
    }
};
