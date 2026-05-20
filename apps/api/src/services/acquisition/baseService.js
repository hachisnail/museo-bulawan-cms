import { db } from '../../config/db.js';
import { auditService } from '../auditService.js';
import { logger } from '../../utils/logger.js';
import { assertTransition } from '../../utils/stateMachine.js';
import { ALLOWED_TABLES } from '../../utils/constants.js';
import { ulid } from 'ulidx';

export const baseService = {
    _genId() {
        return ulid();
    },

    /**
     * Validates a table name against the whitelist to prevent SQL injection
     * via table-name interpolation.
     */
    _assertTable(table) {
        if (!ALLOWED_TABLES.has(table)) {
            throw new Error(`INVALID_TABLE: '${table}' is not a valid collection.`);
        }
    },

    /**
     * Parses a PocketBase-style filter string into parameterized SQL.
     * 
     * Supported operators:
     *   field = "value"    → field = ?
     *   field != "value"   → field != ?
     *   field ~ "value"    → field LIKE ?  (wraps value in %)
     * 
     * Conjunctions: && → AND
     * 
     * This replaces the old approach of directly interpolating the filter
     * string into SQL, which was vulnerable to SQL injection.
     */
    _buildFilterClause(filterStr) {
        if (!filterStr) return { sql: '', params: [] };

        const conditions = [];
        const params = [];

        // Split by && (AND) conjunctions
        const parts = filterStr.split('&&').map(s => s.trim());

        for (const part of parts) {
            // Match: field != "value" or field != 'value'
            let match = part.match(/^(\w+)\s*!=\s*["']([^"']*)["']$/);
            if (match) {
                conditions.push(`\`${match[1]}\` != ?`);
                params.push(match[2]);
                continue;
            }

            // Match: field = "value" or field = 'value'
            match = part.match(/^(\w+)\s*=\s*["']([^"']*)["']$/);
            if (match) {
                conditions.push(`\`${match[1]}\` = ?`);
                params.push(match[2]);
                continue;
            }

            // Match: field ~ "value" (LIKE search)
            match = part.match(/^(\w+)\s*~\s*["']([^"']*)["']$/);
            if (match) {
                conditions.push(`\`${match[1]}\` LIKE ?`);
                params.push(`%${match[2]}%`);
                continue;
            }

            // If we can't parse a part, log a warning and skip it
            // This prevents unknown syntax from being injected
            logger.warn(`[baseService] Unparseable filter segment ignored: "${part}"`);
        }

        if (conditions.length === 0) return { sql: '', params: [] };
        return { sql: 'WHERE ' + conditions.join(' AND '), params };
    },

    async _listRecords(table, query = {}, connection = null) {
        this._assertTable(table);

        const page = query.page || 1;
        const perPage = query.perPage || 50;
        const offset = (page - 1) * perPage;
        
        // Build a parameterized WHERE clause from the filter string
        const { sql: filterSql, params: filterParams } = this._buildFilterClause(query.filter);

        const sql = `SELECT * FROM \`${table}\` ${filterSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        const queryParams = [...filterParams, perPage, offset];

        const rows = await db.query(sql, queryParams, connection);
        
        // Count total for pagination (reuse the same parameterized filter)
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM \`${table}\` ${filterSql}`,
            filterParams,
            connection
        );
        const totalItems = countResult[0]?.total || 0;

        // Implementation of expand (relational joins)
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
        this._assertTable(table);

        const rows = await db.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id], connection);
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
                const results = await db.query(`SELECT * FROM \`${targetTable}\` WHERE id = ?`, [foreignKey], connection);
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
        this._assertTable(table);

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
        this._assertTable(table);

        const rows = await db.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id], connection);
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
        this._assertTable(table);

        const rows = await db.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id], connection);
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
        // Use parameterized filter instead of string interpolation
        return await this._listRecords('condition_reports', {
            filter: `entity_type="${entityType}" && entity_id="${entityId}"`
        });
    }
};