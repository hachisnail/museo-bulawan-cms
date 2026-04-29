import { db } from '../config/db.js';

const TARGET_CONDITION = `
    (target_type = 'user' AND target_id = ?)
    OR (target_type = 'role' AND target_id = ?)
    OR (target_type = 'global' AND target_id = 'all')
`;

export const getUserNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // This query fetches user-specific, role-specific, and global notifications.
        // It uses a LEFT JOIN to figure out if THIS specific user has read it.
        const sql = `
            SELECT 
                n.id, n.title, n.message, n.type, n.action_url, n.created_at,
                CASE WHEN unr.notification_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_read
            FROM notifications n
            LEFT JOIN user_notification_reads unr 
                ON n.id = unr.notification_id AND unr.user_id = ?
            WHERE ${TARGET_CONDITION}
            ORDER BY n.created_at DESC
            LIMIT 50
        `;
        
        const notifications = await db.query(sql, [userId, userId, userRole]);
        
        // Convert integer booleans from MariaDB to actual booleans if necessary
        const formatted = notifications.map(n => ({
            ...n,
            is_read: n.is_read === 1 || n.is_read === true
        }));

        res.json({ notifications: formatted });
    } catch (error) {
        next(error);
    }
};

export const markAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id: notificationId } = req.params;

        // Simple direct insert — mark this specific notification as read for this user
        await db.query(
            'INSERT IGNORE INTO user_notification_reads (user_id, notification_id) VALUES (?, ?)',
            [userId, notificationId]
        );
        
        res.json({ message: "Notification marked as read." });
    } catch (error) {
        next(error);
    }
};

export const markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Insert read receipts for all unread notifications belonging to this user
        const sql = `
            INSERT IGNORE INTO user_notification_reads (user_id, notification_id)
            SELECT ?, id FROM notifications
            WHERE (target_type = 'user' AND target_id = ?)
               OR (target_type = 'role' AND target_id = ?)
               OR (target_type = 'global' AND target_id = 'all')
        `;

        await db.query(sql, [userId, userId, userRole]);

        res.json({ message: "All notifications marked as read." });
    } catch (error) {
        next(error);
    }
};