import crypto from 'crypto';
import Ajv from 'ajv';
import { pbService } from './pocketbaseService.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../utils/mailer.js';
import { otpStore } from '../utils/otpStore.js';
import { auditService } from './auditService.js';
import { formPipelineService } from './formPipelineService.js';


const ajv = new Ajv({ strict: false });

// Register custom UI formats so they don't break Ajv validation
ajv.addFormat('textarea', { validate: () => true });
ajv.addFormat('file', { validate: () => true });

export const formService = {
    async getFormDefinition(slug) {
        try {
            return await pbService.pb.collection('form_definitions').getFirstListItem(`slug="${slug}"`);
        } catch (error) {
            logger.error(`Form definition not found: ${slug}`);
            throw new Error('FORM_NOT_FOUND');
        }
    },

    async requestEmailOtp(slug, email) {
        const definition = await this.getFormDefinition(slug);
        
        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        
        await otpStore.set(email, { otpHash }, 300); // 5 minutes TTL
        console.log("OTP:", otp);
        await sendEmail({
            to: email,
            subject: `Your OTP for ${definition.title}`,
            html: `<p>Your One-Time Password is: <strong>${otp}</strong></p><p>It expires in 5 minutes.</p>`
        });

        logger.info(`OTP sent to ${email} for form ${slug}`);
        return { message: "OTP sent successfully." };
    },

    async verifyOtp(email, otp) {
        if (!email || !otp) throw new Error('EMAIL_AND_OTP_REQUIRED');
        
        const cached = await otpStore.get(email);
        if (!cached) throw new Error('OTP_EXPIRED_OR_NOT_FOUND');

        const hash = crypto.createHash('sha256').update(otp).digest('hex');
        if (hash !== cached.otpHash) throw new Error('INVALID_OTP');
        
        // Consume
        await otpStore.delete(email);
        return { valid: true };
    },

    /**
     * Submit a form with anonymous fingerprinting.
     * Captures IP hash and user-agent for traceability without PII.
     */
    async submitForm(slug, payload, otp, files = null, requestMeta = {}, actingStaffId = null) {
        const definition = await this.getFormDefinition(slug);
        
        // 1. JSON Schema Validation using Ajv
        if (definition.schema && Object.keys(definition.schema).length > 0) {
            const validate = ajv.compile(definition.schema);
            const valid = validate(payload);
            if (!valid) {
                throw new Error(`VALIDATION_FAILED: ${ajv.errorsText(validate.errors)}`);
            }
        }

        // 2. Extract mapped email field to verify OTP
        const mapping = definition.settings?.field_mapping || {};
        const emailField = mapping.donorEmail || 'email';
        const userEmail = payload[emailField];

        // 3. OTP Validation
        const isOtpRequired = definition.otp === true;
        
        if (userEmail && isOtpRequired) {
            if (!otp) throw new Error('OTP is required for email verification.');
            
            const cached = await otpStore.get(userEmail);
            if (!cached) throw new Error('OTP not found or expired. Please request a new one.');

            const hash = crypto.createHash('sha256').update(otp).digest('hex');
            if (hash !== cached.otpHash) throw new Error('Invalid OTP.');
            
            // Consume OTP to prevent reuse
            await otpStore.delete(userEmail);
        }

        // 4. Build anonymous fingerprint for traceability
        const fingerprint = this._buildFingerprint(requestMeta);

        // 5. Generate a unique 15-character alphanumeric ID for the submission
        // This satisfies PocketBase's requirement if auto-generation is behaving unexpectedly.
        const id = crypto.randomBytes(12).toString('hex').substring(0, 15);

        const submission = {
            id,
            form_id: definition.id,
            data: payload,
            status: 'pending',
            submitted_by: userEmail || 'anonymous',
            anonymous_fingerprint: fingerprint
        };

        let record;
        if (files && files.length > 0) {
            record = await pbService.uploadInternal('form_submissions', files, submission);
        } else {
            record = await pbService.pb.collection('form_submissions').create(submission);
        }

        // Log the anonymous submission
        await auditService.log({
            collection: 'form_submissions',
            recordId: record.id,
            action: 'submit',
            anonymousFingerprint: fingerprint,
            after: record
        });

        // Post-submission automation for specific forms
        try {
            if (definition.type === 'artifact_health') {
                await formPipelineService.processHealthReportForm(actingStaffId, record.id, files);
            } else if (definition.type === 'artifact_movement') {
                await formPipelineService.processMovementTrailForm(actingStaffId, record.id, files);
            }
        } catch (postError) {
            logger.error(`Post-submission hook failed for ${slug}: ${postError.message}`);
            // We don't fail the submission itself as the record is already saved
        }

        return record;
    },

    /**
     * Creates a non-PII fingerprint hash from request metadata.
     * Used for anonymous donor traceability without storing raw IP/UA.
     */
    _buildFingerprint(meta = {}) {
        const parts = [
            meta.ip || 'unknown',
            meta.userAgent || 'unknown',
            new Date().toISOString().split('T')[0] // date-bucket
        ].join('|');
        return crypto.createHash('sha256').update(parts).digest('hex').substring(0, 16);
    },

    // ==========================================
    // SUBMISSION QUERIES (Staff-facing)
    // ==========================================

    /**
     * List submissions with advanced filters.
     * Supports: status, date range, search, pagination, sort.
     */
    async listSubmissions(slug, query = {}) {
        const definition = await this.getFormDefinition(slug);
        const page = query.page || 1;
        const perPage = query.perPage || 50;

        // Build filter chain
        let filterParts = [`form_id="${definition.id}"`];

        if (query.status) {
            filterParts.push(`status="${query.status}"`);
        }

        if (query.dateFrom) {
            filterParts.push(`created>="${query.dateFrom}"`);
        }
        if (query.dateTo) {
            filterParts.push(`created<="${query.dateTo}"`);
        }

        if (query.search) {
            // Search in submitted_by (email) field
            filterParts.push(`submitted_by~"${query.search}"`);
        }

        const options = {
            filter: filterParts.join(' && '),
            sort: query.sort || '-created',
        };

        return await pbService.pb.collection('form_submissions').getList(page, perPage, options);
    },

    /**
     * List ALL submissions across all forms (admin overview).
     * No slug required.
     */
    async listAllSubmissions(query = {}) {
        const page = query.page || 1;
        const perPage = query.perPage || 50;

        let filterParts = [];

        if (query.status) {
            filterParts.push(`status="${query.status}"`);
        }
        if (query.dateFrom) {
            filterParts.push(`created>="${query.dateFrom}"`);
        }
        if (query.dateTo) {
            filterParts.push(`created<="${query.dateTo}"`);
        }
        if (query.search) {
            filterParts.push(`submitted_by~"${query.search}"`);
        }

        const options = {
            filter: filterParts.length > 0 ? filterParts.join(' && ') : '',
            sort: query.sort || '-created',
            expand: 'form_id'
        };

        return await pbService.pb.collection('form_submissions').getList(page, perPage, options);
    },

    /**
     * Get a single submission with full detail.
     */
    async getSubmission(submissionId) {
        try {
            return await pbService.pb.collection('form_submissions').getOne(submissionId, {
                expand: 'form_id'
            });
        } catch (error) {
            logger.error(`Submission not found: ${submissionId}`);
            throw new Error('SUBMISSION_NOT_FOUND');
        }
    },

    /**
     * Get donation items linked to a submission.
     */
    async getSubmissionItems(submissionId) {
        return await pbService.pb.collection('donation_items').getFullList({
            filter: `submission_id="${submissionId}"`,
            sort: '-created'
        });
    }
};