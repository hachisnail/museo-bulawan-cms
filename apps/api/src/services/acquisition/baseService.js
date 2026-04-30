import crypto from 'crypto';
import { db } from '../../config/db.js';
import { auditService } from '../auditService.js';
import { logger } from '../../utils/logger.js';
import { assertTransition } from '../../utils/stateMachine.js';
import { ulid } from 'ulidx';

export const baseService = {
    _genId() {
        return ulid();
    },

    async _listRecords(table, query = {}, connection = null) {
        const page = query.page || 1;
        const perPage = query.perPage || 50;
        const offset = (page - 1) * perPage;
        
        let filterSql = '';
        let queryParams = [];

        // Simple translation for direct ID matches or basic text (needs enhancement for complex PB filters)
        if (query.filter) {
            filterSql = 'WHERE ' + query.filter.replace(/"/g, "'").replace(/&&/g, 'AND');
        }

        const sql = `SELECT * FROM ${table} ${filterSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(perPage, offset);

        const rows = await db.query(sql, queryParams, connection);
        
        // Count total for pagination
        const countResult = await db.query(`SELECT COUNT(*) as total FROM ${table} ${filterSql}`, [], connection);
        const totalItems = countResult[0]?.total || 0;

        // Implementation of PB-style expand
        if (query.expand && rows.length > 0) {
            await this._expandRecords(rows, query.expand);
        }

        return {
            page,
            perPage,
            totalItems,
            totalPages: Math.ceil(Number(totalItems) / perPage),
            items: rows
        };
    },

    async _getRecord(table, id, query = {}, connection = null) {
        const rows = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id], connection);
        if (!rows || rows.length === 0) {
            throw new Error(`Record not found in ${table} with id ${id}`);
        }
        
        const record = rows[0];
        if (query.expand) {
            await this._expandRecords([record], query.expand);
        }
        return record;
    },

    async _expandRecords(records, expandStr, connection = null) {
        const paths = expandStr.split(',').map(s => s.trim());
        
        for (const path of paths) {
            const parts = path.split('.');
            for (let i = 0; i < records.length; i++) {
                await this._expandRecursive(records[i], parts, connection);
            }
        }
    },

    async _expandRecursive(record, pathParts, connection = null) {
        if (!pathParts.length) return;
        const currentField = pathParts[0];
        const remaining = pathParts.slice(1);

        const relationMap = {
            'intake_id': 'intakes',
            'accession_id': 'accessions',
            'donation_item_id': 'donation_items',
            'form_id': 'form_definitions',
            'inventory_item_id': 'inventory',
            'donor_account_id': 'users',
            'copyright_holder_id': 'constituents',
            'maker_id': 'constituents'
        };

        if (relationMap[currentField]) {
            const targetTable = relationMap[currentField];
            const foreignKey = record[currentField];

            if (foreignKey) {
                const results = await db.query(`SELECT * FROM ${targetTable} WHERE id = ?`, [foreignKey], connection);
                if (results && results.length > 0) {
                    const expanded = results[0];
                    record.expand = record.expand || {};
                    record.expand[currentField] = expanded;

                    if (remaining.length > 0) {
                        await this._expandRecursive(expanded, remaining, connection);
                    }
                }
            }
        }
    },

    async _createRecord(userId, table, data, connection = null) {
        const recordId = this._genId();
        
        const recordData = {
            id: recordId,
            ...data,
            version: 1,
            created_by: userId,
            updated_by: userId
        };

        const record = await db.insertRecord(table, recordData, connection);

        await auditService.log({
            collection: table,
            recordId: record.id,
            action: 'create',
            userId: userId,
            after: record
        }, connection);
        
        return record;
    },
    async _updateRecord(userId, table, id, data, connection = null) {
        const rows = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id], connection);
        const existing = rows[0];
        
        if (!existing) {
            throw new Error(`Record not found in ${table} with id ${id}`);
        }

        const updateData = {
            ...data,
            version: (existing.version || 0) + 1,
            updated_by: userId
        };

        const updated = await db.updateRecord(table, id, updateData, connection);

        await auditService.log({
            collection: table,
            recordId: id,
            action: 'update',
            userId: userId,
            before: existing,
            after: updated
        }, connection);
        
        return updated;
    },

    async _transitionRecord(userId, entityType, table, id, targetStatus, extraData = {}, connection = null) {
        const rows = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id], connection);
        const existing = rows[0];
        
        if (!existing) {
            throw new Error(`Record not found in ${table} with id ${id}`);
        }

        assertTransition(entityType, existing.status, targetStatus);
        
        return await this._updateRecord(userId, table, id, { 
            ...extraData, 
            status: targetStatus 
        }, connection);
    },

    async createConditionReport(userId, entityType, entityId, condition, notes = '', submissionId = null, reporterName = '', extra = {}, connection = null) {
        return await this._createRecord(userId, 'condition_reports', {
            entity_type: entityType,
            entity_id: entityId,
            condition_status: condition,
            stability: extra.stability || null,
            hazards: extra.hazards || null,
            notes: notes,
            immediate_action_required: extra.immediate_action_required || false,
            submission_id: submissionId,
            reported_by: userId,
            reporter_name: reporterName
        }, connection);
    },

    async getConditionReports(entityType, entityId) {
        return await this._listRecords('condition_reports', {
            filter: `entity_type="${entityType}" && entity_id="${entityId}"`
        });
    }
};