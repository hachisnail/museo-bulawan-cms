import { db } from "../../config/db.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { ulid } from "ulid";
import { logger } from "../../utils/logger.js";
import { sendEmail } from "../../utils/mailer.js";
import { env } from "../../config/env.js";

import { auditService } from "../auditService.js";
import { securityService } from "./securityService.js";

const generateToken = () => crypto.randomBytes(32).toString('hex');

/**
 * LifecycleService
 * 
 * Handles onboarding, invitations, setup completion, and automated donor provisioning.
 */
export const lifecycleService = {
    async hasAnyUsers() {
        try {
            const [result] = await db.query('SELECT COUNT(*) as count FROM users');
            return Number(result.count) > 0;
        } catch (error) {
            logger.error('Failed to check users count', { error: error.message });
            throw error;
        }
    },

    async onboardFirstAdmin({ fname, lname, email, username, password }) {
        try {
            const hasUsers = await this.hasAnyUsers();
            if (hasUsers) throw new Error('ALREADY_ONBOARDED');

            securityService.validatePasswordStrength(password);
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

    async inviteUser({ fname, lname, email, role }) {
        try {
            const [existingUser] = await db.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (existingUser) {
                logger.warn('Attempt to invite existing email', { email });
                throw new Error('EMAIL_EXISTS');
            }

            const actionToken = generateToken();
            const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);
            const userId = ulid();

            await db.query(
                `INSERT INTO users (id, fname, lname, email, role, action_token, action_token_expires, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'invited')`,
                [userId, fname, lname, email, role || 'visitor', actionToken, expires]
            );

            const setupLink = `${env.frontendUrl}/setup?token=${actionToken}`;
            await sendEmail({
                to: email,
                subject: 'You have been invited to Museo Bulawan',
                html: `<p>Hello ${fname},</p><p>You've been invited to join the museum system as <strong>${role || 'visitor'}</strong>.</p><p><a href="${setupLink}">Click here to set up your account</a></p><p>This link expires in 48 hours.</p>`
            });

            logger.info('User invited successfully', { email, role: role || 'visitor' });

            return actionToken;

        } catch (error) {
            logger.error('Failed to invite user', { email, error: error.message });
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

            logger.info('Invite resent', { adminId, targetId });
            return true;
        } catch (error) {
            logger.error('Failed to resend invite', { targetId, error: error.message });
            throw error;
        }
    },

    async provisionDonor({ fname, lname, email, title, phone, address }) {
        try {
            const [existing] = await db.query('SELECT id, username, role FROM users WHERE email = ?', [email]);
            if (existing) {
                logger.info('Using existing MariaDB account for donor', { email, userId: existing.id });

                return { userId: existing.id, isNew: false, username: existing.username, role: existing.role };
            }

            const userId = ulid();
            const actionToken = generateToken();
            const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days for donors

            await db.query(
                `INSERT INTO users (id, fname, lname, email, role, status, action_token, action_token_expires) 
                 VALUES (?, ?, ?, ?, 'donor', 'invited', ?, ?)`,
                [userId, fname, lname, email, actionToken, tokenExpires]
            );



            logger.info('Donor provisioned successfully', { userId, email });

            const setupUrl = `${env.frontendUrl}/setup?token=${actionToken}`;
            const visitorSetupUrl = setupUrl.replace('http://localhost:5173', 'http://localhost:4321');

            try {
                await sendEmail({
                    to: email,
                    subject: 'Set up your Museo Bulawan donor account',
                    html: `<p>Hello ${fname},</p><p>An account has been created for you as a <strong>donor</strong> in the Museo Bulawan system.</p><p><a href="${visitorSetupUrl}">Click here to set up your account and password</a></p><p>This link expires in 7 days.</p>`
                });
            } catch (emailErr) {
                logger.error(`Non-blocking error sending donor setup email: ${emailErr.message}`);
            }

            return { userId, setupUrl, isNew: true };
        } catch (error) {
            logger.error('Failed to provision donor', { error: error.message });
            throw new Error('DONOR_PROVISIONING_FAILED');
        }
    },

    async completeSetup({ token, username, password }) {
        try {
            const [user] = await db.query(
                'SELECT id, fname, lname, email, role FROM users WHERE action_token = ? AND action_token_expires > NOW()',
                [token]
            );

            if (!user) {
                throw new Error('INVALID_TOKEN');
            }

            const [usernameCheck] = await db.query(
                'SELECT id FROM users WHERE username = ?',
                [username]
            );

            if (usernameCheck) {
                throw new Error('USERNAME_TAKEN');
            }

            securityService.validatePasswordStrength(password);
            const hashedPassword = await bcrypt.hash(password, 10);

            await db.query(
                `UPDATE users 
                 SET username = ?, password = ?, status = 'active',
                     action_token = NULL, action_token_expires = NULL 
                 WHERE id = ?`,
                [username, hashedPassword, user.id]
            );

            logger.info('User setup completed', { userId: user.id, username });



            return true;

        } catch (error) {
            logger.error('Failed to complete setup', { username, error: error.message });
            throw error;
        }
    }
};
