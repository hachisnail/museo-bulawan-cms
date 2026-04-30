import { baseService } from './baseService.js';
import { db } from '../../config/db.js';
import { mediaService } from '../mediaService.js';
import { notificationService } from '../notificationService.js';
import { globalMutex } from '../../utils/mutex.js';
import { logger } from '../../utils/logger.js';
import { generateAccessionNumber } from '../../utils/sequenceGenerator.js';
import { assertTransition } from '../../utils/stateMachine.js';
import { documentService } from '../documentService.js';

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
                const intake = await baseService._getRecord('intakes', intakeId);
                assertTransition('intake', intake.status, 'accessioned');

                const rows = await db.query(`SELECT id FROM accessions WHERE intake_id = ?`, [intakeId]);
                if (rows && rows.length > 0) {
                    throw new Error(`Accession record already exists for this intake.`);
                }

                const methodToContractMap = {
                    'gift': 'deed_of_gift',
                    'loan': 'loan_agreement',
                    'purchase': 'bill_of_sale',
                    'existing': 'internal_memo'
                };

                const accessionNumber = accessionData.accessionNumber || await generateAccessionNumber();

                const accession = await baseService._createRecord(staffId, 'accessions', {
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

                if (accessionData.conditionReport) {
                    await baseService.createConditionReport(staffId, 'accession', accession.id, accessionData.conditionReport);
                }

                await baseService._transitionRecord(staffId, 'intake', 'intakes', intakeId, 'accessioned', {
                    moa_status: accessionData.isMoaSigned ? 'signed' : intake.moa_status
                });

                // Promote media if it's from a submission
                if (intake.submission_id) {
                    try {
                        await mediaService.promoteSubmissionMedia(staffId, intake.submission_id, 'accession', accession.id);
                    } catch (mErr) {
                        logger.error(`Non-blocking error promoting media: ${mErr.message}`);
                    }
                }

                return accession;
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
                        `SELECT id FROM media_links WHERE entity_type = 'accessions' AND entity_id = ? AND context = 'Signed MOA Document'`,
                        [accessionId]
                    );

                    for (const link of existingLinks) {
                        await mediaService.deleteMedia(staffId, link.id, tx);
                    }

                    // Attach the new MOA
                    return await mediaService.attachMedia(staffId, 'accessions', accessionId, files, 'Signed MOA Document', tx);
                });

                if (accession.intake_id) {
                    const intake = await baseService._getRecord('intakes', accession.intake_id);
                    if (intake.moa_status !== 'signed') {
                        await baseService._updateRecord(staffId, 'intakes', accession.intake_id, { moa_status: 'signed' });
                    }
                }

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
            await baseService._createRecord(staffId, 'accession_approvals', {
                accession_id: accessionId,
                approved_by: staffId,
                decision: 'approved',
                notes: notes,
                reporter: reporter,
                submission_id: submissionId
            });

            const result = await baseService._transitionRecord(staffId, 'accession', 'accessions', accessionId, 'in_research');
            
            const accession = await baseService._getRecord('accessions', accessionId);
            notificationService.sendToRole('curator', 'Accession Approved', 
                `Record ${accession.accession_number} has been approved and is ready for research.`, 'success', { actionUrl: `/accessions?id=${accessionId}` });
            
            return result;
        });
    },

    // ==========================================
    // PHASE 3D: Incremental Research Updates
    // ==========================================
    async updateAccessionResearch(staffId, accessionId, researchData) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            const accession = await baseService._getRecord('accessions', accessionId);
            if (accession.status === 'finalized') {
                throw new Error("Cannot modify research data for a finalized accession record.");
            }
            return await baseService._updateRecord(staffId, 'accessions', accessionId, researchData);
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
