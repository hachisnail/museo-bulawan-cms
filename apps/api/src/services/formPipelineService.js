import crypto from 'crypto';
import { pbService } from './pocketbaseService.js';
import { acquisitionService } from './acquisitionService.js';
import { userService } from './userService.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';
import { assertTransition } from '../utils/stateMachine.js';
import { globalMutex } from '../utils/mutex.js';
import { sendEmail } from '../utils/mailer.js';
import { env } from '../config/env.js';

/**
 * FormPipelineService
 * 
 * Handles high-level orchestration of form-driven workflows.
 * Segregates "pipeline" automation from core domain business logic.
 */
export const formPipelineService = {
    
    _genId() {
        return crypto.randomBytes(8).toString('hex').substring(0, 15);
    },

    // ==========================================
    // PHASE 1A: Process External Form → Intake(s)
    // ==========================================
    async processExternalIntake(staffId, submissionId) {
        return await globalMutex.runExclusive(`sub_${submissionId}`, async () => {
            try {
                const submission = await pbService.pb.collection('form_submissions').getOne(submissionId, { expand: 'form_id' });
                
                // Safeguard: Only allow processing if the form is of type 'donation'
                const definition = submission.expand?.form_id;
                if (!definition || definition.type !== 'donation') {
                    throw new Error('UNAUTHORIZED_PIPELINE_ACTION: Only donation submissions can be processed into the acquisition system.');
                }

                assertTransition('submission', submission.status, 'processed');

                const mapping = definition.settings?.field_mapping || {};

                // Extract donor info with robust fallbacks
                const firstName = submission.data[mapping.firstName] || submission.data.firstName || submission.data.first_name || 'Anonymous';
                const lastName = submission.data[mapping.lastName] || submission.data.lastName || submission.data.last_name || '';
                const donorName = (submission.data[mapping.donorName] || submission.data.donor_name || submission.data.full_name || `${firstName} ${lastName}`).trim();
                const donorEmail = submission.data[mapping.donorEmail] || submission.data.donorEmail || submission.data.email || submission.data.donor_email;
                const acquisitionMethod = submission.data[mapping.acquisitionType] || submission.data.acquisition_type || submission.data.method || 'gift';

                // Extra donor info
                const donorTitle = submission.data.donor_title || '';
                const donorPhone = submission.data.donor_phone || '';
                const donorAddress = submission.data.donor_address || '';

                // Provision donor account
                let donorAccountId = null;
                if (donorEmail) {
                    const accountDetails = await this._provisionDonorAccount(donorEmail, donorName, {
                        title: donorTitle,
                        phone: donorPhone,
                        address: donorAddress
                    });
                    if (accountDetails) {
                        donorAccountId = accountDetails.userId;
                        const portalUrl = env.frontendUrl ? `${env.frontendUrl}/portal-visitor` : 'http://localhost:5173/portal-visitor';

                        if (accountDetails.isNew) {
                            await sendEmail({
                                to: donorEmail,
                                subject: "Donation Accepted - Track Your Artifact",
                                html: `
                                    <h2>Thank you, ${donorName}!</h2>
                                    <p>Your proposed donation has passed our initial screening and is now in formal review.</p>
                                    <p>We have created a secure Visitor Portal account for you.</p>
                                    <hr/>
                                    <p><strong>Portal Login:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
                                    <p><strong>Username:</strong> ${accountDetails.username}</p>
                                    <p><strong>Temporary Password:</strong> ${accountDetails.password}</p>
                                    <p><em>Please log in and change your password as soon as possible.</em></p>
                                `
                            });
                        } else {
                            await sendEmail({
                                to: donorEmail,
                                subject: "Donation Update - Items Accepted for Review",
                                html: `
                                    <h2>Hello again, ${donorName}!</h2>
                                    <p>Your new donation has passed our initial screening.</p>
                                    <p>Track progress in your Visitor Portal: <a href="${portalUrl}">${portalUrl}</a></p>
                                `
                            });
                        }
                    }
                }

                // Decompose submission into individual donation_items
                const donationItems = await this._decomposeSubmissionItems(submissionId, submission.data, mapping);

                // Create one intake per donation_item
                const intakes = [];
                for (const item of donationItems) {
                    // Use acquisitionService internal record creation or exposed methods
                    // We call _createRecord via acquisitionService if it's exported, but it's not.
                    // However, we can use the exposed createIntake logic or similar.
                    // For now, we call the PB collection directly as this is "pipeline" orchestration.
                    const intake = await pbService.pb.collection('intakes').create({
                        id: this._genId(),
                        submission_id: submission.id,
                        donation_item_id: item.id,
                        donor_account_id: donorAccountId, 
                        proposed_item_name: item.item_name,
                        donor_info: donorName,
                        acquisition_method: acquisitionMethod.toLowerCase(),
                        status: 'under_review',
                        moa_status: 'pending'
                    });

                    // Mark donation_item as accepted
                    await pbService.pb.collection('donation_items').update(item.id, { status: 'accepted' });
                    intakes.push(intake);
                }

                // Mark submission as processed
                await pbService.pb.collection('form_submissions').update(submissionId, { status: 'processed' });
                
                notificationService.sendToRole('admin', 'New Intake Created', 
                    `External submission processed into ${intakes.length} intake(s).`);
                
                return { intakes, donationItems };
            } catch (error) {
                logger.error(`Error processing external intake: ${error.message}`);
                throw error;
            }
        });
    },

    /**
     * Processes an Artifact Health Form submission.
     */
    async processHealthReportForm(staffId, submissionId, files = null) {
        try {
            const submission = await pbService.pb.collection('form_submissions').getOne(submissionId);
            const { artifact_id, condition, detailed_notes, reporter } = submission.data;

            if (!artifact_id) throw new Error('MISSING_ARTIFACT_ID');

            // Automate reporter name if not provided (prioritize logged-in user)
            let reporterName = reporter;
            if (!reporterName || reporterName.trim() === '') {
                const pbUserId = await pbService.getAppUserId(staffId);
                if (pbUserId) {
                    const user = await pbService.pb.collection('app_users').getOne(pbUserId);
                    reporterName = user.name;
                }
            }

            const report = await acquisitionService.createConditionReport(staffId, 'inventory', artifact_id, condition, 
                detailed_notes, submissionId, reporterName || 'System');

            // If there were attachments in the submission, attach them to the condition report as well
            if (files && files.length > 0) {
                await pbService.uploadToField('condition_reports', report.id, 'attachments', files);
            }

            await pbService.pb.collection('form_submissions').update(submissionId, { status: 'processed' });
            return report;
        } catch (error) {
            logger.error(`Error in processHealthReportForm: ${error.message}`, { data: error.data });
            throw error;
        }
    },

    /**
     * Processes an Artifact Movement Trail Form submission.
     */
    async processMovementTrailForm(staffId, submissionId, files = null) {
        try {
            const submission = await pbService.pb.collection('form_submissions').getOne(submissionId);
            const { artifact_id, to_location, reason, moved_by } = submission.data;

            if (!artifact_id) throw new Error('MISSING_ARTIFACT_ID');

            const result = await acquisitionService.transferLocation(staffId, artifact_id, to_location, 
                `${reason}\n\nMoved by: ${moved_by || 'Unknown'}`, submissionId);

            await pbService.pb.collection('form_submissions').update(submissionId, { status: 'processed' });
            return result;
        } catch (error) {
            logger.error(`Error in processMovementTrailForm: ${error.message}`, { data: error.data });
            throw error;
        }
    },

    // ==========================================
    // HELPERS (Moved from AcquisitionService)
    // ==========================================

    async _provisionDonorAccount(email, name, extras = {}) {
        try {
            const existingUser = await pbService.pb.collection('app_users')
                .getFirstListItem(`email="${email}"`)
                .catch(() => null); 

            if (existingUser) {
                return { userId: existingUser.id, isNew: false, password: null };
            }

            const [fname, ...rest] = (name || 'Valued Donor').split(' ');
            const lname = rest.join(' ') || '';
            
            const { userId, tempPassword, username } = await userService.provisionDonor({ fname, lname, email, ...extras });
            const pbUserId = await pbService.getAppUserId(userId);

            return { userId: pbUserId, isNew: true, password: tempPassword, username };
        } catch (error) {
            logger.error(`Error provisioning donor account: ${error.message}`);
            return null; 
        }
    },

    async _decomposeSubmissionItems(submissionId, submissionData, mapping) {
        const items = [];
        const itemsKey = mapping.items || 'items';
        const rawItems = submissionData[itemsKey];

        if (Array.isArray(rawItems) && rawItems.length > 0) {
            for (const raw of rawItems) {
                const itemName = raw[mapping.itemName] || raw.item_name || raw.itemName || raw.name || (raw.item_description ? raw.item_description.substring(0, 50) : 'Unnamed Item');
                const description = raw[mapping.description] || raw.item_description || raw.description || '';
                const quantity = raw.quantity || 1;

                const record = await pbService.pb.collection('donation_items').create({
                    id: this._genId(),
                    submission_id: submissionId,
                    item_name: itemName,
                    description: description,
                    quantity: quantity,
                    status: 'pending'
                });
                items.push(record);
            }
        } else {
            const itemName = submissionData[mapping.itemName] || submissionData.item_name || submissionData.itemName || submissionData.title || (submissionData.item_description ? submissionData.item_description.substring(0, 50) : 'Unknown Item');
            const description = submissionData[mapping.description] || submissionData.item_description || submissionData.description || '';

            const record = await pbService.pb.collection('donation_items').create({
                id: this._genId(),
                submission_id: submissionId,
                item_name: itemName,
                description: description,
                quantity: 1,
                status: 'pending'
            });
            items.push(record);
        }

        return items;
    }
};
