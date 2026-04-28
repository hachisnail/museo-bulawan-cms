import crypto from 'crypto';
import { db } from '../config/db.js';
import { sseManager } from '../utils/sseFactory.js';
import { logger } from '../utils/logger.js';

class NotificationService {
    
    async _saveAndBroadcast(targetType, targetId, channel, title, message, type = 'info', metadata = {}) {
        const id = crypto.randomUUID();
        const actionUrl = metadata.actionUrl || null;

        const sql = `
            INSERT INTO notifications (id, title, message, type, target_type, target_id, action_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        try {
            // 1. Save to MariaDB
            await db.query(sql, [id, title, message, type, targetType, targetId, actionUrl]);

            // 2. Prepare payload for the frontend
            const payload = {
                id,
                title,
                message,
                type,
                target_type: targetType,
                target_id: targetId,
                action_url: actionUrl,
                created_at: new Date().toISOString(),
                is_read: false // Freshly created, so it's unread
            };

            // 3. Broadcast via SSE
            sseManager.broadcast(channel, 'notification', payload);
            logger.info(`[Notification DB] Sent to ${channel}: ${title}`);
            
            return payload;

        } catch (error) {
            logger.error(`[NotificationService] Database insert failed:`, error);
            throw error; 
        }
    }

    async sendGlobal(title, message, type = 'info', metadata = {}) {
        return await this._saveAndBroadcast('global', 'all', 'global', title, message, type, metadata);
    }

    async sendToRole(role, title, message, type = 'info', metadata = {}) {
        return await this._saveAndBroadcast('role', role, `role_${role}`, title, message, type, metadata);
    }

    async sendToUser(userId, title, message, type = 'info', metadata = {}) {
        return await this._saveAndBroadcast('user', userId, `user_${userId}`, title, message, type, metadata);
    }
}

export const notificationService = new NotificationService();