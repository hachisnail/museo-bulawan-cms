import crypto from 'crypto';
import Ajv from 'ajv';
import { pbService } from '../pocketbaseService.js';
import { logger } from '../../utils/logger.js';
import { otpStore } from '../../utils/otpStore.js';
import { auditService } from '../auditService.js';
import { formPipelineService } from '../formPipelineService.js';
import { definitionService } from './definitionService.js';

const ajv = new Ajv({ strict: false });

// Register custom UI formats so they don't break Ajv validation
ajv.addFormat('textarea', { validate: () => true });
ajv.addFormat('file', { validate: () => true });

/**
 * SubmissionService
 * 
 * Handles the processing of incoming form submissions, including validation,
 * OTP consumption, fingerprinting, and post-submission automation triggers.
 */
export const submissionService = {
    async submitForm(slug, payload, otp, files = null, requestMeta = {}, actingStaffId = null) {
        const definition = await definitionService.getFormDefinition(slug);
        
        // 1. JSON Schema Validation
        if (definition.schema && Object.keys(definition.schema).length > 0) {
            const validate = ajv.compile(definition.schema);
            const valid = validate(payload);
            if (!valid) {
                throw new Error(`VALIDATION_FAILED: ${ajv.errorsText(validate.errors)}`);
            }
        }

        // 2. OTP Validation
        const mapping = definition.settings?.field_mapping || {};
        const emailField = mapping.donorEmail || 'email';
        const userEmail = payload[emailField];
        const isOtpRequired = definition.otp === true;
        
        if (userEmail && isOtpRequired) {
            if (!otp) throw new Error('OTP is required for email verification.');
            
            const cached = await otpStore.get(userEmail);
            if (!cached) throw new Error('OTP not found or expired. Please request a new one.');

            const hash = crypto.createHash('sha256').update(otp).digest('hex');
            if (hash !== cached.otpHash) throw new Error('Invalid OTP.');
            
            // Consume OTP
            await otpStore.delete(userEmail);
        }

        // 3. Build anonymous fingerprint
        const fingerprint = this._buildFingerprint(requestMeta);

        // 4. Generate unique ID for PB
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

        // 5. Audit Log
        await auditService.log({
            collection: 'form_submissions',
            recordId: record.id,
            action: 'submit',
            anonymousFingerprint: fingerprint,
            after: record
        });

        // 6. Post-submission automation triggers
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

    _buildFingerprint(meta = {}) {
        const parts = [
            meta.ip || 'unknown',
            meta.userAgent || 'unknown',
            new Date().toISOString().split('T')[0] // date-bucket
        ].join('|');
        return crypto.createHash('sha256').update(parts).digest('hex').substring(0, 16);
    }
};
