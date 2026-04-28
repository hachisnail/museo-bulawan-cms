import { db } from "../config/db.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { ulid } from "ulid";
import { logger } from "../utils/logger.js";
import { sendEmail } from "../utils/mailer.js";
import { env } from "../config/env.js";  

const generateToken = () => crypto.randomBytes(32).toString('hex');

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

            const hashedPassword = await bcrypt.hash(password, 10);
            
            // 2. Generate the ULID
            const userId = ulid(); 

            // 3. Include the 'id' in the INSERT statement
            await db.query(
                `INSERT INTO users (id, fname, lname, email, username, password, role, status) 
                 VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active')`,
                [userId, fname, lname, email, username, hashedPassword]
            );

            logger.info('First admin onboarded', {
                action: 'CREATE',
                resource: 'User',
                userId, // <-- Use the generated ULID
                username,
                email,
                role: 'admin'
            });

            return true;
        } catch (error) {
            // ... error handling ...
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
                'SELECT id, username, role, fname, lname, email, current_session_id FROM users WHERE id = ?',
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
            
            // 4. Generate the ULID for the invited user
            const userId = ulid();

            // 5. Include the 'id' in the INSERT statement
            await db.query(
                `INSERT INTO users (id, fname, lname, email, role, action_token, action_token_expires, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'invited')`,
                [userId, fname, lname, email, role || 'guest', actionToken, expires]
            );

            const setupLink = `${env.frontendUrl}/setup?token=${actionToken}`;
            await sendEmail({ /* ... */ });

            logger.info('User invited successfully', {
                action: 'CREATE',
                resource: 'User',
                newUserId: userId, // <-- Use the generated ULID
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

    async completeSetup({ token, username, password }) {
        try {
            const [user] = await db.query(
                'SELECT id FROM users WHERE action_token = ? AND action_token_expires > NOW()',
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
                logger.warn('Username already taken during setup', {
                    action: 'UPDATE',
                    resource: 'User',
                    username
                });
                throw new Error('USERNAME_TAKEN');
            }

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
                logger.warn('Invalid password reset token', {
                    action: 'UPDATE',
                    resource: 'User'
                });
                throw new Error('INVALID_TOKEN');
            }

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
    }
};