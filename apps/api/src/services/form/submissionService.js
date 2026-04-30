import crypto from 'crypto';
import Ajv from 'ajv';
import { ulid } from 'ulidx';
import { db } from '../../config/db.js';
import { mediaService } from '../mediaService.js';
import { logger } from '../../utils/logger.js';
import { otpStore } from '../../utils/otpStore.js';
import { auditService } from '../auditService.js';
import { formPipelineService } from '../formPipelineService.js';
import { definitionService } from './definitionService.js';

const ajv = new Ajv({ strict: false });

ajv.addFormat('textarea', { validate: () => true });
ajv.addFormat('file', { validate: () => true });

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
            
            await otpStore.delete(userEmail);
        }

        // 3. Build anonymous fingerprint
        const fingerprint = this._buildFingerprint(requestMeta);

        const id = ulid();

        const submission = {
            id,
            form_id: definition.id,
            data: payload,
            status: 'pending',
            submitted_by: actingStaffId || null,
            submitted_email: userEmail || null,
            anonymous_fingerprint: fingerprint
        };

        // 4. Create the submission record in MariaDB with Transaction
        const record = await db.transaction(async (tx) => {
            const submissionRecord = await tx.insertRecord('form_submissions', submission);

            // 5. Attach files to the submission record if any
            if (files && files.length > 0) {
                // we assume actingStaffId is the uploader, or null
                await mediaService.attachMedia(actingStaffId, 'form_submissions', submissionRecord.id, files, 'Form Submission Upload', tx);
            }

            // 6. Audit Log
            await auditService.log({
                collection: 'form_submissions',
                recordId: submissionRecord.id,
                action: 'submit',
                anonymousFingerprint: fingerprint,
                after: submissionRecord
            }, tx);

            return submissionRecord;
        });

        // 7. Post-submission automation triggers
        try {
            if (definition.type === 'artifact_health') {
                await formPipelineService.processHealthReportForm(actingStaffId, record.id, files);
            } else if (definition.type === 'artifact_movement') {
                await formPipelineService.processMovementTrailForm(actingStaffId, record.id, files);
            } else if (definition.type === 'artifact_conservation') {
                await formPipelineService.processConservationLogForm(actingStaffId, record.id, files);
            }
        } catch (postError) {
            logger.error(`Post-submission hook failed for ${slug}: ${postError.message}`);
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