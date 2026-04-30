import { baseService } from './baseService.js';
import { db } from '../../config/db.js';
import { logger } from '../../utils/logger.js';

/**
 * ValuationService
 * 
 * Manages financial appraisal and insurance values for artifacts.
 * ACCESS RESTRICTION: This service should only be used by Admin/Registrar roles.
 */
export const valuationService = {
    async addValuation(staffId, inventoryId, data) {
        // Ensure item exists
        await baseService._getRecord('inventory', inventoryId);

        return await baseService._createRecord(staffId, 'valuations', {
            inventory_id: inventoryId,
            amount: data.amount,
            currency: data.currency || 'PHP',
            valuation_date: data.date || new Date().toISOString().split('T')[0],
            valuation_reason: data.reason, // 'Insurance', 'Acquisition', 'Audit'
            valuer: data.valuer || 'Internal Curatorial Team',
            notes: data.notes || ''
        });
    },

    async getHistory(inventoryId) {
        return await baseService._listRecords('valuations', {
            filter: `inventory_id="${inventoryId}"`,
            sort: '-valuation_date'
        });
    },

    async getLatest(inventoryId) {
        const history = await this.getHistory(inventoryId);
        return history.items?.[0] || null;
    }
};
