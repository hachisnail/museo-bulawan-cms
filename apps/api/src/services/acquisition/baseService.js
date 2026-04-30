import crypto from 'crypto';
import { pbService } from '../pocketbaseService.js';
import { auditService } from '../auditService.js';
import { userService } from '../userService.js';
import { logger } from '../../utils/logger.js';
import { assertTransition } from '../../utils/stateMachine.js';

export const baseService = {
    _genId() {
        return crypto.randomBytes(8).toString('hex').substring(0, 15);
    },

    async _listRecords(collection, query = {}) {
        const page = query.page || 1;
        const perPage = query.perPage || 50;
        const options = {};
        if (query.filter) options.filter = query.filter;
        if (query.sort) options.sort = query.sort;
        if (query.expand) options.expand = query.expand;
        return await pbService.pb.collection(collection).getList(page, perPage, options);
    },

    async _getRecord(collection, id, query = {}) {
        const options = {};
        if (query.expand) options.expand = query.expand;
        return await pbService.pb.collection(collection).getOne(id, options);
    },

    async _createRecord(userId, collection, data) {
        let pbUserId = await pbService.getAppUserId(userId);
        
        if (!pbUserId) {
            const user = await userService.getUserById(userId);
            if (user) {
                await pbService.syncUser(user);
                pbUserId = await pbService.getAppUserId(userId);
            }
        }

        if (!pbUserId) {
            try {
                const adminUser = await pbService.pb.collection('app_users').getFirstListItem('role="admin"');
                pbUserId = adminUser.id;
            } catch (fallbackError) {
                throw new Error(`FAILED_PB_SYNC: User ${userId} could not be mapped to a PocketBase ID.`);
            }
        }

        const record = await pbService.pb.collection(collection).create({
            id: this._genId(),
            ...data,
            version: 1,
            created_by: pbUserId,
            updated_by: pbUserId
        });

        await auditService.log({
            collection,
            recordId: record.id,
            action: 'create',
            userId: userId,
            after: record
        });
        return record;
    },

    async _updateRecord(userId, collection, id, data) {
        const existing = await pbService.pb.collection(collection).getOne(id);
        let pbUserId = await pbService.getAppUserId(userId);
        
        if (!pbUserId) {
            const adminUser = await pbService.pb.collection('app_users').getFirstListItem('role="admin"').catch(() => null);
            pbUserId = adminUser?.id;
        }

        const updated = await pbService.pb.collection(collection).update(id, {
            ...data,
            version: (existing.version || 0) + 1,
            updated_by: pbUserId
        });

        await auditService.log({
            collection,
            recordId: id,
            action: 'update',
            userId: userId,
            before: existing,
            after: updated
        });
        return updated;
    },

    async _transitionRecord(userId, entityType, collection, id, targetStatus, extraData = {}) {
        const existing = await pbService.pb.collection(collection).getOne(id);
        assertTransition(entityType, existing.status, targetStatus);
        return await this._updateRecord(userId, collection, id, { 
            ...extraData, 
            status: targetStatus 
        });
    },

    async createConditionReport(userId, entityType, entityId, condition, notes = '', submissionId = null, reporterName = '') {
        let pbUserId = await pbService.getAppUserId(userId);
        if (!pbUserId) {
            const adminUser = await pbService.pb.collection('app_users').getFirstListItem('role="admin"').catch(() => null);
            pbUserId = adminUser?.id;
        }

        return await this._createRecord(userId, 'condition_reports', {
            entity_type: entityType,
            entity_id: entityId,
            condition: condition,
            notes: notes,
            submission_id: submissionId,
            reported_by: pbUserId,
            reporter_name: reporterName
        });
    },

    async getConditionReports(entityType, entityId) {
        return await this._listRecords('condition_reports', {
            filter: `entity_type="${entityType}" && entity_id="${entityId}"`,
            sort: '-created',
            expand: 'submission_id'
        });
    }
};
