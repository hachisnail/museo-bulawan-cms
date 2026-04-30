import { db } from '../../config/db.js';
import crypto from 'crypto';
import { baseService } from './baseService.js';
import { globalMutex } from '../../utils/mutex.js';
import { logger } from '../../utils/logger.js';
import { sendEmail } from '../../utils/mailer.js';
import { assertTransition } from '../../utils/stateMachine.js';
import { documentService } from '../documentService.js';
import { notificationService } from '../notificationService.js';

export const intakeService = {
    // ==========================================
    // PHASE 1A: Register External Intake
    // ==========================================
    async registerExternalIntake(staffId, submissionId, donorAccountId, donorName, acquisitionMethod, itemDetails) {
        return await globalMutex.runExclusive(`external_intake_${submissionId}_${itemDetails.itemName}`, async () => {
            const donationItem = await baseService._createRecord(staffId, 'donation_items', {
                submission_id: submissionId,
                item_name: itemDetails.itemName,
                description: itemDetails.description,
                quantity: itemDetails.quantity,
                status: 'accepted'
            });

            const intake = await baseService._createRecord(staffId, 'intakes', {
                submission_id: submissionId,
                donation_item_id: donationItem.id,
                donor_account_id: donorAccountId,
                proposed_item_name: itemDetails.itemName,
                donor_info: donorName,
                acquisition_method: acquisitionMethod,
                status: 'under_review',
                moa_status: 'pending'
            });

            return { intake, donationItem };
        });
    },

    // ==========================================
    // PHASE 1B: Create Internal Intake
    // ==========================================
    async createInternalIntake(staffId, itemDetails, method, loanEndDate = null) {
        return await globalMutex.runExclusive(`internal_intake_${staffId}`, async () => {
            try {
                const donationItem = await baseService._createRecord(staffId, 'donation_items', {
                    item_name: itemDetails.itemName,
                    description: itemDetails.description || 'Internal Intake Item',
                    quantity: itemDetails.quantity || 1,
                    status: 'accepted'
                });

                const intake = await baseService._createRecord(staffId, 'intakes', {
                    donation_item_id: donationItem.id,
                    proposed_item_name: itemDetails.itemName,
                    donor_info: itemDetails.sourceInfo || 'Internal/Purchase',
                    acquisition_method: method, 
                    loan_end_date: loanEndDate,
                    status: 'under_review',
                    moa_status: 'pending'
                });
                return intake;
            } catch (error) {
                logger.error(`Error creating internal intake: ${error.message}`);
                throw error;
            }
        });
    },

    // ==========================================
    // PHASE 1C: Approve Intake
    // ==========================================
    async approveIntake(staffId, intakeId) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            const result = await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'approved');
            const intake = await baseService._getRecord('intakes', intakeId);
            notificationService.sendToRole('curator', 'Intake Approved', 
                `Intake for "${intake.proposed_item_name}" has been approved. Please generate delivery documents.`, 'success', { actionUrl: `/intakes?id=${intakeId}` });
            return result;
        });
    },

    // ==========================================
    // PHASE 1D: Reject Intake
    // ==========================================
    async rejectIntake(staffId, intakeId, reason) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            const intake = await baseService._getRecord('intakes', intakeId);
            if (intake.donation_item_id) {
                await baseService._updateRecord(staffId, 'donation_items', intake.donation_item_id, { status: 'rejected' });
            }
            return await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'rejected', {
                rejection_reason: reason
            });
        });
    },

    // ==========================================
    // PHASE 1E: Reopen Rejected Intake
    // ==========================================
    async reopenIntake(staffId, intakeId) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            const intake = await baseService._getRecord('intakes', intakeId);
            if (intake.donation_item_id) {
                await baseService._updateRecord(staffId, 'donation_items', intake.donation_item_id, { status: 'accepted' });
            }
            return await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'under_review', {
                rejection_reason: null
            });
        });
    },

    // ==========================================
    // PHASE 2: Generate MOA + Delivery Slip
    // ==========================================
    async generateDynamicMOA(staffId, intakeId, overrides = {}) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            try {
                const intake = await baseService._getRecord('intakes', intakeId);
                assertTransition('intake', intake.status, 'awaiting_delivery');

                const finalDonorName = overrides.donorName || intake.donor_info;
                let finalLoanDuration = 'N/A (Permanent Transfer)';
                
                if (intake.acquisition_method === 'loan') {
                    finalLoanDuration = overrides.loanDuration || (intake.loan_end_date ? `Until ${intake.loan_end_date}` : 'Standard 6 Months');
                }

                const contractTypes = {
                    'gift': 'deed_of_gift',
                    'loan': 'loan_agreement',
                    'purchase': 'bill_of_sale',
                    'existing': 'internal_memo'
                };

                const contractType = contractTypes[intake.acquisition_method];
                if (!contractType) throw new Error('Unknown acquisition method.');

                const doc = await documentService.generateMOA(intake, 'html', overrides);
                const moaDraft = doc;

                const deliverySlipId = `DS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
                const rawToken = crypto.randomBytes(4).toString('hex').toUpperCase(); 
                const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
                const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                const updatedIntake = await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'awaiting_delivery', {
                    donor_name_override: finalDonorName,
                    loan_duration_override: finalLoanDuration !== 'N/A (Permanent Transfer)' ? finalLoanDuration : null,
                    delivery_slip_id: deliverySlipId,
                    moa_status: 'generated',
                    qr_token_hash: tokenHash,
                    qr_token_expires: tokenExpires
                });

                const donorEmail = intake.expand?.donor_account_id?.email || '';
                if (donorEmail) {
                    await sendEmail({
                        to: donorEmail,
                        subject: `Museum Acquisition Documents: ${intake.proposed_item_name}`,
                        html: `
                            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 12px;">
                                <h2 style="color: #4f46e5;">Museum Acquisition Documents</h2>
                                <p>Hello ${finalDonorName},</p>
                                <p>An official <strong>${contractType.replace(/_/g, ' ')}</strong> has been generated for your artifact: <strong>${intake.proposed_item_name}</strong>.</p>
                                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 13px; border: 1px solid #e5e7eb; margin: 20px 0;">
                                    ${moaDraft}
                                </div>
                                <h3 style="color: #111827;">Step 2: Physical Delivery</h3>
                                <p>To complete the intake, please deliver the artifact to the museum. During the handover, provide this verification token to the staff:</p>
                                <div style="background: #eff6ff; padding: 24px; border-radius: 12px; font-size: 28px; text-align: center; font-weight: 800; color: #1d4ed8; letter-spacing: 4px; border: 2px dashed #3b82f6; margin: 20px 0;">
                                    ${rawToken}
                                </div>
                                <p style="font-size: 12px; color: #6b7280; text-align: center;">
                                    <strong>Delivery Slip ID:</strong> ${deliverySlipId}<br/>
                                    This token expires on ${new Date(tokenExpires).toLocaleDateString()}.
                                </p>
                                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"/>
                                <p style="font-size: 11px; color: #9ca3af; text-align: center;">Museo Bulawan CMS - Official Acquisition Communication</p>
                            </div>
                        `
                    });
                }

                return {
                    message: "MOA and Delivery Slip generated. Email sent to donor.",
                    deliverySlipId,
                    contractType,
                    moaDraft,
                    qrPayload: { type: "delivery_confirmation", intakeId, token: rawToken },
                    intake: updatedIntake
                };
            } catch (error) {
                logger.error(`Error generating MOA: ${error.message}`);
                throw error;
            }
        });
    },

    async exportMOA(intakeId) {
        const intake = await baseService._getRecord('intakes', intakeId);
        return await documentService.generateMOA(intake, 'docx');
    },

    // ==========================================
    // PHASE 2B: Rollback AWAITING_DELIVERY → UNDER_REVIEW
    // ==========================================
    async rollbackToReview(staffId, intakeId) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            return await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'under_review', {
                delivery_slip_id: null,
                qr_token_hash: null,
                qr_token_expires: null,
                moa_status: 'pending'
            });
        });
    },

    // ==========================================
    // PHASE 2C: Verify Delivery Token
    // ==========================================
    async verifyDeliveryToken(token) {
        const submittedHash = crypto.createHash('sha256').update(token.toUpperCase()).digest('hex');
        try {
            const rows = await db.query(`SELECT * FROM intakes WHERE qr_token_hash = ?`, [submittedHash]);
            const intake = rows[0];
            if (!intake) throw new Error('Not found');

            const isExpired = new Date() > new Date(intake.qr_token_expires);
            
            return { 
                valid: !isExpired, 
                error: isExpired ? 'TOKEN_EXPIRED' : null,
                intake 
            };
        } catch (error) {
            return { valid: false, error: 'INVALID_TOKEN' };
        }
    },

    // ==========================================
    // PHASE 3A: Confirm Physical Delivery via Token
    // ==========================================
    async confirmPhysicalDelivery(staffId, intakeId, submittedToken) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            try {
                const intake = await baseService._getRecord('intakes', intakeId);
                assertTransition('intake', intake.status, 'in_custody');

                if (!intake.qr_token_hash || new Date() > new Date(intake.qr_token_expires)) {
                    throw new Error('QR Token is missing or expired.');
                }

                const hash = crypto.createHash('sha256').update(submittedToken.toUpperCase()).digest('hex');
                if (hash !== intake.qr_token_hash) {
                    throw new Error('Invalid QR Token.');
                }

                const updated = await baseService._updateRecord(staffId, 'intakes', intakeId, {
                    status: 'in_custody',
                    qr_token_hash: null,
                    qr_token_expires: null
                });

                notificationService.sendToRole('curator', 'Artifact in Custody', 
                    `Physical delivery confirmed for "${intake.proposed_item_name}". It is now ready for formal accessioning.`, 'success', { actionUrl: `/accessions?id=${intake.accession_id || ''}` });

                return updated;
            } catch (error) {
                logger.error(`Error confirming delivery: ${error.message}`);
                throw error;
            }
        });
    }
};