import { db } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

import { auditService } from "../auditService.js";

/**
 * IdentityService
 * 
 * Handles user fetching, listing, and basic profile updates in MariaDB.
 */
export const identityService = {
    async getUserById(id) {
        try {
            const [user] = await db.query(
                'SELECT id, username, role, fname, lname, email, status, current_session_id FROM users WHERE id = ?',
                [id]
            );

            logger.info('Fetched user by ID', {
                action: 'READ',
                resource: 'User',
                userId: id,
                found: !!user
            });

            return user || null;
        } catch (error) {
            logger.error('Failed to fetch user by ID', {
                action: 'READ',
                resource: 'User',
                userId: id,
                error: error.message
            });
            throw error;
        }
    },

    async getUserByUsername(usernameOrEmail) {
        try {
            const [user] = await db.query(
                'SELECT * FROM users WHERE username = ? OR email = ?',
                [usernameOrEmail, usernameOrEmail]
            );

            logger.info('Fetched user by username', {
                action: 'READ',
                resource: 'User',
                username: usernameOrEmail,
                found: !!user
            });

            return user || null;
        } catch (error) {
            logger.error('Failed to fetch user by username', {
                action: 'READ',
                resource: 'User',
                username: usernameOrEmail,
                error: error.message
            });
            throw error;
        }
    },

    async listUsers() {
        try {
            const rows = await db.query(
                'SELECT id, username, email, role, fname, lname, status, created_at FROM users ORDER BY created_at DESC'
            );
            return Array.isArray(rows) ? rows : [];
        } catch (error) {
            logger.error('Failed to list users', {
                action: 'READ',
                resource: 'User',
                error: error.message
            });
            throw error;
        }
    },

    async updateProfile(userId, { fname, lname }) {
        try {
            await db.query(
                'UPDATE users SET fname = ?, lname = ? WHERE id = ?',
                [fname, lname, userId]
            );



            await auditService.log({
                userId,
                action: 'UPDATE',
                resource: 'User',
                details: { message: 'Profile updated', fields: { fname, lname } }
            });

            logger.info('Profile updated', { action: 'UPDATE', resource: 'User', userId });
            return user;
        } catch (error) {
            logger.error('Failed to update profile', { action: 'UPDATE', resource: 'User', userId, error: error.message });
            throw error;
        }
    }
};
