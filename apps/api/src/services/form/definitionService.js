import { pbService } from '../pocketbaseService.js';
import { logger } from '../../utils/logger.js';

/**
 * DefinitionService
 * 
 * Handles fetching and caching of form definitions from PocketBase.
 */
export const definitionService = {
    async getFormDefinition(slug) {
        try {
            return await pbService.pb.collection('form_definitions').getFirstListItem(`slug="${slug}"`);
        } catch (error) {
            logger.error(`Form definition not found: ${slug}`);
            throw new Error('FORM_NOT_FOUND');
        }
    }
};
