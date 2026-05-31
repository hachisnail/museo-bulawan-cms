import { db } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { ulid } from 'ulidx';

function parseJsonFields(def) {
    if (!def) return def;
    if (typeof def.schema_data === 'string') def.schema_data = JSON.parse(def.schema_data);
    if (typeof def.settings === 'string') def.settings = JSON.parse(def.settings);
    def.schema = def.schema_data;
    return def;
}

export const definitionService = {
    async getFormDefinition(slug) {
        try {
            const rows = await db.query('SELECT * FROM form_definitions WHERE slug = ?', [slug]);
            if (!rows || rows.length === 0) {
                throw new Error('FORM_NOT_FOUND');
            }
            return parseJsonFields(rows[0]);
        } catch (error) {
            logger.error(`Form definition not found: ${slug}`);
            throw new Error('FORM_NOT_FOUND');
        }
    },

    async listDefinitions() {
        try {
            const rows = await db.query('SELECT * FROM form_definitions ORDER BY created_at DESC');
            return rows.map(row => parseJsonFields(row));
        } catch (error) {
            logger.error(`Failed to list form definitions: ${error.message}`);
            throw error;
        }
    },

    async createDefinition(data) {
        try {
            const id = ulid();
            const record = {
                id,
                slug: data.slug,
                title: data.title,
                type: data.type || 'custom',
                schema_data: data.schema_data || {},
                settings: data.settings || {},
                otp: data.otp === true || data.otp === 'true'
            };
            const inserted = await db.insertRecord('form_definitions', record);
            return parseJsonFields(inserted);
        } catch (error) {
            logger.error(`Failed to create form definition: ${error.message}`);
            throw error;
        }
    },

    async updateDefinition(id, data) {
        try {
            const updateData = {};
            if (data.slug !== undefined) updateData.slug = data.slug;
            if (data.title !== undefined) updateData.title = data.title;
            if (data.type !== undefined) updateData.type = data.type;
            if (data.schema_data !== undefined) updateData.schema_data = data.schema_data;
            if (data.settings !== undefined) updateData.settings = data.settings;
            if (data.otp !== undefined) updateData.otp = data.otp === true || data.otp === 'true';

            const updated = await db.updateRecord('form_definitions', id, updateData);
            return parseJsonFields(updated);
        } catch (error) {
            logger.error(`Failed to update form definition ${id}: ${error.message}`);
            throw error;
        }
    },

    async deleteDefinition(id) {
        try {
            await db.executeAndBroadcast('DELETE FROM form_definitions WHERE id = ?', [id], 'delete', 'form_definitions', id);
            return { id };
        } catch (error) {
            logger.error(`Failed to delete form definition ${id}: ${error.message}`);
            throw error;
        }
    }
};