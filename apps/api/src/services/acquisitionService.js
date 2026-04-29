import crypto from 'crypto';
import { pbService } from './pocketbaseService.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../utils/mailer.js'; 
import { env } from '../config/env.js';
import { auditService } from './auditService.js';
import { globalMutex } from '../utils/mutex.js';
import { userService } from './userService.js';
import { assertTransition, getValidTransitions } from '../utils/stateMachine.js';
import { generateAccessionNumber, generateCatalogNumber } from '../utils/sequenceGenerator.js';

export const acquisitionService = {
    
    _genId() {
        return crypto.randomBytes(8).toString('hex').substring(0, 15);
    },

    async getInventoryItem(inventoryId, query = {}) {
        return await this._getRecord('inventory', inventoryId, query);
    },

    async getAccessionItem(accessionId, query = {}) {
        return await this._getRecord('accessions', accessionId, query);
    },

    async getFullChain(intakeId) {
        return await pbService.pb.collection('intakes').getOne(intakeId, {
            expand: 'donation_item_id,submission_id'
        });
    },

    // ==========================================
    // DB HELPERS (Audit + Versioning)
    // ==========================================
    async _listRecords(collection, query = {}) {
        const page = query.page || 1;
        const perPage = query.perPage || 50;
        const options = {};
        if (query.filter) options.filter = query.filter;
        if (query.sort) options.sort = query.sort;
        if (query.expand) options.expand = query.expand;
        return await pbService.pb.collection(collection).getList(page, perPage, options);
    },

    async _getRecord(collection, id, query = {}) {
        const options = {};
        if (query.expand) options.expand = query.expand;
        return await pbService.pb.collection(collection).getOne(id, options);
    },

    async _createRecord(userId, collection, data) {
        let pbUserId = await pbService.getAppUserId(userId);
        
        // Resilience: If the user isn't synced to PB yet, sync them now
        if (!pbUserId) {
            logger.info(`Resyncing user ${userId} to PocketBase for record creation...`);
            const user = await userService.getUserById(userId);
            if (user) {
                await pbService.syncUser(user);
                pbUserId = await pbService.getAppUserId(userId);
            }
        }

        if (!pbUserId) {
            // Fallback: Try to find any active admin/staff to act as the actor
            try {
                const adminUser = await pbService.pb.collection('app_users').getFirstListItem('role="admin"');
                pbUserId = adminUser.id;
                logger.info(`Using fallback admin ${pbUserId} for creation by ${userId}`);
            } catch (fallbackError) {
                logger.warn(`No fallback admin found for creation by ${userId}. Aborting.`);
                throw new Error(`FAILED_PB_SYNC: User ${userId} could not be mapped to a PocketBase ID. Creation aborted.`);
            }
        }

        const record = await pbService.pb.collection(collection).create({
            id: this._genId(),
            ...data,
            version: 1,
            created_by: pbUserId,
            updated_by: pbUserId
        });

        await auditService.log({
            collection,
            recordId: record.id,
            action: 'create',
            userId: userId,
            before: null,
            after: record
        });
        return record;
    },

    async _updateRecord(userId, collection, id, data) {
        try {
            const existing = await pbService.pb.collection(collection).getOne(id);
            let pbUserId = await pbService.getAppUserId(userId);
            
            if (!pbUserId) {
                try {
                    const adminUser = await pbService.pb.collection('app_users').getFirstListItem('role="admin"');
                    pbUserId = adminUser.id;
                } catch (e) {
                    // If no admin, proceed with null (PocketBase might allow it depending on rules)
                }
            }

            const updated = await pbService.pb.collection(collection).update(id, {
                ...data,
                version: (existing.version || 0) + 1,
                updated_by: pbUserId
            });

            await auditService.log({
                collection,
                recordId: id,
                action: 'update',
                userId: userId,
                before: existing,
                after: updated
            });
            return updated;
        } catch (error) {
            logger.error(`Error in _updateRecord for ${collection}/${id}: ${error.message}`, { data: error.data });
            throw error;
        }
    },

    /**
     * State-guarded update — validates transition before writing.
     */
    async _transitionRecord(userId, entityType, collection, id, targetStatus, extraData = {}) {
        const existing = await pbService.pb.collection(collection).getOne(id);
        assertTransition(entityType, existing.status, targetStatus);
        return await this._updateRecord(userId, collection, id, { 
            ...extraData, 
            status: targetStatus 
        });
    },



    // ==========================================
    // CONDITION REPORTS (shared, versioned)
    // ==========================================
    async createConditionReport(userId, entityType, entityId, condition, notes = '', submissionId = null, reporterName = '') {
        let pbUserId = await pbService.getAppUserId(userId);
        
        // Use same fallback logic as _createRecord if needed
        if (!pbUserId) {
            const adminUser = await pbService.pb.collection('app_users').getFirstListItem('role="admin"');
            pbUserId = adminUser.id;
        }

        const record = await this._createRecord(userId, 'condition_reports', {
            entity_type: entityType,
            entity_id: entityId,
            condition: condition,
            notes: notes,
            submission_id: submissionId,
            reported_by: pbUserId,
            reporter_name: reporterName
        });

        if (entityType === 'inventory') {
            // Trigger status re-derivation (non-blocking)
            this.autoDeriveArtifactStatus(userId, entityId).catch(err => 
                logger.error(`Auto-derivation failed for ${entityId}: ${err.message}`)
            );
        }

        return record;
    },


    async getConditionReports(entityType, entityId) {
        return await this._listRecords('condition_reports', {
            filter: `entity_type="${entityType}" && entity_id="${entityId}"`,
            sort: '-created',
            expand: 'submission_id'
        });
    },


    // ==========================================
    // PHASE 1A: Register External Intake (Called by Pipeline)
    // ==========================================
    async registerExternalIntake(staffId, submissionId, donorAccountId, donorName, acquisitionMethod, itemDetails) {
        return await globalMutex.runExclusive(`external_intake_${submissionId}_${itemDetails.itemName}`, async () => {
            // 1. Create the donation item using the unified _createRecord (gets audited automatically)
            const donationItem = await this._createRecord(staffId, 'donation_items', {
                submission_id: submissionId,
                item_name: itemDetails.itemName,
                description: itemDetails.description,
                quantity: itemDetails.quantity,
                status: 'accepted'
            });

            // 2. Create the intake using the unified _createRecord
            const intake = await this._createRecord(staffId, 'intakes', {
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
    // PHASE 1B: Create Internal Intake (Item Decomposition - Step 27)
    // ==========================================
    async createInternalIntake(staffId, itemDetails, method, loanEndDate = null) {
        return await globalMutex.runExclusive(`internal_intake_${staffId}`, async () => {
        try {
            // First create a donation_item (submission_id is optional for internal)
            const donationItem = await pbService.pb.collection('donation_items').create({
                id: this._genId(),
                item_name: itemDetails.itemName,
                description: itemDetails.description || 'Internal Intake Item',
                quantity: itemDetails.quantity || 1,
                status: 'accepted' // Pre-accepted since it's internal
            });

            // Then create the intake linking to the donation_item
            const intake = await this._createRecord(staffId, 'intakes', {
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
            return await this._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'approved');
        });
    },

    // ==========================================
    // PHASE 1D: Reject Intake
    // ==========================================
    async rejectIntake(staffId, intakeId, reason) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            const intake = await pbService.pb.collection('intakes').getOne(intakeId);
            
            // Sync with donation_item if it exists
            if (intake.donation_item_id) {
                await pbService.pb.collection('donation_items').update(intake.donation_item_id, { status: 'rejected' });
            }

            return await this._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'rejected', {
                rejection_reason: reason
            });
        });
    },

    // ==========================================
    // PHASE 1E: Reopen Rejected Intake
    // ==========================================
    async reopenIntake(staffId, intakeId) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            const intake = await pbService.pb.collection('intakes').getOne(intakeId);

            // Sync with donation_item if it exists
            if (intake.donation_item_id) {
                await pbService.pb.collection('donation_items').update(intake.donation_item_id, { status: 'accepted' });
            }

            return await this._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'under_review', {
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
            const intake = await pbService.pb.collection('intakes').getOne(intakeId, { expand: 'donor_account_id' });
            // Must be approved before MOA generation
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

            const moaTemplates = {
                'deed_of_gift': `MOA - DEED OF GIFT\nDonor: ${finalDonorName}\nTerms: Permanent transfer of ownership of the object to the museum collection.`,
                'loan_agreement': `MOA - INCOMING LOAN AGREEMENT\nLender: ${finalDonorName}\nDuration: ${finalLoanDuration}\nTerms: Temporary custody for exhibition or research purposes.`,
                'bill_of_sale': `MOA - BILL OF SALE\nVendor: ${finalDonorName}\nTerms: Transfer of title via purchase and full payment.`,
                'internal_memo': `INTERNAL REGISTRATION MEMO\nOrigin: Found in Collection / Existing Backlog. Documentation for internal audit.`
            };

            const deliverySlipId = `DS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            
            // Use a shorter, human-readable token for typing
            const rawToken = crypto.randomBytes(4).toString('hex').toUpperCase(); 
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            logger.info(`Generated Delivery Token for Intake ${intakeId}: ${rawToken}`);

            const updatedIntake = await this._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'awaiting_delivery', {
                donor_name_override: finalDonorName,
                loan_duration_override: finalLoanDuration !== 'N/A (Permanent Transfer)' ? finalLoanDuration : null,
                delivery_slip_id: deliverySlipId,
                moa_status: 'generated',
                qr_token_hash: tokenHash,
                qr_token_expires: tokenExpires
            });

            // Send Email to Donor
            const donorEmail = intake.expand?.donor_account_id?.email || '';
            if (donorEmail) {
                const shortToken = rawToken; // Now it's already short
                await sendEmail({
                    to: donorEmail,
                    subject: `Museum Acquisition Documents: ${intake.proposed_item_name}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 12px;">
                            <h2 style="color: #4f46e5;">Museum Acquisition Documents</h2>
                            <p>Hello ${finalDonorName},</p>
                            <p>An official <strong>${contractType.replace(/_/g, ' ')}</strong> has been generated for your artifact: <strong>${intake.proposed_item_name}</strong>.</p>
                            
                            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 13px; border: 1px solid #e5e7eb; margin: 20px 0;">
                                ${moaTemplates[contractType].replace(/\n/g, '<br/>')}
                            </div>

                            <h3 style="color: #111827;">Step 2: Physical Delivery</h3>
                            <p>To complete the intake, please deliver the artifact to the museum. During the handover, provide this verification token to the staff:</p>
                            
                            <div style="background: #eff6ff; padding: 24px; border-radius: 12px; font-size: 28px; text-align: center; font-weight: 800; color: #1d4ed8; letter-spacing: 4px; border: 2px dashed #3b82f6; margin: 20px 0;">
                                ${shortToken}
                            </div>
                            
                            <p style="font-size: 12px; color: #6b7280; text-align: center;">
                                <strong>Delivery Slip ID:</strong> ${deliverySlipId}<br/>
                                This token expires on ${new Date(tokenExpires).toLocaleDateString()}.
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"/>
                            <p style="font-size: 11px; color: #9ca3af; text-align: center;">
                                Museo Bulawan CMS - Official Acquisition Communication
                            </p>
                        </div>
                    `
                });
                logger.info(`MOA and delivery token sent to donor: ${donorEmail}`);
            }

            return {
                message: "MOA and Delivery Slip generated. Email sent to donor.",
                deliverySlipId,
                contractType,
                moaDraft: moaTemplates[contractType],
                qrPayload: { type: "delivery_confirmation", intakeId, token: rawToken },
                intake: updatedIntake
            };
        } catch (error) {
            logger.error(`Error generating MOA: ${error.message}`);
            throw error;
        }
        });
    },

    // ==========================================
    // PHASE 2B: Rollback AWAITING_DELIVERY → UNDER_REVIEW
    // ==========================================
    async rollbackToReview(staffId, intakeId) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            return await this._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'under_review', {
                delivery_slip_id: null,
                qr_token_hash: null,
                qr_token_expires: null,
                moa_status: 'pending'
            });
        });
    },

    // ==========================================
    // PHASE 2C: Verify Delivery Token (Query by Token)
    // ==========================================
    async verifyDeliveryToken(token) {
        const submittedHash = crypto.createHash('sha256').update(token.toUpperCase()).digest('hex');
        try {
            const intake = await pbService.pb.collection('intakes').getFirstListItem(`qr_token_hash="${submittedHash}"`, {
                expand: 'donor_account_id,donation_item_id'
            });

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
            const intake = await pbService.pb.collection('intakes').getOne(intakeId);
            assertTransition('intake', intake.status, 'in_custody');

            if (!intake.qr_token_hash || new Date() > new Date(intake.qr_token_expires)) {
                throw new Error('QR Token is missing or expired.');
            }

            const hash = crypto.createHash('sha256').update(submittedToken.toUpperCase()).digest('hex');
            if (hash !== intake.qr_token_hash) {
                throw new Error('Invalid QR Token.');
            }

            return await this._updateRecord(staffId, 'intakes', intakeId, {
                status: 'in_custody',
                qr_token_hash: null,
                qr_token_expires: null
            });
        } catch (error) {
            logger.error(`Error confirming delivery: ${error.message}`);
            throw error;
        }
        });
    },

    // ==========================================
    // PHASE 3B: Formal Accessioning (auto-numbered)
    // ==========================================
    async processAccession(staffId, intakeId, accessionData) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
        try {
            const intake = await pbService.pb.collection('intakes').getOne(intakeId);
            assertTransition('intake', intake.status, 'accessioned');

            // Hard guard: Check if accession already exists for this intake
            const existing = await pbService.pb.collection('accessions').getFirstListItem(`intake_id="${intakeId}"`).catch(() => null);
            if (existing) {
                throw new Error(`Accession record already exists for this intake (${existing.accession_number}).`);
            }

            const methodToContractMap = {
                'gift': 'deed_of_gift',
                'loan': 'loan_agreement',
                'purchase': 'bill_of_sale',
                'existing': 'internal_memo'
            };

            // Auto-generate accession number if not provided
            const accessionNumber = accessionData.accessionNumber || await generateAccessionNumber();

            const accession = await this._createRecord(staffId, 'accessions', {
                intake_id: intake.id,
                accession_number: accessionNumber,
                contract_type: methodToContractMap[intake.acquisition_method],
                legal_status: intake.acquisition_method === 'loan' ? 'Temporary Custody' : 'Museum Property',
                handling_instructions: accessionData.handlingInstructions || '',
                dimensions: '',
                materials: '',
                research_notes: '',
                status: 'pending_approval'
            });

            // Create initial condition report (referenced, not copied)
            if (accessionData.conditionReport) {
                await this.createConditionReport(staffId, 'accession', accession.id, accessionData.conditionReport);
            }

            await this._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'accessioned', {
                moa_status: accessionData.isMoaSigned ? 'signed' : intake.moa_status
            });

            return accession;
        } catch (error) {
            logger.error(`Error processing accession: ${error.message}`);
            throw error;
        }
        });
    },

    // ==========================================
    // PHASE 3.5: MOA Upload
    // ==========================================
    async uploadMOA(staffId, accessionId, files) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            try {
                const accession = await pbService.pb.collection('accessions').getOne(accessionId);
                // Can upload MOA anytime before it's finalized to inventory
                if (accession.status === 'finalized') {
                    throw new Error("Cannot upload MOA for a finalized accession.");
                }

                const updated = await pbService.uploadToField('accessions', accessionId, 'signed_moa', files);

                await auditService.log({
                    collection: 'accessions',
                    recordId: accessionId,
                    action: 'update',
                    userId: staffId,
                    before: accession,
                    after: updated
                });

                // Also update the intake to mark MOA as signed if not already
                if (updated.intake_id) {
                    const intake = await pbService.pb.collection('intakes').getOne(updated.intake_id);
                    if (intake.moa_status !== 'signed') {
                        await this._updateRecord(staffId, 'intakes', updated.intake_id, { moa_status: 'signed' });
                    }
                }

                return updated;
            } catch (error) {
                logger.error(`Error uploading MOA: ${error.message}`);
                throw error;
            }
        });
    },

    // ==========================================
    // PHASE 3C: Accession Approval
    // ==========================================
    async approveAccession(staffId, accessionId, notes = '', reporter = '', submissionId = null) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            let pbUserId = await pbService.getAppUserId(staffId);
            if (!pbUserId) {
                const user = await userService.getUserById(staffId);
                if (user) {
                    await pbService.syncUser(user);
                    pbUserId = await pbService.getAppUserId(staffId);
                }
            }
            if (!pbUserId) throw new Error("Staff user not found in PocketBase.");

            // Record the approval vote
            await pbService.pb.collection('accession_approvals').create({
                id: this._genId(),
                accession_id: accessionId,
                approved_by: pbUserId,
                decision: 'approved',
                notes: notes,
                reporter: reporter,
                submission_id: submissionId
            });

            // Transition to in_research
            return await this._transitionRecord(staffId, 'accession', 'accessions', accessionId, 'in_research');
        });
    },

    // ==========================================
    // PHASE 3D: Incremental Research Updates
    // ==========================================
    async updateAccessionResearch(staffId, accessionId, researchData) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            const accession = await pbService.pb.collection('accessions').getOne(accessionId);
            if (accession.status === 'finalized') {
                throw new Error("Cannot modify research data for a finalized accession record.");
            }
            return await this._updateRecord(staffId, 'accessions', accessionId, researchData);
        });
    },

    // ==========================================
    // PHASE 4: Finalize to Active Inventory
    // ==========================================
    async finalizeToInventory(staffId, accessionId, inventoryData) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
        try {
            const accession = await pbService.pb.collection('accessions').getOne(accessionId);
            assertTransition('accession', accession.status, 'finalized');

            // Hard guard: Check if inventory already exists for this accession
            const existing = await pbService.pb.collection('inventory').getFirstListItem(`accession_id="${accessionId}"`).catch(() => null);
            if (existing) {
                throw new Error(`Inventory item already exists for this accession (Catalog #${existing.catalog_number}).`);
            }

            // Validate required research fields
            const missingFields = [];
            if (!accession.dimensions) missingFields.push('Dimensions');
            if (!accession.materials) missingFields.push('Materials');
            if (!accession.historical_significance) missingFields.push('Historical Significance');

            if (missingFields.length > 0) {
                throw new Error(`Cannot finalize. Missing required research fields: ${missingFields.join(', ')}`);
            }

            // ENFORCE IMAGING RULE (H1 Mandatory Images or Fallback)
            const media = await pbService.pb.collection('media_attachments').getFullList({
                filter: `entity_type="accession" && entity_id="${accessionId}"`
            });

            const hasImages = media.length > 0;
            const skipReason = inventoryData.imageSkipReason;

            if (!hasImages && !skipReason) {
                throw new Error("Mandatory Imaging Requirement: You must either upload artifact images or provide a formal curatorial fallback reason (e.g. Sensitive to light).");
            }

            // Auto-generate catalog number if not provided
            const catalogNumber = inventoryData.catalogNumber || await generateCatalogNumber();
            const location = inventoryData.location || 'Receiving Bay';

            const inventory = await this._createRecord(staffId, 'inventory', {
                accession_id: accession.id,
                catalog_number: catalogNumber,
                current_location: location,
                status: 'active',
                image_skip_reason: skipReason || ''
            });

            // Create condition report (referenced, not copied)
            const conditionReports = await this.getConditionReports('accession', accessionId);
            if (conditionReports.items?.length > 0) {
                const latestCondition = conditionReports.items[0];
                await this.createConditionReport(staffId, 'inventory', inventory.id, latestCondition.condition, latestCondition.notes);
            } else if (inventoryData.conditionReport) {
                await this.createConditionReport(staffId, 'inventory', inventory.id, inventoryData.conditionReport);
            }

            // Log initial location
            let pbUserIdFinal = await pbService.getAppUserId(staffId);
            if (!pbUserIdFinal) {
                const user = await userService.getUserById(staffId);
                if (user) {
                    await pbService.syncUser(user);
                    pbUserIdFinal = await pbService.getAppUserId(staffId);
                }
            }

            await pbService.pb.collection('location_history').create({
                id: this._genId(),
                inventory_item_id: inventory.id,
                from_location: 'N/A (New Entry)',
                to_location: location,
                reason: 'Initial cataloging',
                moved_by: pbUserIdFinal
            });

            await this._transitionRecord(staffId, 'accession', 'accessions', accessionId, 'finalized');

            notificationService.sendGlobal('New Artifact Cataloged', 
                `Item ${catalogNumber} has been moved to ${location}.`);
            
            return inventory;
        } catch (error) {
            logger.error(`Error finalizing to inventory: ${error.message}`);
            throw error; 
        }
        });
    },

    // ==========================================
    // INVENTORY: Location Transfer
    // ==========================================
    async transferLocation(staffId, inventoryId, toLocation, reason = '', submissionId = null) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await pbService.pb.collection('inventory').getOne(inventoryId);
            
            if (item.status === 'deaccessioned') {
                throw new Error('Cannot move a deaccessioned item.');
            }

            const pbUserId = await pbService.getAppUserId(staffId);
            await pbService.pb.collection('location_history').create({
                id: this._genId(),
                inventory_item_id: inventoryId,
                from_location: item.current_location,
                to_location: toLocation,
                reason: reason,
                moved_by: pbUserId,
                submission_id: submissionId
            });

            const updated = await this._updateRecord(staffId, 'inventory', inventoryId, {
                current_location: toLocation
            });

            // Trigger status re-derivation (non-blocking)
            this.autoDeriveArtifactStatus(staffId, inventoryId).catch(err => 
                logger.error(`Auto-derivation failed for ${inventoryId}: ${err.message}`)
            );

            return updated;
        });
    },

    // ==========================================
    // DEACCESSION
    // ==========================================
    async deaccessionItem(staffId, inventoryId, reason) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await pbService.pb.collection('inventory').getOne(inventoryId);
            assertTransition('inventory', item.status, 'deaccessioned');

            return await this._updateRecord(staffId, 'inventory', inventoryId, {
                status: 'deaccessioned',
                deaccession_reason: reason
            });
        });
    },

    // ==========================================
    // PHASE 7: MUSEUM COMPLIANCE
    // ==========================================
    async getMovementHistory(inventoryId) {
        return await this._listRecords('location_history', {
            filter: `inventory_item_id="${inventoryId}"`,
            sort: '-created',
            expand: 'moved_by'
        });
    },

    async createConservationLog(staffId, inventoryId, treatment, findings, recommendations = '') {
        return await globalMutex.runExclusive(`conservation_${inventoryId}`, async () => {
            const pbUserId = await pbService.getAppUserId(staffId);
            const log = await pbService.pb.collection('conservation_logs').create({
                id: this._genId(),
                inventory_item_id: inventoryId,
                treatment: treatment,
                findings: findings,
                recommendations: recommendations,
                conservator_id: pbUserId
            });

            await auditService.log({
                collection: 'conservation_logs',
                recordId: log.id,
                action: 'create',
                userId: staffId,
                after: log
            });

            return log;
        });
    },

    async getConservationLogs(inventoryId) {
        return await this._listRecords('conservation_logs', {
            filter: `inventory_item_id="${inventoryId}"`,
            sort: '-created',
            expand: 'conservator_id'
        });
    },

    // ==========================================
    // TRAVERSAL: Full chain view
    // ==========================================
    async getFullChain(intakeId) {
        try {
            const intake = await pbService.pb.collection('intakes').getOne(intakeId, {
                expand: 'submission_id,donation_item_id,donor_account_id'
            });

            const accessions = await pbService.pb.collection('accessions').getFullList({
                filter: `intake_id="${intakeId}"`
            });

            let inventoryItems = [];
            for (const acc of accessions) {
                const items = await pbService.pb.collection('inventory').getFullList({
                    filter: `accession_id="${acc.id}"`
                });
                inventoryItems = inventoryItems.concat(items);
            }

            return { intake, accessions, inventoryItems };
        } catch (error) {
            logger.error(`Error fetching full chain: ${error.message}`);
            throw error;
        }
    },

    async generateFormalReport(accessionId) {
        const accession = await pbService.pb.collection('accessions').getOne(accessionId, {
            expand: 'intake_id,intake_id.submission_id'
        });
        const intake = accession.expand.intake_id;
        
        // Build HTML
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Accession Report - ${accession.accession_number}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
                    body { font-family: 'Inter', sans-serif; padding: 50px; color: #1a1a1a; line-height: 1.5; max-width: 800px; margin: 0 auto; }
                    .header { border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .logo { font-size: 28px; font-weight: 800; letter-spacing: -1.5px; color: #000; }
                    .org { font-size: 12px; font-weight: bold; letter-spacing: 1px; color: #666; text-align: right; }
                    .report-title { text-align: center; font-size: 32px; font-weight: 800; margin-bottom: 50px; text-transform: uppercase; letter-spacing: 4px; border: 2px solid #000; padding: 10px; }
                    .section { margin-bottom: 35px; page-break-inside: avoid; }
                    .section-title { font-size: 14px; font-weight: 800; background: #000; color: #fff; padding: 6px 12px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 15px; }
                    .item { margin-bottom: 15px; }
                    .label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.5px; }
                    .value { font-size: 15px; font-weight: 500; border-bottom: 1px solid #eee; padding-bottom: 4px; }
                    .notes-box { background: #f9f9f9; padding: 20px; border-left: 4px solid #ddd; font-style: italic; font-size: 14px; white-space: pre-wrap; }
                    .footer { margin-top: 80px; display: flex; justify-content: space-between; }
                    .sig-line { width: 220px; border-top: 2px solid #000; text-align: center; padding-top: 8px; }
                    .sig-label { font-size: 10px; font-weight: 800; text-transform: uppercase; }
                    @media print {
                        .no-print { display: none; }
                        body { padding: 0; margin: 0; }
                        @page { margin: 2cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">MUSEO BULAWAN</div>
                    <div class="org">OFFICE OF THE REGISTRAR<br>ARCHIVE COPY</div>
                </div>

                <div class="report-title">Accession Record</div>

                <div class="section">
                    <div class="section-title">I. Administrative Identification</div>
                    <div class="grid">
                        <div class="item">
                            <div class="label">Accession Number</div>
                            <div class="value" style="font-weight: 800; color: #d946ef;">${accession.accession_number}</div>
                        </div>
                        <div class="item">
                            <div class="label">Registration Date</div>
                            <div class="value">${new Date(accession.created).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
                        </div>
                        <div class="item">
                            <div class="label">Legal Status</div>
                            <div class="value">${accession.legal_status}</div>
                        </div>
                        <div class="item">
                            <div class="label">Contract Framework</div>
                            <div class="value">${accession.contract_type.replace(/_/g, ' ').toUpperCase()}</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">II. Artifact Specification</div>
                    <div class="grid">
                        <div class="item">
                            <div class="label">Nomenclature / Proposed Name</div>
                            <div class="value">${intake.proposed_item_name}</div>
                        </div>
                        <div class="item">
                            <div class="label">Acquisition Method</div>
                            <div class="value">${intake.acquisition_method.toUpperCase()}</div>
                        </div>
                        <div class="item">
                            <div class="label">Physical Dimensions</div>
                            <div class="value">${accession.dimensions || 'NOT RECORDED'}</div>
                        </div>
                        <div class="item">
                            <div class="label">Constituent Materials</div>
                            <div class="value">${accession.materials || 'NOT RECORDED'}</div>
                        </div>
                    </div>
                    <div class="item">
                        <div class="label">Historical Significance & Provenance</div>
                        <div class="notes-box">${accession.historical_significance || 'No significant historical data recorded at this stage.'}</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">III. Source & Provenance</div>
                    <div class="grid">
                        <div class="item">
                            <div class="label">Donor / Primary Source</div>
                            <div class="value">${intake.donor_info || intake.source_info}</div>
                        </div>
                        <div class="item">
                            <div class="label">Original Intake ID</div>
                            <div class="value" style="font-family: monospace; font-size: 12px;">${intake.id}</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">IV. Curatorial Research Notes</div>
                    <div class="notes-box" style="background: #fff; border: 1px solid #eee;">${accession.research_notes || 'No additional curatorial notes available.'}</div>
                </div>

                ${Object.keys(accession.research_data || {}).length > 0 ? `
                <div class="section">
                    <div class="section-title">V. Supplemental Structured Metadata</div>
                    <div class="grid">
                        ${Object.entries(accession.research_data).map(([k, v]) => `
                            <div class="item">
                                <div class="label">${k}</div>
                                <div class="value">${v}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="footer">
                    <div class="sig-line">
                        <div class="sig-label">Curator in Charge</div>
                    </div>
                    <div class="sig-line">
                        <div class="sig-label">Chief Registrar</div>
                    </div>
                </div>

                <div class="no-print" style="margin-top: 60px; text-align: center; border-top: 1px dashed #ccc; padding-top: 30px;">
                    <button onclick="window.print()" style="background: #000; color: #fff; border: none; padding: 12px 30px; font-weight: 800; cursor: pointer; border-radius: 5px; font-size: 14px;">
                        ⎙ PRINT OFFICIAL REPORT
                    </button>
                </div>
            </body>
            </html>
        `;
    },

    /**
     * Updates an artifact's status with mandatory justification for manual overrides.
     */
    async updateArtifactStatus(staffId, inventoryId, newStatus, isManual = false, reason = '') {
        if (isManual && (!reason || reason.trim().length < 5)) {
            throw new Error('VALIDATION_FAILED: A mandatory justification (at least 5 characters) is required for manual status overrides.');
        }

        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await pbService.pb.collection('inventory').getOne(inventoryId);
            
            return await this._updateRecord(staffId, 'inventory', inventoryId, {
                status: newStatus,
                manual_status_override: isManual,
                override_reason: isManual ? reason : (item.override_reason || '')
            });
        });
    },

    /**
     * Automatically derives artifact status based on latest health and movement.
     */
    async autoDeriveArtifactStatus(staffId, inventoryId) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await pbService.pb.collection('inventory').getOne(inventoryId);
            
            // If manual override is active, do not auto-derive unless it's being cleared
            if (item.manual_status_override) {
                logger.info(`Skipping auto-derivation for artifact ${inventoryId} due to manual override.`);
                return item;
            }

            const healthReports = await this.getConditionReports('inventory', inventoryId);
            const latestHealth = healthReports.items?.[0];

            const movementHistory = await this.getMovementHistory(inventoryId);
            const latestMovement = movementHistory.items?.[0];

            let derivedStatus = 'active';

            // 1. Health-based rules
            if (latestHealth) {
                const condition = latestHealth.condition;
                if (condition === 'Critical' || condition === 'Poor') {
                    derivedStatus = 'maintenance';
                }
            }

            // 2. Movement-based rules (higher priority than health if specific)
            if (latestMovement) {
                const loc = (latestMovement.to_location || '').toLowerCase();
                if (loc.includes('loan')) {
                    derivedStatus = 'loan';
                } else if (loc.includes('storage') || loc.includes('vault')) {
                    derivedStatus = 'storage';
                }
            }

            // 3. Status priority logic
            if (item.status === 'deaccessioned') {
                derivedStatus = 'deaccessioned'; // Final state
            }

            if (item.status !== derivedStatus) {
                logger.info(`Auto-deriving status for ${inventoryId}: ${item.status} -> ${derivedStatus}`);
                return await this._updateRecord(staffId, 'inventory', inventoryId, {
                    status: derivedStatus
                });
            }

            return item;
        });
    }
};