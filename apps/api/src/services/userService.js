import { db } from "../config/db.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { ulid } from "ulid";
import { logger } from "../utils/logger.js";
import { sendEmail } from "../utils/mailer.js";
import { env } from "../config/env.js";  
import { pbService } from "./pocketbaseService.js";
import { sseManager } from "../utils/sseFactory.js";
import { auditService } from "./auditService.js";

const generateToken = () => crypto.randomBytes(32).toString('hex');

// Centralized password policy
const PASSWORD_MIN_LENGTH = 8;
const validatePasswordStrength = (password) => {
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`PASSWORD_TOO_WEAK: Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    }
    // At least one uppercase, one lowercase, one digit
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        throw new Error('PASSWORD_TOO_WEAK: Password must contain uppercase, lowercase, and a digit.');
    }
};

export const userService = {

    async hasAnyUsers() {
        try {
            const [result] = await db.query('SELECT COUNT(*) as count FROM users');

            logger.info('Checked if any users exist', {
                action: 'READ',
                resource: 'User',
                count: Number(result.count)
            });

            return Number(result.count) > 0;
        } catch (error) {
            logger.error('Failed to check users count', {
                action: 'READ',
                resource: 'User',
                error: error.message
            });
            throw error;
        }
    },

async onboardFirstAdmin({ fname, lname, email, username, password }) {
        try {
            const hasUsers = await this.hasAnyUsers();
            if (hasUsers) throw new Error('ALREADY_ONBOARDED');

            validatePasswordStrength(password);
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const userId = ulid(); 

            await db.query(
                `INSERT INTO users (id, fname, lname, email, username, password, role, status) 
                 VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active')`,
                [userId, fname, lname, email, username, hashedPassword]
            );

            logger.info('First admin onboarded', {
                action: 'CREATE',
                resource: 'User',
                userId,
                username,
                email,
                role: 'admin'
            });

            // FIX: Pass the generated userId so PB can link via external_id
            await pbService.syncUser({ id: userId, email, role: 'admin', fname, lname });

            return true;
        } catch (error) {
            logger.error('Failed to onboard first admin', {
                action: 'CREATE',
                resource: 'User',
                error: error.message
            });
            throw error;
        }
    },

    async getUserByUsername(username) {
        try {
            const [user] = await db.query(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );

            logger.info('Fetched user by username', {
                action: 'READ',
                resource: 'User',
                username,
                found: !!user
            });

            return user || null;
        } catch (error) {
            logger.error('Failed to fetch user by username', {
                action: 'READ',
                resource: 'User',
                username,
                error: error.message
            });
            throw error;
        }
    },

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

    async inviteUser({ fname, lname, email, role }) {
        try {
            const [existingUser] = await db.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (existingUser) {
                logger.warn('Attempt to invite existing email', {
                    action: 'CREATE',
                    resource: 'User',
                    email
                });
                throw new Error('EMAIL_EXISTS');
            }

            const actionToken = generateToken();
            const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);
            const userId = ulid();

            await db.query(
                `INSERT INTO users (id, fname, lname, email, role, action_token, action_token_expires, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'invited')`,
                [userId, fname, lname, email, role || 'guest', actionToken, expires]
            );

            // Send invite email (single source of truth)
            const setupLink = `${env.frontendUrl}/setup?token=${actionToken}`;
            await sendEmail({
                to: email,
                subject: 'You have been invited to Museo Bulawan',
                html: `<p>Hello ${fname},</p><p>You've been invited to join the museum system as <strong>${role || 'guest'}</strong>.</p><p><a href="${setupLink}">Click here to set up your account</a></p><p>This link expires in 48 hours.</p>`
            });

            logger.info('User invited successfully', {
                action: 'CREATE',
                resource: 'User',
                newUserId: userId,
                email,
                role: role || 'guest'
            });

            return actionToken;

        } catch (error) {
            logger.error('Failed to invite user', {
                action: 'CREATE',
                resource: 'User',
                email,
                error: error.message
            });
            throw error;
        }
    },

    /**
     * PROVISION DONOR: Specifically for automatic visitor/donor account creation
     * during the intake process. Creates a real MariaDB account with a temp password.
     */
    async provisionDonor({ fname, lname, email, title, phone, address }) {
        try {
            // Check if user already exists in MariaDB
            const [existing] = await db.query('SELECT id, username FROM users WHERE email = ?', [email]);
            if (existing) {
                logger.info('Using existing MariaDB account for donor', { email, userId: existing.id });
                // Resync to ensure PB has latest info
                await pbService.syncUser({ id: existing.id, email, role: 'visitor', fname, lname, title, phone, address });
                return { userId: existing.id, isNew: false, username: existing.username };
            }

            const userId = ulid();
            const tempPassword = crypto.randomBytes(6).toString('hex');
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            const username = email.split('@')[0] + '_' + crypto.randomBytes(2).toString('hex');

            await db.query(
                `INSERT INTO users (id, fname, lname, email, username, password, role, status) 
                 VALUES (?, ?, ?, ?, ?, ?, 'visitor', 'active')`,
                [userId, fname, lname, email, username, hashedPassword]
            );

            // Sync to PB
            await pbService.syncUser({ 
                id: userId, 
                email, 
                role: 'visitor', 
                fname, 
                lname,
                title,
                phone,
                address
            });

            logger.info('Donor provisioned successfully', {
                action: 'CREATE',
                resource: 'User',
                userId,
                email
            });

            return { userId, tempPassword, username, isNew: true };
        } catch (error) {
            logger.error('Failed to provision donor', {
                action: 'CREATE',
                resource: 'User',
                error: error.message
            });
            throw error;
        }
    },

    async completeSetup({ token, username, password }) {
        try {
            const [user] = await db.query(
                'SELECT id, fname, lname, email, role FROM users WHERE action_token = ? AND action_token_expires > NOW()',
                [token]
            );

            if (!user) {
                logger.warn('Invalid or expired setup token', {
                    action: 'UPDATE',
                    resource: 'User'
                });
                throw new Error('INVALID_TOKEN');
            }

            const [usernameCheck] = await db.query(
                'SELECT id FROM users WHERE username = ?',
                [username]
            );

            if (usernameCheck) {
                throw new Error('USERNAME_TAKEN');
            }

            validatePasswordStrength(password);
            const hashedPassword = await bcrypt.hash(password, 10);

            await db.query(
                `UPDATE users 
                 SET username = ?, password = ?, status = 'active',
                     action_token = NULL, action_token_expires = NULL 
                 WHERE id = ?`,
                [username, hashedPassword, user.id]
            );

            logger.info('User setup completed', {
                action: 'UPDATE',
                resource: 'User',
                userId: user.id,
                username
            });

            // FIX: Pass the user's ULID id so PB can link via external_id
            await pbService.syncUser({ id: user.id, email: user.email, role: user.role, fname: user.fname, lname: user.lname });

            return true;

        } catch (error) {
            logger.error('Failed to complete setup', {
                action: 'UPDATE',
                resource: 'User',
                username,
                error: error.message
            });
            throw error;
        }
    },

    async requestPasswordReset(email) {
        try {
            const [user] = await db.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (!user) {
                logger.info('Password reset requested for non-existing email', {
                    action: 'UPDATE',
                    resource: 'User',
                    email
                });
                return null;
            }

            const actionToken = generateToken();
            const expires = new Date(Date.now() + 1 * 60 * 60 * 1000);

            await db.query(
                'UPDATE users SET action_token = ?, action_token_expires = ? WHERE id = ?',
                [actionToken, expires, user.id]
            );

            // ==========================================
            // NEW: Send the Password Reset Email
            // ==========================================
            const resetLink = `${env.frontendUrl}/reset-password?token=${actionToken}`;
            await sendEmail({
                to: email,
                subject: "Password Reset Request",
                text: `Click the link below to reset your password. It will expire in 1 hour.\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`
            });

            logger.info('Password reset token generated & email sent', {
                action: 'UPDATE',
                resource: 'User',
                userId: user.id
            });

            return actionToken;

        } catch (error) {
            logger.error('Failed to request password reset', {
                action: 'UPDATE',
                resource: 'User',
                email,
                error: error.message
            });
            throw error;
        }
    },

    async resetPassword({ token, newPassword }) {
        try {
            const [user] = await db.query(
                'SELECT id FROM users WHERE action_token = ? AND action_token_expires > NOW()',
                [token]
            );

            if (!user) {
                throw new Error('INVALID_TOKEN');
            }

            validatePasswordStrength(newPassword);
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            await db.query(
                'UPDATE users SET password = ?, action_token = NULL, action_token_expires = NULL WHERE id = ?',
                [hashedPassword, user.id]
            );

            logger.info('Password reset successful', {
                action: 'UPDATE',
                resource: 'User',
                userId: user.id
            });

            return true;

        } catch (error) {
            logger.error('Failed to reset password', {
                action: 'UPDATE',
                resource: 'User',
                error: error.message
            });
            throw error;
        }
    },

    async listUsers() {
        try {
            // FIX: db.query returns rows directly from MariaDB pool; do NOT destructure
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

    // ==========================================
    // SELF-EDIT: Any authenticated user
    // ==========================================

    async updateProfile(userId, { fname, lname }) {
        try {
            await db.query(
                'UPDATE users SET fname = ?, lname = ? WHERE id = ?',
                [fname, lname, userId]
            );

            // Sync name change to PocketBase
            const [user] = await db.query('SELECT id, email, role, fname, lname FROM users WHERE id = ?', [userId]);
            if (user) {
                await pbService.syncUser({ id: user.id, email: user.email, role: user.role, fname: user.fname, lname: user.lname });
            }

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
    },

    async changePassword(userId, { currentPassword, newPassword }) {
        try {
            const [user] = await db.query('SELECT id, password FROM users WHERE id = ?', [userId]);
            if (!user) throw new Error('USER_NOT_FOUND');

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) throw new Error('INCORRECT_PASSWORD');

            validatePasswordStrength(newPassword);
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

            await auditService.log({
                userId,
                action: 'UPDATE',
                resource: 'User',
                details: { message: 'Password changed by user' }
            });

            logger.info('Password changed', { action: 'UPDATE', resource: 'User', userId });
            return true;
        } catch (error) {
            logger.error('Failed to change password', { action: 'UPDATE', resource: 'User', userId, error: error.message });
            throw error;
        }
    },

    // ==========================================
    // ADMIN MANAGEMENT
    // ==========================================

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
    },

    async resendInvite(adminId, targetId) {
        try {
            const [user] = await db.query(
                "SELECT id, fname, email, role FROM users WHERE id = ? AND status = 'invited'",
                [targetId]
            );
            if (!user) throw new Error('NOT_AN_INVITED_USER');

            const actionToken = generateToken();
            const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

            await db.query(
                'UPDATE users SET action_token = ?, action_token_expires = ? WHERE id = ?',
                [actionToken, expires, targetId]
            );

            const setupLink = `${env.frontendUrl}/setup?token=${actionToken}`;
            await sendEmail({
                to: user.email,
                subject: 'Reminder: Set up your Museo Bulawan account',
                html: `<p>Hello ${user.fname},</p><p>This is a reminder to set up your account as <strong>${user.role}</strong>.</p><p><a href="${setupLink}">Click here to set up your account</a></p><p>This link expires in 48 hours.</p>`
            });

            await auditService.log({
                userId: adminId,
                action: 'RESEND_INVITE',
                resource: 'User',
                details: { message: `Admin resent invite to ${user.email}` }
            });

            logger.info('Invite resent', { action: 'RESEND_INVITE', resource: 'User', adminId, targetId });
            return true;
        } catch (error) {
            logger.error('Failed to resend invite', { action: 'RESEND_INVITE', resource: 'User', targetId, error: error.message });
            throw error;
        }
    }
};