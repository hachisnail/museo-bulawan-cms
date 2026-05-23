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
        if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
            throw new Error('VALIDATION_FAILED: Location name is required.');
        }

        const trimmedName = data.name.trim();

        // 1. Prevent duplicate location names (case-insensitive)
        const existing = await db.query(
            'SELECT id FROM locations WHERE LOWER(name) = LOWER(?)',
            [trimmedName]
        );
        if (existing && existing.length > 0) {
            throw new Error(`VALIDATION_FAILED: A location named "${trimmedName}" already exists.`);
        }

        // 2. Generate a collision-free ID
        let id;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            // Use 6 characters for better entropy (e.g. LOC-XXXXXX)
            const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
            id = `LOC-${randomPart}`;

            const check = await db.query('SELECT 1 FROM locations WHERE id = ?', [id]);
            if (!check || check.length === 0) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            throw new Error('GENERATE_ID_FAILED: Could not generate a unique location ID.');
        }

        return await baseService._createRecord(staffId, 'locations', {
            id,
            name: trimmedName,
            type: data.type || 'storage',
            description: data.description || ''
        });
    }
};

