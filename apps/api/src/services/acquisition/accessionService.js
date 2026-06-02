import { baseService } from './baseService.js';
import { db } from '../../config/db.js';
import { mediaService } from '../mediaService.js';
import { notificationService } from '../notificationService.js';
import { globalMutex } from '../../utils/mutex.js';
import { logger } from '../../utils/logger.js';
import { generateAccessionNumber } from '../../utils/sequenceGenerator.js';
import { assertTransition } from '../../utils/stateMachine.js';
import { documentService } from '../documentService.js';
import { getContractType, getLegalStatus } from '../../utils/constants.js';

/**
 * AccessionService
 * 
 * Handles Phase 3 of the Acquisition Pipeline: Formal cataloging and research.
 * Migrated to native MariaDB infrastructure.
 */
export const accessionService = {
    // ==========================================
    // PHASE 3B: Formal Accessioning
    // ==========================================
    async processAccession(staffId, intakeId, accessionData) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            try {
                return await db.transaction(async (tx) => {
                    const intake = await baseService._getRecord('intakes', intakeId, {}, tx);
                    assertTransition('intake', intake.status, 'processed');

                    const rows = await tx.query(`SELECT id FROM accessions WHERE intake_id = ?`, [intakeId]);
                    if (rows && rows.length > 0) {
                        throw new Error(`Accession record already exists for this intake.`);
                    }

                    const accessionNumber = accessionData.accessionNumber || await generateAccessionNumber();

                    const accession = await baseService._createRecord(staffId, 'accessions', {
                        intake_id: intake.id,
                        accession_number: accessionNumber,
                        contract_type: getContractType(intake.acquisition_method),
                        legal_status: getLegalStatus(intake.acquisition_method),
                        handling_instructions: accessionData.handlingInstructions || '',
                        dimensions: '',
                        materials: '',
                        research_notes: '',
                        status: 'pending_approval',
                        signed_moa: accessionData.isMoaSigned ? true : false
                    }, tx);

                    if (accessionData.conditionReport) {
                        await baseService.createConditionReport(staffId, 'accession', accession.id, accessionData.conditionReport, '', null, '', {}, tx);
                    }

                    await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'processed', {
                        moa_status: accessionData.isMoaSigned ? 'signed' : intake.moa_status
                    }, tx);

                    // Promote media if it's from a submission
                    if (intake.submission_id) {
                        try {
                            await mediaService.promoteSubmissionMedia(staffId, intake.submission_id, 'accession', accession.id, tx);
                        } catch (mErr) {
                            logger.error(`Non-blocking error promoting media: ${mErr.message}`);
                        }
                    }

                    return accession;
                });
            } catch (error) {
                logger.error(`Error processing accession: ${error.message}`);
                throw error;
            }
        });
    },

    // ==========================================
    // PHASE 3.5: MOA Upload (MariaDB Junction Pattern)
    // ==========================================
    async uploadMOA(staffId, accessionId, files) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            try {
                const accession = await baseService._getRecord('accessions', accessionId);
                
                // Enforce single MOA policy: Delete existing MOA links for this accession
                const updatedFiles = await db.transaction(async (tx) => {
                    const existingLinks = await tx.query(
                        `SELECT id FROM media_links WHERE entity_type = 'accession' AND entity_id = ? AND context = 'Signed MOA Document'`,
                        [accessionId]
                    );

                    for (const link of existingLinks) {
                        await mediaService.deleteMedia(staffId, link.id, tx);
                    }

                    // Attach the new MOA
                    return await mediaService.attachMedia(staffId, 'accession', accessionId, files, 'Signed MOA Document', tx);
                });

                if (accession.intake_id) {
                    const intake = await baseService._getRecord('intakes', accession.intake_id);
                    if (intake.moa_status !== 'signed') {
                        await baseService._updateRecord(staffId, 'intakes', accession.intake_id, { moa_status: 'signed' });
                    }
                }

                await baseService._updateRecord(staffId, 'accessions', accessionId, { signed_moa: true });

                return updatedFiles;
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
            try {
                return await db.transaction(async (tx) => {
                    const accession = await baseService._getRecord('accessions', accessionId, {}, tx);
                    if (accession.status === 'in_research' || accession.status === 'finalized') {
                        return accession;
                    }

                    await baseService._createRecord(staffId, 'accession_approvals', {
                        accession_id: accessionId,
                        approved_by: staffId,
                        decision: 'approved',
                        notes: notes,
                        reporter: reporter,
                        submission_id: submissionId
                    }, tx);

                    const result = await baseService._transitionRecord(staffId, 'accession', 'accessions', accessionId, 'in_research', {}, tx);
                    
                    notificationService.sendToRole('curator', 'Accession Approved', 
                        `Record ${accession.accession_number} has been approved and is ready for research.`, 'success', { actionUrl: `/accessions?id=${accessionId}` });
                    
                    return result;
                });
            } catch (error) {
                logger.error(`Error approving accession: ${error.message}`);
                throw error;
            }
        });
    },

    // ==========================================
    // PHASE 3D: Incremental Research Updates
    // ==========================================
    async updateAccessionResearch(staffId, accessionId, researchData) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            return await db.transaction(async (tx) => { // <-- ADD TRANSACTION WRAPPER
                const accession = await baseService._getRecord('accessions', accessionId, {}, tx); // <-- PASS TX
                
                if (accession.status === 'finalized') {
                    throw new Error("Cannot modify research data for a finalized accession record.");
                }

                const updateData = { ...researchData };
                if (updateData.tags !== undefined) {
                    if (typeof updateData.tags === 'string') {
                        updateData.tags = updateData.tags
                            .split(',')
                            .map(t => t.trim())
                            .filter(t => t.length > 0);
                    } else if (!Array.isArray(updateData.tags)) {
                        updateData.tags = [];
                    }
                }
                
                return await baseService._updateRecord(staffId, 'accessions', accessionId, updateData, tx); // <-- PASS TX
            });
        });
    },

    // ==========================================
    // PHASE 3E: Reject / Cancel Accession
    // ==========================================
    async rejectAccession(staffId, accessionId, reason = '') {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            try {
                return await db.transaction(async (tx) => {
                    const accession = await baseService._getRecord('accessions', accessionId, {}, tx);
                    assertTransition('accession', accession.status, 'rejected');

                    // 1. Revert the linked intake from 'processed' back to 'in_custody'
                    if (accession.intake_id) {
                        const intake = await baseService._getRecord('intakes', accession.intake_id, {}, tx);
                        if (intake.status === 'processed') {
                            await baseService._transitionRecord(staffId, 'intake', 'intakes', accession.intake_id, 'in_custody', {}, tx);
                        }
                    }

                    // 2. Clean up media links for this accession
                    const mediaLinks = await tx.query(
                        `SELECT id FROM media_links WHERE entity_type = 'accession' AND entity_id = ?`,
                        [accessionId]
                    );
                    for (const link of mediaLinks) {
                        try {
                            await mediaService.deleteMedia(staffId, link.id, tx);
                        } catch (mErr) {
                            logger.error(`Non-blocking error cleaning up media: ${mErr.message}`);
                        }
                    }

                    // 3. Delete accession approvals
                    await tx.query(`DELETE FROM accession_approvals WHERE accession_id = ?`, [accessionId]);

                    // 4. Delete the accession record itself
                    await tx.query(`DELETE FROM accessions WHERE id = ?`, [accessionId]);

                    // 5. Notify
                    notificationService.sendToRole('curator', 'Accession Rejected',
                        `Accession ${accession.accession_number} has been rejected${reason ? ': ' + reason : ''}. The intake has been returned to custody.`,
                        'warning', { actionUrl: `/intakes?tab=intakes` });

                    return { success: true, accession_number: accession.accession_number, intake_id: accession.intake_id };
                });
            } catch (error) {
                logger.error(`Error rejecting accession: ${error.message}`);
                throw error;
            }
        });
    },

    // ==========================================
    // REPORT GENERATION & EXPORT
    // ==========================================
    async generateFormalReport(accessionId) {
        const accession = await baseService._getRecord('accessions', accessionId);
        const intake = await baseService._getRecord('intakes', accession.intake_id);
        return await documentService.generateAccessionReport(accession, intake, 'html');
    },

    async exportFormalReport(accessionId) {
        const accession = await baseService._getRecord('accessions', accessionId);
        const intake = await baseService._getRecord('intakes', accession.intake_id);
        return await documentService.generateAccessionReport(accession, intake, 'docx');
    }
};
