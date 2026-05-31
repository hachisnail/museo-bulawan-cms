import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// Initialize Nodemailer Transport ONLY if we are in production
const transporter = env.isProd
    ? nodemailer.createTransport({
          host: env.mail.host,
          port: env.mail.port,
          secure: env.mail.port === 465, // true for 465, false for 587/25
          auth: {
              user: env.mail.user,
              pass: env.mail.pass,
          },
      })
    : null;

export const sendEmail = async ({ to, subject, text, html }) => {
    const mailOptions = {
        from: env.mail.from,
        to,
        subject,
        text,
        html: html || text, // Fallback to text if HTML isn't provided
    };

    // ==========================================
    // DEVELOPMENT MODE: Console Mailer
    // ==========================================
    if (!env.isProd) {
        logger.info(`[CONSOLE MAILER] Ready to send...`);
        logger.info(`TO: ${to}`);
        logger.info(`SUBJECT: ${subject}`);
        logger.debug(`BODY:\n${html || text}`); 
        return true;
    }

    // ==========================================
    // PRODUCTION MODE: Real SMTP Mailer
    // ==========================================
    try {
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Real email sent to ${to} | ID: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error(`Failed to send email to ${to}`, { error: error.message });
        throw new Error('EMAIL_SEND_FAILED');
    }
};

/**
 * Sends an email with retry logic (exponential backoff).
 */
export const sendEmailWithRetry = async (options, maxRetries = 3, delay = 2000) => {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await sendEmail(options);
        } catch (error) {
            lastError = error;
            logger.warn(`Email send attempt ${attempt} failed to ${options.to}: ${error.message}.`);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
    logger.error(`All ${maxRetries} email send attempts failed to ${options.to}.`);
    throw lastError;
};