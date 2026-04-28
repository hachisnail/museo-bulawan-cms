// api/src/services/formService.js
import { pbService } from './pocketbaseService.js';
import { logger } from '../utils/logger.js';

export const formService = {
    async getFormDefinition(slug) {
        try {
            return await pbService.pb.collection('form_definitions').getFirstListItem(`slug="${slug}"`);
        } catch (error) {
            logger.error(`Form definition not found: ${slug}`);
            throw new Error('FORM_NOT_FOUND');
        }
    },

    async submitForm(slug, payload, files = null) {
        const definition = await this.getFormDefinition(slug);
        
        // Bonus: Validate payload against definition.schema here (e.g., using Ajv or Joi)
        
        const submission = {
            form_id: definition.id,
            data: payload,
            status: 'pending'
        };

        // If the form includes files, use your existing internal upload logic
        if (files) {
            return await pbService.uploadInternal('form_submissions', files, submission);
        }

        return await pbService.pb.collection('form_submissions').create(submission);
    }
};