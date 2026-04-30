import { db } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { definitionService } from './definitionService.js';
import { baseService } from '../acquisition/baseService.js';

export const queryService = {
    async listSubmissions(slug, query = {}) {
        try {
            const definition = await definitionService.getFormDefinition(slug);
            const page = query.page || 1;
            const perPage = query.perPage || 50;
            const offset = (page - 1) * perPage;
            
            let sql = `SELECT * FROM form_submissions WHERE form_id = ?`;
            const params = [definition.id];
            
            if (query.status) {
                sql += ` AND status = ?`;
                params.push(query.status);
            }
            if (query.search) {
                sql += ` AND submitted_by LIKE ?`;
                params.push(`%${query.search}%`);
            }
            
            sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(perPage, offset);
            
            const rows = await db.query(sql, params);
            
            if (query.expand && rows.length > 0) {
                await baseService._expandRecords(rows, query.expand);
            }

            return { page, perPage, items: rows };
        } catch (error) {
            logger.error(`Failed to list submissions for ${slug}: ${error.message}`);
            throw error;
        }
    },

    async listAllSubmissions(query = {}) {
        try {
            const page = query.page || 1;
            const perPage = query.perPage || 50;
            const offset = (page - 1) * perPage;
            
            let sql = `
                SELECT s.*, f.slug as form_slug, f.title as form_title 
                FROM form_submissions s 
                JOIN form_definitions f ON s.form_id = f.id WHERE 1=1
            `;
            const params = [];
            
            if (query.status) {
                sql += ` AND s.status = ?`;
                params.push(query.status);
            }
            if (query.search) {
                sql += ` AND s.submitted_by LIKE ?`;
                params.push(`%${query.search}%`);
            }
            
            sql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
            params.push(perPage, offset);
            
            const rows = await db.query(sql, params);
            
            if (query.expand && rows.length > 0) {
                await baseService._expandRecords(rows, query.expand);
            }

            return { page, perPage, items: rows };
        } catch (error) {
            logger.error(`Failed to list all submissions: ${error.message}`);
            throw error;
        }
    },

    async getSubmission(submissionId) {
        try {
            const rows = await db.query(`
                SELECT s.*, f.slug as form_slug, f.title as form_title 
                FROM form_submissions s 
                JOIN form_definitions f ON s.form_id = f.id 
                WHERE s.id = ?
            `, [submissionId]);
            
            if (!rows || rows.length === 0) throw new Error('SUBMISSION_NOT_FOUND');
            
            const submission = rows[0];
            // We can still expand if requested, e.g. for form_id
            // Note: form_slug/form_title are already joined, but frontend might want full form_id object in expand
            return submission;
        } catch (error) {
            logger.error(`Submission not found: ${submissionId}`);
            throw new Error('SUBMISSION_NOT_FOUND');
        }
    },

    async getSubmissionItems(submissionId, query = {}) {
        try {
            const page = query.page || 1;
            const perPage = query.perPage || 50;
            const offset = (page - 1) * perPage;
            const rows = await db.query(`
                SELECT * FROM donation_items 
                WHERE submission_id = ? 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?`, 
                [submissionId, perPage, offset]);
            return rows;
        } catch (error) {
            logger.error(`Failed to fetch submission items for ${submissionId}: ${error.message}`);
            throw error;
        }
    }
};