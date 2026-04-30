import { db } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { pbService } from "../pocketbaseService.js";
import { auditService } from "../auditService.js";
import { sseManager } from "../../utils/sseFactory.js";

/**
 * ManagementService
 * 
 * Handles admin-level user management actions like role updates, deactivation, and session termination.
 */
export const managementService = {
    async updateUserById(adminId, targetId, { fname, lname, role, email }) {
        try {
            const [target] = await db.query('SELECT id, role FROM users WHERE id = ?', [targetId]);
            if (!target) throw new Error('USER_NOT_FOUND');

            // Prevent demoting yourself
            if (adminId === targetId && role && role !== target.role) {
                throw new Error('CANNOT_CHANGE_OWN_ROLE');
            }

            const fields = [];
            const values = [];
            if (fname !== undefined) { fields.push('fname = ?'); values.push(fname); }
            if (lname !== undefined) { fields.push('lname = ?'); values.push(lname); }
            if (role !== undefined)  { fields.push('role = ?');  values.push(role);  }
            if (email !== undefined) { fields.push('email = ?'); values.push(email); }

            if (fields.length === 0) throw new Error('NO_FIELDS_TO_UPDATE');

            values.push(targetId);
            await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

            // Sync role/name change to PocketBase
            const [updated] = await db.query('SELECT id, email, role, fname, lname FROM users WHERE id = ?', [targetId]);
            if (updated) {
                await pbService.syncUser({ id: updated.id, email: updated.email, role: updated.role, fname: updated.fname, lname: updated.lname });
            }

            await auditService.log({
                userId: adminId,
                action: 'UPDATE',
                resource: 'User',
                details: { message: `Admin updated user ${targetId}`, changes: { fname, lname, role, email } }
            });

            logger.info('User updated by admin', { action: 'UPDATE', resource: 'User', adminId, targetId });
            return updated;
        } catch (error) {
            logger.error('Failed to update user', { action: 'UPDATE', resource: 'User', targetId, error: error.message });
            throw error;
        }
    },

    async deactivateUser(adminId, targetId) {
        try {
            const [target] = await db.query('SELECT id, status FROM users WHERE id = ?', [targetId]);
            if (!target) throw new Error('USER_NOT_FOUND');
            if (adminId === targetId) throw new Error('CANNOT_DEACTIVATE_SELF');

            await db.query(
                "UPDATE users SET status = 'deactivated', current_session_id = NULL WHERE id = ?",
                [targetId]
            );

            // Force logout via SSE
            sseManager.broadcast(`user_${targetId}`, 'force_logout', {
                message: 'Your account has been deactivated by an administrator.'
            });

            await auditService.log({
                userId: adminId,
                action: 'DEACTIVATE',
                resource: 'User',
                details: { message: `Admin deactivated user ${targetId}` }
            });

            logger.info('User deactivated', { action: 'DEACTIVATE', resource: 'User', adminId, targetId });
            return true;
        } catch (error) {
            logger.error('Failed to deactivate user', { action: 'DEACTIVATE', resource: 'User', targetId, error: error.message });
            throw error;
        }
    },

    async forceLogoutUser(adminId, targetId) {
        try {
            if (adminId === targetId) throw new Error('CANNOT_FORCE_LOGOUT_SELF');

            await db.query('UPDATE users SET current_session_id = NULL WHERE id = ?', [targetId]);

            sseManager.broadcast(`user_${targetId}`, 'force_logout', {
                message: 'Your session has been terminated by an administrator.'
            });

            await auditService.log({
                userId: adminId,
                action: 'FORCE_LOGOUT',
                resource: 'User',
                details: { message: `Admin force-logged-out user ${targetId}` }
            });

            logger.info('User force-logged-out', { action: 'FORCE_LOGOUT', resource: 'User', adminId, targetId });
            return true;
        } catch (error) {
            logger.error('Failed to force logout user', { action: 'FORCE_LOGOUT', resource: 'User', targetId, error: error.message });
            throw error;
        }
    }
};
