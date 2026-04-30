import { db } from "../../config/db.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { logger } from "../../utils/logger.js";
import { sendEmail } from "../../utils/mailer.js";
import { env } from "../../config/env.js";
import { auditService } from "../auditService.js";

const generateToken = () => crypto.randomBytes(32).toString('hex');
const PASSWORD_MIN_LENGTH = 8;

/**
 * SecurityService
 * 
 * Handles password policies, resets, and credential changes.
 */
export const securityService = {
    validatePasswordStrength(password) {
        if (!password || password.length < PASSWORD_MIN_LENGTH) {
            throw new Error(`PASSWORD_TOO_WEAK: Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
        }
        // At least one uppercase, one lowercase, one digit
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            throw new Error('PASSWORD_TOO_WEAK: Password must contain uppercase, lowercase, and a digit.');
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

            this.validatePasswordStrength(newPassword);
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

    async changePassword(userId, { currentPassword, newPassword }) {
        try {
            const [user] = await db.query('SELECT id, password FROM users WHERE id = ?', [userId]);
            if (!user) throw new Error('USER_NOT_FOUND');

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) throw new Error('INCORRECT_PASSWORD');

            this.validatePasswordStrength(newPassword);
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
    }
};
