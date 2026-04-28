import crypto from 'crypto';
import { pbService } from './pocketbaseService.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../utils/mailer.js'; // <-- FIXED: Import sendEmail instead of mailer
import { env } from '../config/env.js';

export const acquisitionService = {

    /**
     * HELPER: Auto-provisions a Donor Portal account if one doesn't exist
     */
    async _provisionDonorAccount(email, name) {
        try {
            // 1. Check if user already exists
            const existingUser = await pbService.pb.collection('users')
                .getFirstListItem(`email="${email}"`)
                .catch(() => null); // Catch 404 if not found

            if (existingUser) {
                return { userId: existingUser.id, isNew: false, password: null };
            }

            // 2. Generate a secure temporary password
            const tempPassword = crypto.randomBytes(6).toString('hex'); // e.g. "a1b2c3d4e5f6"

            // 3. Create the new user in PocketBase
            const newUser = await pbService.pb.collection('users').create({
                email: email,
                password: tempPassword,
                passwordConfirm: tempPassword,
                name: name || 'Valued Donor',
                role: 'visitor', 
                emailVisibility: true,
                verified: true 
            });

            return { userId: newUser.id, isNew: true, password: tempPassword };
        } catch (error) {
            logger.error(`Error provisioning donor account: ${error.message}`);
            return null; 
        }
    },

    /**
     * PHASE 1A: Process External Form Submission into an Intake
     */
    async processExternalIntake(submissionId, extractedData) {
        try {
            const submission = await pbService.pb.collection('form_submissions').getOne(submissionId);
            if (submission.status !== 'pending') {
                throw new Error('Submission has already been processed.');
            }

            // Extract data securely, falling back to the raw form data
            const itemName = extractedData.itemName || submission.data.itemName || 'Unknown Item';
            
            // Re-combine first and last name if they were split in the form
            const firstName = extractedData.firstName || submission.data.firstName || 'Anonymous';
            const lastName = extractedData.lastName || submission.data.lastName || '';
            const donorName = `${firstName} ${lastName}`.trim();
            
            const donorEmail = extractedData.donorEmail || submission.data.donorEmail;
            
            let donorAccountId = null;

            if (donorEmail) {
                const accountDetails = await this._provisionDonorAccount(donorEmail, donorName);
                
                if (accountDetails) {
                    donorAccountId = accountDetails.userId;
                    const portalUrl = env.frontendUrl ? `${env.frontendUrl}/portal-visitor` : 'http://localhost:5173/portal-visitor';

                    if (accountDetails.isNew) {
                        // <-- FIXED: Use sendEmail() instead of mailer.sendMail()
                        await sendEmail({
                            to: donorEmail,
                            subject: "Donation Accepted - Track Your Artifact",
                            html: `
                                <h2>Thank you, ${donorName}!</h2>
                                <p>Your proposed donation of <strong>${itemName}</strong> has passed our initial screening and is now in formal review.</p>
                                <p>We have created a secure Visitor Portal account for you to track the current status of your artifact and view past contributions.</p>
                                <hr/>
                                <p><strong>Portal Login:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
                                <p><strong>Email:</strong> ${donorEmail}</p>
                                <p><strong>Temporary Password:</strong> ${accountDetails.password}</p>
                                <p><em>Please log in and change your password as soon as possible.</em></p>
                            `
                        });
                        logger.info(`Provisioned new account and sent credentials to ${donorEmail}`);
                    } else {
                        // <-- FIXED: Use sendEmail() instead of mailer.sendMail()
                        await sendEmail({
                            to: donorEmail,
                            subject: "Donation Update - Artifact Accepted",
                            html: `
                                <h2>Hello again, ${donorName}!</h2>
                                <p>Great news! Your new donation of <strong>${itemName}</strong> has passed our initial screening.</p>
                                <p>You can track its progress immediately in your Visitor Portal: <br/>
                                <a href="${portalUrl}">${portalUrl}</a></p>
                            `
                        });
                        logger.info(`Sent acceptance update to existing donor ${donorEmail}`);
                    }
                }
            }

            const intake = await pbService.pb.collection('intakes').create({
                submission_id: submission.id,
                donor_account_id: donorAccountId, 
                proposed_item_name: itemName,
                donor_info: donorName,
                acquisition_method: extractedData.method || submission.data.method || 'gift',
                loan_end_date: extractedData.loanEndDate || null,
                status: 'under_review',
                moa_status: 'pending'
            });

            await pbService.pb.collection('form_submissions').update(submissionId, { status: 'processed' });
            
            notificationService.sendToRole('admin', 'New Intake Created', `External submission moved to intake: ${intake.proposed_item_name}`);
            return intake;
        } catch (error) {
            logger.error(`Error processing external intake: ${error.message}`);
            throw error;
        }
    },

    /**
     * PHASE 1B: Create Internal Intake
     */
    async createInternalIntake(staffId, itemDetails, method, loanEndDate = null) {
        try {
            const intake = await pbService.pb.collection('intakes').create({
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
    },

    /**
     * PHASE 2: Generate the Memorandum of Agreement (MOA) and Delivery Slip
     */
    async generateDynamicMOA(intakeId, overrides = {}) {
        try {
            const intake = await pbService.pb.collection('intakes').getOne(intakeId);

            const finalDonorName = overrides.donorName || intake.donor_info;
            let finalLoanDuration = 'N/A (Permanent Transfer)';
            
            if (intake.acquisition_method === 'loan') {
                finalLoanDuration = overrides.loanDuration || (intake.loan_end_date ? `Until ${intake.loan_end_date}` : 'Standard 6 Months');
            }

            let contractType = '';
            let moaTemplate = '';

            switch (intake.acquisition_method) {
                case 'gift':
                    contractType = 'deed_of_gift';
                    moaTemplate = `MOA - DEED OF GIFT\nDonor: ${finalDonorName}\nTerms: Permanent transfer of ownership...`;
                    break;
                case 'loan':
                    contractType = 'loan_agreement';
                    moaTemplate = `MOA - INCOMING LOAN AGREEMENT\nLender: ${finalDonorName}\nDuration: ${finalLoanDuration}\nTerms: Temporary custody...`;
                    break;
                case 'purchase':
                    contractType = 'bill_of_sale';
                    moaTemplate = `MOA - BILL OF SALE\nVendor: ${finalDonorName}\nTerms: Transfer of title via purchase...`;
                    break;
                case 'existing':
                    contractType = 'internal_memo';
                    moaTemplate = `INTERNAL REGISTRATION MEMO\nOrigin: Found in Collection / Existing Backlog...`;
                    break;
                default:
                    throw new Error('Unknown acquisition method.');
            }

            const deliverySlipId = `DS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

            const updatedIntake = await pbService.pb.collection('intakes').update(intakeId, {
                donor_name_override: finalDonorName,
                loan_duration_override: finalLoanDuration !== 'N/A (Permanent Transfer)' ? finalLoanDuration : null,
                delivery_slip_id: deliverySlipId,
                moa_status: 'generated',
                status: 'awaiting_delivery'
            });

            return {
                message: "MOA and Delivery Slip generated.",
                deliverySlipId: deliverySlipId,
                contractType: contractType,
                moaDraft: moaTemplate,
                intake: updatedIntake
            };

        } catch (error) {
            logger.error(`Error generating MOA: ${error.message}`);
            throw error;
        }
    },

    /**
     * PHASE 3A: Confirm Physical Delivery
     */
    async confirmPhysicalDelivery(intakeId, submittedSlipId) {
        try {
            const intake = await pbService.pb.collection('intakes').getOne(intakeId);

            if (intake.delivery_slip_id !== submittedSlipId) {
                throw new Error('Invalid Delivery Slip ID.');
            }

            return await pbService.pb.collection('intakes').update(intakeId, {
                status: 'accessioned' 
            });
        } catch (error) {
            logger.error(`Error confirming delivery: ${error.message}`);
            throw error;
        }
    },

    /**
     * PHASE 3B: Initial Formal Accessioning
     */
    async processAccession(intakeId, accessionData) {
        try {
            const intake = await pbService.pb.collection('intakes').getOne(intakeId);

            const methodToContractMap = {
                'gift': 'deed_of_gift',
                'loan': 'loan_agreement',
                'purchase': 'bill_of_sale',
                'existing': 'internal_memo'
            };

            const accession = await pbService.pb.collection('accessions').create({
                intake_id: intake.id,
                accession_number: accessionData.accessionNumber,
                contract_type: methodToContractMap[intake.acquisition_method],
                legal_status: intake.acquisition_method === 'loan' ? 'Temporary Custody' : 'Museum Property',
                
                initial_condition_report: accessionData.conditionReport || '',
                handling_instructions: accessionData.handlingInstructions || '',
                dimensions: '',
                materials: '',
                research_notes: '',
                
                status: 'in_research' 
            });

            await pbService.pb.collection('intakes').update(intakeId, { 
                moa_status: accessionData.isMoaSigned ? 'signed' : intake.moa_status,
                status: 'accessioned'
            });

            return accession;
        } catch (error) {
            logger.error(`Error processing accession: ${error.message}`);
            throw error;
        }
    },

    /**
     * PHASE 3C: Incremental Research Updates
     */
    async updateAccessionResearch(accessionId, researchData) {
        try {
            const updatedAccession = await pbService.pb.collection('accessions').update(accessionId, researchData);
            return updatedAccession;
        } catch (error) {
            logger.error(`Error updating research: ${error.message}`);
            throw error;
        }
    },

    /**
     * PHASE 4: Strict Finalization to Active Inventory
     */
    async finalizeToInventory(accessionId, inventoryData) {
        try {
            const accession = await pbService.pb.collection('accessions').getOne(accessionId);

            const missingFields = [];
            if (!accession.dimensions) missingFields.push('Dimensions');
            if (!accession.materials) missingFields.push('Materials');
            if (!accession.initial_condition_report) missingFields.push('Condition Report');
            if (!accession.historical_significance) missingFields.push('Historical Significance');

            if (missingFields.length > 0) {
                throw new Error(`Cannot finalize to inventory. Missing required research fields: ${missingFields.join(', ')}`);
            }

            const inventory = await pbService.pb.collection('inventory').create({
                accession_id: accession.id,
                catalog_number: inventoryData.catalogNumber,
                current_location: inventoryData.location || 'Receiving Bay',
                condition_report: accession.initial_condition_report 
            });

            await pbService.pb.collection('accessions').update(accessionId, { status: 'finalized' });

            notificationService.sendGlobal('New Artifact Cataloged', `Item ${inventoryData.catalogNumber} has been moved to ${inventory.current_location}.`);
            return inventory;

        } catch (error) {
            logger.error(`Error finalizing to inventory: ${error.message}`);
            throw error; 
        }
    }
};