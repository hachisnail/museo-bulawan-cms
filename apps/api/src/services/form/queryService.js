import { pbService } from '../pocketbaseService.js';
import { logger } from '../../utils/logger.js';
import { definitionService } from './definitionService.js';

/**
 * QueryService
 * 
 * Handles staff-facing queries for form submissions and linked donation items.
 */
export const queryService = {
    async listSubmissions(slug, query = {}) {
        try {
            const definition = await definitionService.getFormDefinition(slug);
            const page = query.page || 1;
            const perPage = query.perPage || 50;

            // Build filter chain
            let filterParts = [`form_id="${definition.id}"`];

            if (query.status) {
                filterParts.push(`status="${query.status}"`);
            }

            if (query.dateFrom) {
                filterParts.push(`created>="${query.dateFrom}"`);
            }
            if (query.dateTo) {
                filterParts.push(`created<="${query.dateTo}"`);
            }

            if (query.search) {
                // Search in submitted_by (email) field
                filterParts.push(`submitted_by~"${query.search}"`);
            }

            const options = {
                filter: filterParts.join(' && '),
                sort: query.sort || '-created',
            };

            return await pbService.pb.collection('form_submissions').getList(page, perPage, options);
        } catch (error) {
            logger.error(`Failed to list submissions for ${slug}: ${error.message}`);
            throw error;
        }
    },

    async listAllSubmissions(query = {}) {
        try {
            const page = query.page || 1;
            const perPage = query.perPage || 50;

            let filterParts = [];

            if (query.status) {
                filterParts.push(`status="${query.status}"`);
            }
            if (query.dateFrom) {
                filterParts.push(`created>="${query.dateFrom}"`);
            }
            if (query.dateTo) {
                filterParts.push(`created<="${query.dateTo}"`);
            }
            if (query.search) {
                filterParts.push(`submitted_by~"${query.search}"`);
            }

            const options = {
                filter: filterParts.length > 0 ? filterParts.join(' && ') : '',
                sort: query.sort || '-created',
                expand: 'form_id'
            };

            return await pbService.pb.collection('form_submissions').getList(page, perPage, options);
        } catch (error) {
            logger.error(`Failed to list all submissions: ${error.message}`);
            throw error;
        }
    },

    async getSubmission(submissionId) {
        try {
            return await pbService.pb.collection('form_submissions').getOne(submissionId, {
                expand: 'form_id'
            });
        } catch (error) {
            logger.error(`Submission not found: ${submissionId}`);
            throw new Error('SUBMISSION_NOT_FOUND');
        }
    },

    async getSubmissionItems(submissionId) {
        try {
            return await pbService.pb.collection('donation_items').getFullList({
                filter: `submission_id="${submissionId}"`,
                sort: '-created'
            });
        } catch (error) {
            logger.error(`Failed to fetch submission items for ${submissionId}: ${error.message}`);
            throw error;
        }
    }
};
