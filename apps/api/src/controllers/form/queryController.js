import { formService } from '../../services/formService.js';

/**
 * QueryController
 * 
 * Handles staff-facing submission listing and detail retrieval.
 */
export const queryController = {
    async listSubmissions(req, res, next) {
        try {
            const { slug } = req.params;
            const result = await formService.listSubmissions(slug, req.query);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    async listAllSubmissions(req, res, next) {
        try {
            const result = await formService.listAllSubmissions(req.query);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    async getSubmission(req, res, next) {
        try {
            const { submissionId } = req.params;
            const submission = await formService.getSubmission(submissionId);
            const items = await formService.getSubmissionItems(submissionId);
            res.status(200).json({ status: 'success', data: { submission, items } });
        } catch (error) { next(error); }
    }
};
