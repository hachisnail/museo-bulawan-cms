import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { sendEmail } from '../../utils/mailer.js';
import { otpStore } from '../../utils/otpStore.js';
import { definitionService } from './definitionService.js';

/**
 * VerificationService
 * 
 * Handles One-Time Password (OTP) generation and verification for form submissions.
 */
export const verificationService = {
    async requestEmailOtp(slug, email) {
        try {
            const definition = await definitionService.getFormDefinition(slug);
            
            // Generate 6-digit OTP
            const otp = crypto.randomInt(100000, 999999).toString();
            const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
            
            await otpStore.set(email, { otpHash }, 300); // 5 minutes TTL
            
            // NOTE: In production, console.log should be removed or strictly for dev
            if (process.env.NODE_ENV === 'development') {
                console.log(`[DEV] OTP for ${email}: ${otp}`);
            }

            await sendEmail({
                to: email,
                subject: `Your OTP for ${definition.title}`,
                html: `<p>Your One-Time Password is: <strong>${otp}</strong></p><p>It expires in 5 minutes.</p>`
            });

            logger.info(`OTP sent to ${email} for form ${slug}`);
            return { message: "OTP sent successfully." };
        } catch (error) {
            logger.error(`Failed to request OTP for ${email}: ${error.message}`);
            throw error;
        }
    },

    async verifyOtp(email, otp) {
        if (!email || !otp) throw new Error('EMAIL_AND_OTP_REQUIRED');
        
        const cached = await otpStore.get(email);
        if (!cached) throw new Error('OTP_EXPIRED_OR_NOT_FOUND');

        const hash = crypto.createHash('sha256').update(otp).digest('hex');
        if (hash !== cached.otpHash) throw new Error('INVALID_OTP');
        
        // Consume OTP to prevent reuse
        await otpStore.delete(email);
        return { valid: true };
    }
};
