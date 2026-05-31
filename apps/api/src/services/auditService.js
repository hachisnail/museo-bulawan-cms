import { ulid } from 'ulidx';
import { db } from '../config/db.js';
import { logger } from "../utils/logger.js";

export const auditService = {
    async log({ userId, anonymousFingerprint, action, resource, details = {}, ipAddress = null, collection, recordId, before, after }, connection = null) {
        try {
            // Write directly to MariaDB instead of PocketBase
            await db.query(`
                INSERT INTO audit_logs (id, user_id, action, resource, details, ip_address, before_state, after_state)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                ulid(),
                userId || null,
                action.toUpperCase(),
                collection || resource || 'system',
                JSON.stringify(details),
                ipAddress || anonymousFingerprint || null,
                before ? JSON.stringify(before) : null,
                after ? JSON.stringify(after) : null
            ], connection);
        } catch (error) {
            logger.error("Failed to write to audit log in MariaDB", { error: error.message });
        }
    },

    async fetchAll(query = {}) {
        const page = parseInt(query.page) || 1;
        const perPage = parseInt(query.perPage) || parseInt(query.limit) || 20;
        const offset = (page - 1) * perPage;
        const search = query.search || '';
        const action = query.action || '';
        const userId = query.userId || '';
        
        let sql = `
            SELECT a.*, u.email as user_email, u.fname, u.lname 
            FROM audit_logs a 
            LEFT JOIN users u ON a.user_id = u.id 
            WHERE 1=1
        `;
        let countSql = `
            SELECT COUNT(*) as total 
            FROM audit_logs a 
            LEFT JOIN users u ON a.user_id = u.id 
            WHERE 1=1
        `;
        const params = [];
        
        if (userId) {
            sql += ` AND a.user_id = ?`;
            countSql += ` AND a.user_id = ?`;
            params.push(userId);
        }
        
        if (action && action.toLowerCase() !== 'all') {
            if (action.toLowerCase() === 'security') {
                sql += ` AND a.action IN ('LOGIN', 'LOGOUT', 'FORCE_LOGOUT', 'DEACTIVATE', 'CHANGE_PASSWORD', 'INVITE', 'ONBOARD', 'SETUP')`;
                countSql += ` AND a.action IN ('LOGIN', 'LOGOUT', 'FORCE_LOGOUT', 'DEACTIVATE', 'CHANGE_PASSWORD', 'INVITE', 'ONBOARD', 'SETUP')`;
            } else {
                sql += ` AND a.action = ?`;
                countSql += ` AND a.action = ?`;
                params.push(action.toUpperCase());
            }
        }
        
        if (search) {
            sql += ` AND (a.resource LIKE ? OR a.action LIKE ? OR u.email LIKE ? OR u.fname LIKE ? OR u.lname LIKE ? OR a.details LIKE ?)`;
            countSql += ` AND (a.resource LIKE ? OR a.action LIKE ? OR u.email LIKE ? OR u.fname LIKE ? OR u.lname LIKE ? OR a.details LIKE ?)`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
        }
        
        const countParams = [...params];
        
        sql += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
        params.push(perPage, offset);
        
        const countResult = await db.query(countSql, countParams);
        const total = Number((countResult && countResult[0] && (countResult[0].total ?? countResult[0]['COUNT(*)'])) || 0);
        const rows = await db.query(sql, params);
        
        const totalPages = Math.ceil(total / perPage);
        
        return { page, perPage, totalItems: total, totalPages, items: rows };
    },

    async exportAuditLogs(format = 'json', dateFrom, dateTo) {
        let sql = `
            SELECT a.*, u.email as user_email, u.fname, u.lname 
            FROM audit_logs a 
            LEFT JOIN users u ON a.user_id = u.id 
            WHERE 1=1
        `;
        const params = [];
        
        if (dateFrom) {
            sql += ` AND a.created_at >= ?`;
            params.push(dateFrom);
        }
        if (dateTo) {
            sql += ` AND a.created_at <= ?`;
            params.push(dateTo);
        }
        
        sql += ` ORDER BY a.created_at DESC`;
        const records = await db.query(sql, params);

        if (format === 'json') {
            return JSON.stringify(records, null, 2);
        }

        if (format === 'csv') {
            const headers = ['ID', 'Date', 'Resource', 'Action', 'Performed By', 'IP/Fingerprint'];
            const rows = records.map(r => [
                r.id,
                r.created_at,
                r.resource,
                r.action,
                r.user_email || 'System/Anonymous',
                r.ip_address || ''
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            return csvContent;
        }

        throw new Error(`Unsupported export format: ${format}`);
    }
};