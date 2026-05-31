import { acquisitionService } from '../services/acquisitionService.js';
import { logger } from '../utils/logger.js';

export const loansController = {
    async listLoans(req, res, next) {
        try {
            const data = await acquisitionService.listLoans(req.query);
            res.json({ status: 'success', data });
        } catch (error) { next(error); }
    },

    async createLoan(req, res, next) {
        try {
            const data = await acquisitionService.createLoan(req.user.id, req.body);
            res.status(201).json({ status: 'success', data });
        } catch (error) { next(error); }
    },

    async activateLoan(req, res, next) {
        try {
            await acquisitionService.activateLoan(req.user.id, req.params.id);
            res.json({ status: 'success' });
        } catch (error) { next(error); }
    },

    async returnLoan(req, res, next) {
        try {
            await acquisitionService.returnLoan(req.user.id, req.params.id, req.body);
            res.json({ status: 'success', message: 'Loan returned successfully.' });
        } catch (error) { next(error); }
    },

    async exportLoanAgreement(req, res, next) {
        try {
            const buffer = await acquisitionService.getLoanAgreementDocument(req.params.id, 'docx');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=Loan_Agreement_${req.params.id}.docx`);
            res.status(200).send(buffer);
        } catch (error) { next(error); }
    }
};
