import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
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

    tableColumnsCache: {},

    async _getTableColumns(table, connection = null) {
        const cacheEntry = this.tableColumnsCache[table];
        const cacheTTL = 5 * 60 * 1000; // 5-minute cache TTL
        if (cacheEntry && cacheEntry.columns && cacheEntry.columns.size > 0 && (Date.now() - cacheEntry.timestamp < cacheTTL)) {
            return cacheEntry.columns;
        }
        const rows = await db.query(
            'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = COALESCE(DATABASE(), ?) AND TABLE_NAME = ?',
            [env.db.name, table],
            connection
        );
        const columns = new Set(rows.map(r => r.COLUMN_NAME || r.column_name));
        if (columns.size > 0) {
            this.tableColumnsCache[table] = {
                columns,
                timestamp: Date.now()
            };
        } else {
            logger.warn(`[baseService] No columns found for table '${table}'. Columns cache NOT updated.`);
        }
        return columns;
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

        const sql = `SELECT * FROM \`${table}\` ${filterSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
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

        const columns = await this._getTableColumns(table, connection);
        const recordId = data.id || this._genId();
        
        const recordData = {
            id: recordId,
            ...data
        };

        if (columns.has('version')) {
            recordData.version = 1;
        }
        if (columns.has('created_by')) {
            recordData.created_by = userId;
        }
        if (columns.has('updated_by')) {
            recordData.updated_by = userId;
        }

        const filteredData = {};
        for (const [key, val] of Object.entries(recordData)) {
            if (columns.has(key)) {
                filteredData[key] = val;
            }
        }

        const record = await db.insertRecord(table, filteredData, connection);

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

        const columns = await this._getTableColumns(table, connection);
        const rows = await db.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id], connection);
        const existing = rows[0];
        
        if (!existing) {
            throw new Error(`Record not found in ${table} with id ${id}`);
        }

        const updateData = {
            ...data
        };

        if (columns.has('version')) {
            updateData.version = (existing.version || 0) + 1;
        }
        if (columns.has('updated_by')) {
            updateData.updated_by = userId;
        }

        const filteredData = {};
        for (const [key, val] of Object.entries(updateData)) {
            if (columns.has(key) && key !== 'id') {
                filteredData[key] = val;
            }
        }

        // H-5 FIX: Optimistic concurrency control.
        // If the table has a version column, include it in the WHERE clause so that
        // concurrent updates are detected. If another process updated the record
        // between our SELECT and UPDATE, affectedRows will be 0.
        let updated;
        if (columns.has('version') && existing.version !== undefined) {
            const processedData = {};
            for (const [k, v] of Object.entries(filteredData)) {
                if (k === 'id') continue;
                processedData[k] = (typeof v === 'object' && v !== null && !(v instanceof Date))
                    ? JSON.stringify(v, (key, value) => typeof value === 'bigint' ? value.toString() : value)
                    : v;
            }
            const keys = Object.keys(processedData);
            const values = Object.values(processedData);
            const assignments = keys.map(k => `${k} = ?`).join(', ');
            const sql = `UPDATE \`${table}\` SET ${assignments} WHERE id = ? AND version = ?`;
            const result = await db.query(sql, [...values, id, existing.version], connection);

            if (result.affectedRows === 0) {
                // Re-fetch to get the current state for the caller
                const [currentRecord] = await db.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id], connection);
                const err = new Error(`VERSION_CONFLICT: Record '${id}' in '${table}' was modified by another process. Expected version ${existing.version}.`);
                err.status = 409;
                err.currentRecord = currentRecord || null;
                throw err;
            }
            updated = { id, ...filteredData };
        } else {
            updated = await db.updateRecord(table, id, filteredData, connection);
        }

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

    async getConditionReports(entityType, entityId, connection = null) {
        const rows = await db.query(
            'SELECT * FROM condition_reports WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC, id DESC',
            [entityType, entityId],
            connection
        );
        return {
            page: 1,
            perPage: rows.length,
            totalItems: rows.length,
            totalPages: 1,
            items: rows
        };
    }
};