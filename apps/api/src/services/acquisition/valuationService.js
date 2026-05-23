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

        // 1. Validate amount is a positive number
        if (data.amount === undefined || data.amount === null) {
            throw new Error('VALIDATION_FAILED: Valuation amount is required.');
        }
        if (typeof data.amount !== 'number' && typeof data.amount !== 'string') {
            throw new Error('VALIDATION_FAILED: Valuation amount must be a number or a string.');
        }
        const amount = Number(data.amount);
        if (isNaN(amount) || amount <= 0 || (typeof data.amount === 'string' && data.amount.trim() === '')) {
            throw new Error('VALIDATION_FAILED: Valuation amount must be a positive number.');
        }

        // 2. Validate currency is a 3-character ISO code
        let currency = 'PHP';
        if (data.currency !== undefined && data.currency !== null) {
            if (typeof data.currency !== 'string') {
                throw new Error('VALIDATION_FAILED: Currency must be a string.');
            }
            currency = data.currency.trim().toUpperCase();
        }
        if (!/^[A-Z]{3}$/.test(currency)) {
            throw new Error('VALIDATION_FAILED: Currency must be a valid 3-letter ISO code.');
        }

        // 3. Validate valuation date is a valid date and not in the future
        let dateStr;
        if (data.date !== undefined && data.date !== null) {
            if (typeof data.date !== 'string') {
                throw new Error('VALIDATION_FAILED: Valuation date must be a string.');
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
                throw new Error('VALIDATION_FAILED: Valuation date must match YYYY-MM-DD format.');
            }
            dateStr = data.date;
        } else {
            const tzOffset = new Date().getTimezoneOffset() * 60000;
            dateStr = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
        }

        const valDate = new Date(dateStr + 'T00:00:00Z');
        if (isNaN(valDate.getTime())) {
            throw new Error('VALIDATION_FAILED: Invalid valuation date format.');
        }

        // Ensure calendar date validity
        const [y, m, d] = dateStr.split('-').map(Number);
        if (valDate.getUTCFullYear() !== y || (valDate.getUTCMonth() + 1) !== m || valDate.getUTCDate() !== d) {
            throw new Error('VALIDATION_FAILED: Invalid calendar date.');
        }

        // Ensure not in the future (using local date comparison to avoid timezone mismatch)
        const tzOffset = new Date().getTimezoneOffset() * 60000;
        const todayStr = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
        if (dateStr > todayStr) {
            throw new Error('VALIDATION_FAILED: Valuation date cannot be in the future.');
        }

        // Optional inputs type check
        if (data.reason !== undefined && data.reason !== null && typeof data.reason !== 'string') {
            throw new Error('VALIDATION_FAILED: Reason must be a string.');
        }
        if (data.valuer !== undefined && data.valuer !== null && typeof data.valuer !== 'string') {
            throw new Error('VALIDATION_FAILED: Valuer must be a string.');
        }
        if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
            throw new Error('VALIDATION_FAILED: Notes must be a string.');
        }

        return await baseService._createRecord(staffId, 'valuations', {
            inventory_id: inventoryId,
            amount: amount,
            currency: currency,
            valuation_date: dateStr,
            valuation_reason: data.reason || 'Insurance', // Fallback to 'Insurance' if reason is empty
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
