import { db } from '../../config/db.js';
import { baseService } from './baseService.js';
import { logger } from '../../utils/logger.js';
import { notificationService } from '../notificationService.js';
import { auditService } from '../auditService.js';

/**
 * LoanService
 * 
 * Manages outbound and inbound loan agreements for museum artifacts.
 * Migrated to use baseService patterns for consistent audit trails and ID generation.
 */
export const loanService = {
    async listLoans(params = {}) {
        const { status, type = 'outbound' } = params;
        let query = 'SELECT l.*, c.name as borrower_name FROM loans l LEFT JOIN constituents c ON l.borrower_id = c.id WHERE l.loan_type = ?';
        const values = [type];

        if (status) {
            query += ' AND l.status = ?';
            values.push(status);
        }

        query += ' ORDER BY l.created_at DESC';
        const items = await db.query(query, values);
        return { items };
    },

    async createLoan(staffId, data) {
        return await db.transaction(async (tx) => {
            const { artifacts, ...loanData } = data;

            // Use baseService for consistent ID generation, audit trail, and version tracking
            const loan = await baseService._createRecord(staffId, 'loans', {
                loan_type: loanData.loan_type || 'outbound',
                borrower_id: loanData.borrower_id || null,
                borrower_name_manual: loanData.borrower_name_manual || null,
                venue: loanData.venue || null,
                purpose: loanData.purpose || null,
                start_date: loanData.start_date || null,
                end_date: loanData.end_date || null,
                insurance_coverage: loanData.insurance_coverage || null,
                courier_details: loanData.courier_details || null,
                status: loanData.status || 'draft'
            }, tx);

            if (artifacts && Array.isArray(artifacts)) {
                for (const invId of artifacts) {
                    await baseService._createRecord(staffId, 'loan_artifacts', {
                        loan_id: loan.id,
                        inventory_id: invId
                    }, tx);

                    // Update inventory status if loan is immediately active
                    if (loanData.status === 'active') {
                        await tx.updateRecord('inventory', invId, { status: 'loan' });
                    }
                }
            }

            notificationService.sendGlobal('New Loan Agreement', `Loan ${loan.id} has been drafted for ${loanData.venue || 'external venue'}.`);
            return loan;
        });
    },

    async activateLoan(staffId, loanId) {
        return await db.transaction(async (tx) => {
            const [loan] = await tx.query('SELECT * FROM loans WHERE id = ?', [loanId]);
            if (!loan) throw new Error('LOAN_NOT_FOUND');

            await tx.updateRecord('loans', loanId, { status: 'active' });

            // Audit the activation
            await auditService.log({
                collection: 'loans',
                recordId: loanId,
                action: 'update',
                userId: staffId,
                before: { status: loan.status },
                after: { status: 'active' }
            }, tx);

            // Update all linked artifacts to 'loan' status
            const artifacts = await tx.query('SELECT inventory_id FROM loan_artifacts WHERE loan_id = ?', [loanId]);
            for (const a of artifacts) {
                await tx.updateRecord('inventory', a.inventory_id, { status: 'loan' });
            }

            logger.info('Loan activated', { loanId, staffId });
            return true;
        });
    },

    async returnLoan(staffId, loanId, returnData = {}) {
        return await db.transaction(async (tx) => {
            const [loan] = await tx.query('SELECT * FROM loans WHERE id = ?', [loanId]);
            if (!loan) throw new Error('LOAN_NOT_FOUND');
            if (loan.status === 'returned') throw new Error('LOAN_ALREADY_RETURNED');

            await tx.updateRecord('loans', loanId, { status: 'returned' });

            // Audit the return
            await auditService.log({
                collection: 'loans',
                recordId: loanId,
                action: 'update',
                userId: staffId,
                before: { status: loan.status },
                after: { status: 'returned' }
            }, tx);

            // Update all linked artifacts back to 'active'
            const artifacts = await tx.query('SELECT inventory_id FROM loan_artifacts WHERE loan_id = ?', [loanId]);
            for (const a of artifacts) {
                const invId = a.inventory_id;
                await tx.updateRecord('inventory', invId, { status: 'active' });

                // Create location history entry for the return
                const [item] = await tx.query('SELECT current_location FROM inventory WHERE id = ?', [invId]);
                if (item) {
                    await baseService._createRecord(staffId, 'location_history', {
                        inventory_item_id: invId,
                        from_location: loan.venue || 'External Loan',
                        to_location: item.current_location,
                        movement_type: 'Loan Return',
                        reason: returnData.reason || 'Loan agreement concluded',
                        moved_by: staffId
                    }, tx);
                }
            }

            logger.info('Loan returned', { loanId, staffId });
            notificationService.sendGlobal('Loan Concluded', `Loan ${loan.id} from ${loan.venue || 'external venue'} has been returned.`);
            return true;
        });
    },

    async getLoanAgreementDocument(loanId, format = 'html') {
        const [loan] = await db.query('SELECT * FROM loans WHERE id = ?', [loanId]);
        if (!loan) throw new Error('LOAN_NOT_FOUND');

        const artifacts = await db.query(`
            SELECT i.* 
            FROM inventory i
            JOIN loan_artifacts la ON la.inventory_id = i.id
            WHERE la.loan_id = ?
        `, [loanId]);

        return await documentService.generateLoanAgreement(loan, artifacts, format);
    }
};
