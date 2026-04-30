import { db } from '../../config/db.js';
import { logger } from '../../utils/logger.js';

export const definitionService = {
    async getFormDefinition(slug) {
        try {
            const rows = await db.query('SELECT * FROM form_definitions WHERE slug = ?', [slug]);
            if (!rows || rows.length === 0) {
                throw new Error('FORM_NOT_FOUND');
            }
            // Parse JSON columns back into objects
            const def = rows[0];
            if (typeof def.schema_data === 'string') def.schema_data = JSON.parse(def.schema_data);
            if (typeof def.settings === 'string') def.settings = JSON.parse(def.settings);
            
            // Map schema_data to schema for compatibility with AJV
            def.schema = def.schema_data;
            
            return def;
        } catch (error) {
            logger.error(`Form definition not found: ${slug}`);
            throw new Error('FORM_NOT_FOUND');
        }
    }
};