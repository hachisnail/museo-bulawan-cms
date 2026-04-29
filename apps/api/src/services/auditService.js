import crypto from "crypto";
import { pbService } from './pocketbaseService.js';
import { logger } from "../utils/logger.js";

const genId = () => crypto.randomBytes(8).toString('hex').substring(0, 15);

export const auditService = {
    async log({ userId, anonymousFingerprint, action, resource, details = {}, ipAddress = null, collection, recordId, before, after }) {
        try {
            // Map the external MySQL userId to the internal PocketBase app_user ID
            let performedByPbId = null;
            if (userId) {
                const user = await pbService.pb.collection('app_users').getFirstListItem(`external_id="${userId}"`).catch(() => null);
                if (user) {
                    performedByPbId = user.id;
                }
            }

            await pbService.pb.collection('audit_logs').create({
                id: genId(),
                collection: collection || resource || 'system',
                record_id: recordId || 'N/A',
                action: action.toLowerCase(),
                performed_by: performedByPbId,
                anonymous_fingerprint: anonymousFingerprint || null,
                before: before || null,
                after: after || details || null
            });
        } catch (error) {
            logger.error("Failed to write to audit log in PocketBase", { error: error.message });
        }
    },

    async fetchAll(query = {}) {
        const page = query.page || 1;
        const perPage = query.perPage || 50;
        return await pbService.pb.collection('audit_logs').getList(page, perPage, { 
            sort: query.sort || '-created',
            expand: 'performed_by'
        });
    },

    /**
     * Export audit logs in JSON or CSV format
     */
    async exportAuditLogs(format = 'json', dateFrom, dateTo) {
        let filterParts = [];
        if (dateFrom) filterParts.push(`created>="${dateFrom}"`);
        if (dateTo) filterParts.push(`created<="${dateTo}"`);

        const records = await pbService.pb.collection('audit_logs').getFullList({
            filter: filterParts.length > 0 ? filterParts.join(' && ') : '',
            sort: '-created',
            expand: 'performed_by'
        });

        if (format === 'json') {
            return JSON.stringify(records, null, 2);
        }

        if (format === 'csv') {
            const headers = ['ID', 'Date', 'Collection', 'Record ID', 'Action', 'Performed By', 'Fingerprint'];
            const rows = records.map(r => [
                r.id,
                r.created,
                r.collection,
                r.record_id,
                r.action,
                r.expand?.performed_by?.email || r.expand?.performed_by?.name || 'System/Anonymous',
                r.anonymous_fingerprint || ''
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