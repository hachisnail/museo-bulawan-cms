import { db } from '../../config/db.js';
import { ulid } from 'ulid';
import { baseService } from './baseService.js';
import { logger } from '../../utils/logger.js';
import { notificationService } from '../notificationService.js';

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
            const loanId = ulid();
            const { artifacts, ...loanData } = data;

            await tx.query(`
                INSERT INTO loans (id, loan_type, borrower_id, borrower_name_manual, venue, purpose, start_date, end_date, insurance_coverage, courier_details, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                loanId, 
                loanData.loan_type || 'outbound',
                loanData.borrower_id,
                loanData.borrower_name_manual,
                loanData.venue,
                loanData.purpose,
                loanData.start_date,
                loanData.end_date,
                loanData.insurance_coverage,
                loanData.courier_details,
                staffId
            ]);

            if (artifacts && Array.isArray(artifacts)) {
                for (const invId of artifacts) {
                    await tx.query(`
                        INSERT INTO loan_artifacts (id, loan_id, inventory_id)
                        VALUES (?, ?, ?)
                    `, [ulid(), loanId, invId]);

                    // Update inventory status if active
                    if (loanData.status === 'active') {
                        await tx.updateRecord('inventory', invId, { status: 'loan' });
                    }
                }
            }

            notificationService.sendGlobal('New Loan Agreement', `Loan ${loanId} has been drafted for ${loanData.venue || 'external venue'}.`);
            return { id: loanId, ...loanData };
        });
    },

    async activateLoan(staffId, loanId) {
        return await db.transaction(async (tx) => {
            const [loan] = await tx.query('SELECT * FROM loans WHERE id = ?', [loanId]);
            if (!loan) throw new Error('LOAN_NOT_FOUND');

            await tx.updateRecord('loans', loanId, { status: 'active' });

            // Update all linked artifacts to 'loan' status
            const artifacts = await tx.query('SELECT inventory_id FROM loan_artifacts WHERE loan_id = ?', [loanId]);
            for (const a of artifacts) {
                await tx.updateRecord('inventory', a.inventory_id, { status: 'loan' });
            }

            logger.info('Loan activated', { loanId, staffId });
            return true;
        });
    }
};
