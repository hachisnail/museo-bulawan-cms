import { baseService } from './baseService.js';
import { pbService } from '../pocketbaseService.js';
import { mediaService } from '../mediaService.js';
import { auditService } from '../auditService.js';
import { globalMutex } from '../../utils/mutex.js';
import { logger } from '../../utils/logger.js';
import { generateAccessionNumber } from '../../utils/sequenceGenerator.js';
import { assertTransition } from '../../utils/stateMachine.js';

export const accessionService = {
    // ==========================================
    // PHASE 3B: Formal Accessioning
    // ==========================================
    async processAccession(staffId, intakeId, accessionData) {
        return await globalMutex.runExclusive(`intake_${intakeId}`, async () => {
            try {
                const intake = await pbService.pb.collection('intakes').getOne(intakeId);
                assertTransition('intake', intake.status, 'accessioned');

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
    // PHASE 3.5: MOA Upload
    // ==========================================
    async uploadMOA(staffId, accessionId, files) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            try {
                const accession = await pbService.pb.collection('accessions').getOne(accessionId);
                // Allow MOA upload even for finalized records, as legal docs may arrive late.
                // We just log it for audit purposes.
                if (accession.status === 'finalized') {
                    logger.info(`Late MOA upload for finalized accession: ${accessionId}`);
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

                if (updated.intake_id) {
                    const intake = await pbService.pb.collection('intakes').getOne(updated.intake_id);
                    if (intake.moa_status !== 'signed') {
                        await baseService._updateRecord(staffId, 'intakes', updated.intake_id, { moa_status: 'signed' });
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
                const adminUser = await pbService.pb.collection('app_users').getFirstListItem('role="admin"').catch(() => null);
                pbUserId = adminUser?.id;
            }
            if (!pbUserId) throw new Error("Staff user not found in PocketBase.");

            await pbService.pb.collection('accession_approvals').create({
                id: baseService._genId(),
                accession_id: accessionId,
                approved_by: pbUserId,
                decision: 'approved',
                notes: notes,
                reporter: reporter,
                submission_id: submissionId
            });

            return await baseService._transitionRecord(staffId, 'accession', 'accessions', accessionId, 'in_research');
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
            return await baseService._updateRecord(staffId, 'accessions', accessionId, researchData);
        });
    },

    // ==========================================
    // FORMAL REPORT GENERATION
    // ==========================================
    async generateFormalReport(accessionId) {
        const accession = await pbService.pb.collection('accessions').getOne(accessionId, {
            expand: 'intake_id,intake_id.submission_id'
        });
        const intake = accession.expand.intake_id;
        
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
    }
};
