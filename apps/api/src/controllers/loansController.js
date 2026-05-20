import { acquisitionService } from '../services/acquisitionService.js';
import { logger } from '../utils/logger.js';

export const loansController = {
    async listLoans(req, res) {
        try {
            const data = await acquisitionService.listLoans(req.query);
            res.json({ status: 'success', data });
        } catch (error) {
            logger.error('Failed to list loans', { error: error.message });
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    async createLoan(req, res) {
        try {
            const data = await acquisitionService.createLoan(req.user.id, req.body);
            res.status(201).json({ status: 'success', data });
        } catch (error) {
            logger.error('Failed to create loan', { error: error.message });
            res.status(400).json({ error: error.message });
        }
    },

    async activateLoan(req, res) {
        try {
            await acquisitionService.activateLoan(req.user.id, req.params.id);
            res.json({ status: 'success' });
        } catch (error) {
            logger.error('Failed to activate loan', { error: error.message });
            res.status(400).json({ error: error.message });
        }
    },

    async returnLoan(req, res) {
        try {
            await acquisitionService.returnLoan(req.user.id, req.params.id, req.body);
            res.json({ status: 'success', message: 'Loan returned successfully.' });
        } catch (error) {
            logger.error('Failed to return loan', { error: error.message });
            res.status(400).json({ error: error.message });
        }
    },

    async exportLoanAgreement(req, res) {
        try {
            const buffer = await acquisitionService.getLoanAgreementDocument(req.params.id, 'docx');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=Loan_Agreement_${req.params.id}.docx`);
            res.status(200).send(buffer);
        } catch (error) {
            logger.error('Failed to export loan agreement', { error: error.message });
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};
