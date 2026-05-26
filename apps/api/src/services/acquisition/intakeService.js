import { db } from '../../config/db.js';
import crypto from 'crypto';
import { baseService } from './baseService.js';
import { globalMutex } from '../../utils/mutex.js';
import { logger } from '../../utils/logger.js';
import { sendEmail } from '../../utils/mailer.js';
import { assertTransition } from '../../utils/stateMachine.js';
import { documentService } from '../documentService.js';
import { notificationService } from '../notificationService.js';
import { getContractType } from '../../utils/constants.js';
import { userService } from '../userService.js';
import { env } from '../../config/env.js';
import QRCode from 'qrcode';

export const intakeService = {
    // ==========================================
    // PHASE 1A: Register External Intake
    // ==========================================
    async registerExternalIntake(staffId, submissionId, donorAccountId, donorName, acquisitionMethod, itemDetails, loanEndDate = null, connection = null) {
        return await globalMutex.runExclusive(`external_intake_${submissionId}_${itemDetails.itemName}`, async () => {
            const donationItem = await baseService._createRecord(staffId, 'donation_items', {
                submission_id: submissionId,
                item_name: itemDetails.itemName,
                description: itemDetails.description,
                quantity: itemDetails.quantity,
                status: 'accepted'
            }, connection);

            // For donation-type acquisitions (gift, loan, bequest), the artifact has NOT been
            // delivered yet at this stage — it only arrives after confirmPhysicalDelivery.
            // Location is therefore null until delivery is confirmed.
            // For non-donation types (purchase, existing), the artifact is assumed already in hand.
            const method = (acquisitionMethod || 'gift').toLowerCase();
            const initialLocation = ['gift', 'loan', 'bequest'].includes(method) ? null : 'Receiving Bay';

            const intake = await baseService._createRecord(staffId, 'intakes', {
                submission_id: submissionId,
                donation_item_id: donationItem.id,
                donor_account_id: donorAccountId,
                proposed_item_name: itemDetails.itemName,
                donor_info: donorName,
                acquisition_method: acquisitionMethod,
                loan_end_date: loanEndDate,
                status: 'under_review',
                moa_status: 'pending',
                current_location: initialLocation
            }, connection);

            return { intake, donationItem };
        });
    },

    // ==========================================
    // PHASE 1B: Create Internal Intake
    // ==========================================
    async createInternalIntake(staffId, itemDetails, method, loanEndDate = null) {
        return await globalMutex.runExclusive(`internal_intake_${staffId}`, async () => {
            try {
                return await db.transaction(async (tx) => {
                    const donationItem = await baseService._createRecord(staffId, 'donation_items', {
                        item_name: itemDetails.itemName,
                        description: itemDetails.description || 'Internal Intake Item',
                        quantity: itemDetails.quantity || 1,
                        status: 'accepted'
                    }, tx);

                    // For gift/loan types, the artifact has not been received yet — no location.
                    // For purchase/existing, the artifact is already on-site, so set Receiving Bay.
                    const normalizedMethod = (method || 'gift').toLowerCase();
                    const initialLocation = ['gift', 'loan', 'bequest'].includes(normalizedMethod) ? null : 'Receiving Bay';

                    const intake = await baseService._createRecord(staffId, 'intakes', {
                        donation_item_id: donationItem.id,
                        proposed_item_name: itemDetails.itemName,
                        donor_info: itemDetails.sourceInfo || 'Internal/Purchase',
                        acquisition_method: method,
                        loan_end_date: loanEndDate,
                        status: 'under_review',
                        moa_status: 'pending',
                        current_location: initialLocation
                    }, tx);
                    return intake;
                });
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
            return await db.transaction(async (tx) => {
                const intake = await baseService._getRecord('intakes', intakeId, {}, tx);
                if (intake.donation_item_id) {
                    await baseService._updateRecord(staffId, 'donation_items', intake.donation_item_id, { status: 'rejected' }, tx);
                }
                return await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'rejected', {
                    rejection_reason: reason
                }, tx);
            });
        });
    },

    // ==========================================
    // PHASE 1E: Reopen Rejected Intake
    // ==========================================
    async reopenIntake(staffId, intakeId) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            return await db.transaction(async (tx) => {
                const intake = await baseService._getRecord('intakes', intakeId, {}, tx);
                if (intake.donation_item_id) {
                    await baseService._updateRecord(staffId, 'donation_items', intake.donation_item_id, { status: 'accepted' }, tx);
                }
                return await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'under_review', {
                    rejection_reason: null
                }, tx);
            });
        });
    },

    // ==========================================
    // PHASE 2: Generate MOA + Delivery Slip
    // ==========================================
    async generateDynamicMOA(staffId, intakeId, overrides = {}) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            try {
                const intake = await baseService._getRecord('intakes', intakeId, { expand: 'donor_account_id,donation_item_id' });
                assertTransition('intake', intake.status, 'awaiting_delivery');

                const finalDonorName = overrides.donorName || intake.donor_info;
                let finalLoanDuration = 'N/A (Permanent Transfer)';
                
                if (intake.acquisition_method === 'loan') {
                    finalLoanDuration = overrides.loanDuration || (intake.loan_end_date ? `Until ${intake.loan_end_date}` : 'Standard 6 Months');
                }

                const contractType = getContractType(intake.acquisition_method);

                const docHtml = await documentService.generateMOA(intake, 'html', overrides);
                const docDocx = await documentService.generateMOA(intake, 'docx', overrides);
                
                const moaDraft = docHtml;
                const docxBase64 = docDocx.toString('base64');

                const deliverySlipId = `DS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
                const rawToken = crypto.randomBytes(4).toString('hex').toUpperCase(); 
                const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
                const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                // Generate QR Code image as a base64 Data URL
                const qrImageBase64 = await QRCode.toDataURL(rawToken, {
                    width: 250,
                    margin: 2,
                    color: {
                        dark: '#1A1A1A',
                        light: '#FFFFFF'
                    }
                });

                // Fetch donor details from the linked submission if not already provisioned
                let donorEmail = intake.expand?.donor_account_id?.email || '';
                let donorName = finalDonorName;
                let isAnonymous = false;
                let donorExtras = { title: "", phone: "", address: "" };

                if (!donorEmail && intake.submission_id) {
                    const [submission] = await db.query(`
                        SELECT s.*, f.settings as form_settings
                        FROM form_submissions s
                        JOIN form_definitions f ON s.form_id = f.id
                        WHERE s.id = ?
                    `, [intake.submission_id]);
                    if (submission) {
                        const subData = typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data;
                        const settings = typeof submission.form_settings === 'string' ? JSON.parse(submission.form_settings) : submission.form_settings;
                        const mapping = settings?.field_mapping || {};

                        isAnonymous = subData.is_anonymous === true || subData.is_anonymous === 'true' || subData.is_anonymous === 1 || subData.is_anonymous === '1';
                        const firstName = isAnonymous ? "Anonymous" : (subData[mapping.firstName] || subData.donor_first_name || subData.firstName || "Anonymous");
                        const lastName = isAnonymous ? "Donor" : (subData[mapping.lastName] || subData.donor_last_name || subData.lastName || "");
                        
                        donorName = (subData[mapping.donorName] || `${firstName} ${lastName}`).trim();
                        donorEmail = subData[mapping.donorEmail] || subData.donor_email || subData.email;

                        donorExtras = isAnonymous ? { title: "", phone: "", address: "" } : {
                            title: subData.donor_title || "",
                            phone: subData.donor_phone || "",
                            address: subData.donor_address || ""
                        };
                    }
                }

                // Provision visitor account on intake approval if email is present
                let donorAccountId = intake.donor_account_id;
                let accountDetails = null;

                if (donorEmail) {
                    const lockKey = `provision_user_${donorEmail.toLowerCase()}`;
                    accountDetails = await globalMutex.runExclusive(lockKey, async () => {
                        const [existingUser] = await db.query('SELECT id, role FROM users WHERE email = ?', [donorEmail]);

                        if (existingUser) {
                            return { userId: existingUser.id, isNew: false, setupUrl: null, role: existingUser.role };
                        }

                        const [fname, ...rest] = (donorName || "Valued Donor").split(" ");
                        const lname = rest.join(" ") || "";

                        const result = await userService.provisionDonor({ fname, lname, email: donorEmail, ...donorExtras });

                        return {
                            userId: result.userId,
                            isNew: true,
                            setupUrl: result.setupUrl,
                            role: 'donor'
                        };
                    });
                    
                    donorAccountId = accountDetails.userId;
                }

                const updatedIntake = await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'awaiting_delivery', {
                    donor_name_override: finalDonorName,
                    loan_duration_override: finalLoanDuration !== 'N/A (Permanent Transfer)' ? finalLoanDuration : null,
                    delivery_slip_id: deliverySlipId,
                    moa_status: 'generated',
                    qr_token_hash: tokenHash,
                    qr_token: rawToken,
                    qr_token_expires: tokenExpires,
                    donor_account_id: donorAccountId
                });

                let visitorSetupUrl = null;
                if (donorEmail) {
                    const isStaff = accountDetails && !['donor', 'visitor'].includes(accountDetails.role) && !accountDetails.isNew;
                    const portalUrl = isStaff ? "http://localhost:3001" : "http://localhost:4321";
                    visitorSetupUrl = accountDetails?.setupUrl ? accountDetails.setupUrl.replace('http://localhost:5173', 'http://localhost:4321') : null;
                    let portalSection = "";
                    if (accountDetails?.isNew && visitorSetupUrl) {
                        portalSection = `
                            <div style="border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 24px; background-color: #FAFAFA;">
                                <div style="margin-bottom: 12px;">
                                    <span style="background-color: #D4AF37; color: #111827; font-weight: 700; font-size: 14px; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; display: inline-block; margin-right: 10px;">1</span>
                                    <h3 style="color: #111827; font-size: 16px; font-weight: 700; margin: 0; display: inline-block; vertical-align: middle;">Set Up Your Visitor Portal</h3>
                                </div>
                                <p style="font-size: 14px; color: #4B5563; line-height: 1.5; margin: 0 0 16px 0;">
                                    We have provisioned a secure Visitor Portal account for you. Log in to track the physical delivery, inspect condition reports, and view historical documentation.
                                </p>
                                <div style="text-align: center; margin: 16px 0;">
                                    <a href="${visitorSetupUrl}" style="background-color: #111827; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block; border: 1px solid #D4AF37; font-size: 14px;">Set Up Your Password</a>
                                </div>
                                <p style="font-size: 11px; color: #9CA3AF; text-align: center; margin-top: 8px; margin-bottom: 0;">This activation link expires in 7 days.</p>
                            </div>
                        `;
                    } else if (isStaff) {
                        portalSection = `
                            <div style="border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 24px; background-color: #FAFAFA;">
                                <div style="margin-bottom: 12px;">
                                    <span style="background-color: #D4AF37; color: #111827; font-weight: 700; font-size: 14px; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; display: inline-block; margin-right: 10px;">1</span>
                                    <h3 style="color: #111827; font-size: 16px; font-weight: 700; margin: 0; display: inline-block; vertical-align: middle;">Access Management Panel</h3>
                                </div>
                                <p style="font-size: 14px; color: #4B5563; line-height: 1.5; margin: 0 0 16px 0;">
                                    Since you have an active Staff/Admin account, you can track this transaction directly within the Museum Management Panel.
                                </p>
                                <div style="text-align: center; margin: 16px 0;">
                                    <a href="${portalUrl}" style="background-color: #111827; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block; border: 1px solid #D4AF37; font-size: 14px;">Log In to Management Panel</a>
                                </div>
                            </div>
                        `;
                    } else {
                        portalSection = `
                            <div style="border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 24px; background-color: #FAFAFA;">
                                <div style="margin-bottom: 12px;">
                                    <span style="background-color: #D4AF37; color: #111827; font-weight: 700; font-size: 14px; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; display: inline-block; margin-right: 10px;">1</span>
                                    <h3 style="color: #111827; font-size: 16px; font-weight: 700; margin: 0; display: inline-block; vertical-align: middle;">Access Your Visitor Portal</h3>
                                </div>
                                <p style="font-size: 14px; color: #4B5563; line-height: 1.5; margin: 0 0 16px 0;">
                                    Log in to your Visitor Portal to track this transaction and view condition reports.
                                </p>
                                <div style="text-align: center; margin: 16px 0;">
                                    <a href="${portalUrl}" style="background-color: #111827; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block; border: 1px solid #D4AF37; font-size: 14px;">Log In to Visitor Portal</a>
                                </div>
                            </div>
                        `;
                    }

                    try {
                        await sendEmail({
                            to: donorEmail,
                            subject: `Museum Acquisition Documents: ${intake.proposed_item_name}`,
                            html: `
                                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                                    <!-- Header -->
                                    <div style="background-color: #111827; padding: 32px 24px; text-align: center; border-bottom: 4px solid #D4AF37;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">MUSEO BULAWAN</h1>
                                        <p style="color: #9CA3AF; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Official Acquisition Communication</p>
                                    </div>
                                    
                                    <!-- Body -->
                                    <div style="padding: 32px 24px;">
                                        <p style="font-size: 16px; color: #374151; margin-top: 0; line-height: 1.5;">Hello <strong>${donorName}</strong>,</p>
                                        <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin-bottom: 24px;">
                                            An official <strong>${contractType.replace(/_/g, ' ')}</strong> has been generated for your artifact: <strong style="color: #111827;">${intake.proposed_item_name}</strong>.
                                            Please follow the steps below to complete the acquisition process.
                                        </p>

                                        <!-- STEP 1: Portal -->
                                        ${portalSection}

                                        <!-- STEP 2: Physical Delivery -->
                                        <div style="border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 24px; background-color: #FAFAFA;">
                                            <div style="margin-bottom: 12px;">
                                                <span style="background-color: #D4AF37; color: #111827; font-weight: 700; font-size: 14px; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; display: inline-block; margin-right: 10px;">2</span>
                                                <h3 style="color: #111827; font-size: 16px; font-weight: 700; margin: 0; display: inline-block; vertical-align: middle;">Physical Handover Verification</h3>
                                            </div>
                                            <p style="font-size: 14px; color: #4B5563; line-height: 1.5; margin: 0 0 16px 0;">
                                                To finalize the acquisition, please deliver the artifact to the museum. Present either the QR code or the text token below to the receiving officer, who will verify receipt.
                                            </p>
                                            
                                            <div style="background-color: #ffffff; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; text-align: center; margin: 16px 0;">
                                                <!-- QR Code Image -->
                                                <div style="margin-bottom: 16px;">
                                                    <img src="${qrImageBase64}" width="200" height="200" alt="Verification QR Code" style="display: block; margin: 0 auto; border: 1px solid #F3F4F6;" />
                                                </div>
                                                
                                                <!-- Code text -->
                                                <div style="font-family: monospace; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: 6px; border: 2px dashed #D4AF37; display: inline-block; padding: 8px 16px; background-color: #FFFDF5; border-radius: 6px; text-transform: uppercase;">
                                                    ${rawToken}
                                                </div>
                                                
                                                <p style="font-size: 12px; color: #6B7280; margin: 12px 0 0 0;">
                                                    <strong>Delivery Slip ID:</strong> <span style="font-family: monospace; font-weight: 600;">${deliverySlipId}</span>
                                                </p>
                                                <p style="font-size: 11px; color: #9CA3AF; margin: 4px 0 0 0;">
                                                    Expires on ${new Date(tokenExpires).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        <!-- STEP 3: Legal Agreement -->
                                        <div style="border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; background-color: #FAFAFA;">
                                            <div style="margin-bottom: 12px;">
                                                <span style="background-color: #D4AF37; color: #111827; font-weight: 700; font-size: 14px; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; display: inline-block; margin-right: 10px;">3</span>
                                                <h3 style="color: #111827; font-size: 16px; font-weight: 700; margin: 0; display: inline-block; vertical-align: middle;">Review Legal Agreement</h3>
                                            </div>
                                            <p style="font-size: 14px; color: #4B5563; line-height: 1.5; margin: 0 0 16px 0;">
                                                A preview of the generated legal agreement is shown below for your records. The official signed document will be finalized in person upon delivery.
                                            </p>
                                            
                                            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; font-family: 'Courier New', Courier, monospace; font-size: 12px; border: 1px solid #E5E7EB; max-height: 250px; overflow-y: auto; color: #374151; line-height: 1.4; text-align: left;">
                                                ${moaDraft}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Footer -->
                                    <div style="background-color: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                                        <p style="font-size: 11px; color: #9CA3AF; margin: 0;">
                                            This is an automated communication from the Museo Bulawan Collections Management System.
                                        </p>
                                    </div>
                                </div>
                            `
                        });
                    } catch (emailErr) {
                        logger.error(`Non-blocking error sending MOA email: ${emailErr.message}`);
                    }
                }

                return {
                    message: "MOA and Delivery Slip generated. Email sent to donor.",
                    deliverySlipId,
                    contractType,
                    moaDraft,
                    docxData: docxBase64,
                    qrPayload: { type: "delivery_confirmation", intakeId, token: rawToken },
                    qrImageBase64,
                    intake: updatedIntake,
                    visitorAccount: accountDetails ? {
                        isNew: accountDetails.isNew,
                        setupUrl: visitorSetupUrl,
                        userId: accountDetails.userId
                    } : null
                };
            } catch (error) {
                logger.error(`Error generating MOA: ${error.message}`);
                throw error;
            }
        });
    },

    async exportMOA(intakeId) {
        const intake = await baseService._getRecord('intakes', intakeId, { expand: 'donor_account_id,donation_item_id' });
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

                // Artifact is now physically in the museum — set Receiving Bay as the initial location.
                // This is the first point at which a donation artifact has a real physical location.
                const updated = await baseService._updateRecord(staffId, 'intakes', intakeId, {
                    status: 'in_custody',
                    current_location: 'Receiving Bay',
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
    },

    async updateIntakeLocation(staffId, intakeId, location) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            const intake = await baseService._getRecord('intakes', intakeId);
            return await baseService._updateRecord(staffId, 'intakes', intakeId, {
                current_location: location
            });
        });
    },

    async listVisitorDonations(donorUserId) {
        const rows = await db.query(`
            SELECT 
                i.id as intake_id,
                i.proposed_item_name as item_name,
                i.status as intake_status,
                i.moa_status as intake_moa_status,
                i.acquisition_method,
                i.delivery_slip_id,
                i.qr_token,
                i.qr_token_expires,
                i.current_location as intake_location,
                i.created_at as date_logged,
                
                a.id as accession_id,
                a.accession_number,
                a.status as accession_status,
                a.created_at as accession_date,
                
                inv.id as inventory_id,
                inv.catalog_number,
                inv.current_location as inventory_location,
                inv.status as inventory_status,
                
                exh.id as exhibition_id,
                exh.title as exhibition_title,
                exh.venue as exhibition_venue,
                exh.status as exhibition_status
            FROM intakes i
            LEFT JOIN accessions a ON a.intake_id = i.id
            LEFT JOIN inventory inv ON inv.accession_id = a.id
            LEFT JOIN exhibition_artifacts ea ON ea.inventory_id = inv.id
            LEFT JOIN exhibitions exh ON ea.exhibition_id = exh.id AND exh.status = 'active'
            WHERE i.donor_account_id = ?
            ORDER BY i.created_at DESC
        `, [donorUserId]);

        return rows.map(row => {
            let stage = 'intake';
            let stageDescription = 'Awaiting review and processing';

            if (row.exhibition_id && row.exhibition_status === 'active') {
                stage = 'on_display';
                stageDescription = `On display at ${row.exhibition_venue} (${row.exhibition_title})`;
            } else if (row.inventory_id) {
                stage = 'inventory';
                stageDescription = `Cataloged and stored in ${row.inventory_location || 'Storage'}`;
            } else if (row.accession_id) {
                stage = 'accession';
                stageDescription = `Formally accessioned into the collection (Acc No: ${row.accession_number})`;
            } else if (row.intake_status === 'in_custody') {
                stage = 'receive_artifact';
                stageDescription = 'Physically received by the museum';
            } else if (row.intake_status === 'awaiting_delivery') {
                stage = 'intake';
                stageDescription = 'Awaiting physical delivery at the museum';
            } else if (row.intake_status === 'approved') {
                stage = 'intake';
                stageDescription = 'Acquisition approved, generating paperwork';
            } else if (row.intake_status === 'rejected') {
                stage = 'intake';
                stageDescription = 'Offer declined';
            }

            return {
                id: row.intake_id,
                itemName: row.item_name,
                method: row.acquisition_method,
                dateLogged: row.date_logged,
                deliverySlipId: row.delivery_slip_id,
                qrToken: row.qr_token,
                qrTokenExpires: row.qr_token_expires,
                location: row.inventory_location || row.intake_location || null,
                stage,
                stageDescription,
                intakeStatus: row.intake_status,
                accessionNumber: row.accession_number,
                catalogNumber: row.catalog_number,
                exhibitionTitle: row.exhibition_title,
                exhibitionVenue: row.exhibition_venue
            };
        });
    }
};