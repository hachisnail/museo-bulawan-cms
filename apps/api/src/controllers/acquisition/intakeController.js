import { acquisitionService } from '../../services/acquisitionService.js';
import { formPipelineService } from '../../services/formPipelineService.js';
import { mapDTO } from '../../utils/dtoMapper.js';

/**
 * IntakeController
 * 
 * Handles early lifecycle actions: initial registration, MOA generation, and delivery tracking.
 */
export const intakeController = {
    /**
     * GET /intakes
     * 
     * Supports query parameters:
     *   ?status=under_review          — Filter by intake status
     *   ?method=gift|loan|purchase    — Filter by acquisition method
     *   ?search=text                  — Search by proposed item name (LIKE)
     *   ?page=1&perPage=50            — Pagination
     *   ?expand=donor_account_id      — Expand relations
     *   ?sort=asc|desc                — Sort direction for created_at
     */
    async listIntakes(req, res, next) {
        try {
            const filters = [];
            if (req.query.status) filters.push(`status="${req.query.status}"`);
            if (req.query.method) filters.push(`acquisition_method="${req.query.method}"`);
            if (req.query.search) filters.push(`proposed_item_name~"${req.query.search}"`);

            const query = {
                page: req.query.page,
                perPage: req.query.perPage,
                expand: req.query.expand,
                filter: filters.length > 0 ? filters.join(' && ') : req.query.filter
            };

            const result = await acquisitionService._listRecords('intakes', query);
            res.status(200).json({ status: 'success', data: mapDTO(result) });
        } catch (error) { next(error); }
    },

    async getIntakeItem(req, res, next) {
        try {
            const { intakeId } = req.params;
            const result = await acquisitionService._getRecord('intakes', intakeId, req.query);
            res.status(200).json({ status: 'success', data: mapDTO(result) });
        } catch (error) { next(error); }
    },

    async processExternalIntake(req, res, next) {
        try {
            const { submissionId } = req.params;
            const staffId = req.user ? req.user.id : 'system';
            const result = await formPipelineService.processExternalIntake(staffId, submissionId);
            res.status(200).json({ 
                message: `External submission processed into ${result.intakes.length} intake(s).`, 
                ...result 
            });
        } catch (error) { next(error); }
    },

    async createInternalIntake(req, res, next) {
        try {
            const value = req.body;
            const staffId = req.user.id;
            const intake = await acquisitionService.createInternalIntake(staffId, value, value.method, value.loanEndDate);
            res.status(201).json({ message: "Internal intake created.", intake });
        } catch (error) { next(error); }
    },

    async approveIntake(req, res, next) {
        try {
            const { intakeId } = req.params;
            const intake = await acquisitionService.approveIntake(req.user.id, intakeId);
            res.status(200).json({ message: "Intake approved.", intake: mapDTO(intake) });
        } catch (error) { next(error); }
    },

    async rejectIntake(req, res, next) {
        try {
            const { intakeId } = req.params;
            const intake = await acquisitionService.rejectIntake(req.user.id, intakeId, req.body.reason);
            res.status(200).json({ message: "Intake rejected.", intake: mapDTO(intake) });
        } catch (error) { next(error); }
    },

    async reopenIntake(req, res, next) {
        try {
            const { intakeId } = req.params;
            const intake = await acquisitionService.reopenIntake(req.user.id, intakeId);
            res.status(200).json({ message: "Intake reopened for review.", intake: mapDTO(intake) });
        } catch (error) { next(error); }
    },

    async generateMOA(req, res, next) {
        try {
            const { intakeId } = req.params;
            const result = await acquisitionService.generateDynamicMOA(req.user.id, intakeId, req.body);
            res.status(200).json({
                ...result,
                intake: mapDTO(result.intake)
            });
        } catch (error) { next(error); }
    },

    async exportMOA(req, res, next) {
        try {
            const { intakeId } = req.params;
            const buffer = await acquisitionService.exportMOA(intakeId);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=MOA_${intakeId}.docx`);
            res.status(200).send(buffer);
        } catch (error) { next(error); }
    },

    async rollbackIntake(req, res, next) {
        try {
            const { intakeId } = req.params;
            const intake = await acquisitionService.rollbackToReview(req.user.id, intakeId);
            res.status(200).json({ message: "Intake rolled back to under review.", intake: mapDTO(intake) });
        } catch (error) { next(error); }
    },

    async verifyDeliveryToken(req, res, next) {
        try {
            const { token } = req.params;
            const result = await acquisitionService.verifyDeliveryToken(token);
            if (!result.valid) {
                return res.status(400).json({ error: result.error, intake: mapDTO(result.intake) });
            }
            res.status(200).json({ status: 'success', data: mapDTO(result.intake) });
        } catch (error) { next(error); }
    },

    async confirmDelivery(req, res, next) {
        try {
            const { intakeId } = req.params;
            const intake = await acquisitionService.confirmPhysicalDelivery(req.user.id, intakeId, req.body.token);
            res.status(200).json({ message: "Physical delivery confirmed.", intake: mapDTO(intake) });
        } catch (error) { next(error); }
    },

    /**
     * POST /intakes/external/:submissionId/accept-and-issue
     *
     * Streamlined one-click path for donation submissions:
     * 1. Processes the external submission into intake(s)
     * 2. Approves the first intake
     * 3. Generates the MOA / Deed of Gift + delivery slip
     *
     * Returns the MOA payload directly so the UI can open the document modal immediately.
     */
    async acceptAndIssueExternal(req, res, next) {
        try {
            const { submissionId } = req.params;
            const staffId = req.user.id;

            // Step 1: Process submission → intake(s)
            const processResult = await formPipelineService.processExternalIntake(staffId, submissionId);
            if (!processResult.intakes || processResult.intakes.length === 0) {
                return res.status(400).json({ error: 'No intakes were created from this submission.' });
            }

            // Step 2 & 3: Approve + generate MOA for each intake
            // For multi-item submissions we handle all, return the last MOA result for display
            let lastMoaResult = null;
            for (const intake of processResult.intakes) {
                await acquisitionService.approveIntake(staffId, intake.id);
                const overrides = req.body || {};
                lastMoaResult = await acquisitionService.generateDynamicMOA(staffId, intake.id, overrides);
            }

            res.status(200).json({
                ...lastMoaResult,
                intake: mapDTO(lastMoaResult.intake),
                intakeCount: processResult.intakes.length
            });
        } catch (error) { next(error); }
    },

    async rejectSubmission(req, res, next) {
        try {
            const { submissionId } = req.params;
            const result = await formPipelineService.rejectSubmission(submissionId);
            res.status(200).json({ message: "Submission archived.", ...result });
        } catch (error) { next(error); }
    },

    async reopenSubmission(req, res, next) {
        try {
            const { submissionId } = req.params;
            const result = await formPipelineService.reopenSubmission(submissionId);
            res.status(200).json({ message: "Submission restored to pending.", ...result });
        } catch (error) { next(error); }
    },

    async updateLocation(req, res, next) {
        try {
            const { intakeId } = req.params;
            const { location } = req.body;
            const result = await acquisitionService.updateIntakeLocation(req.user.id, intakeId, location);
            res.status(200).json({ status: 'success', data: mapDTO(result) });
        } catch (error) { next(error); }
    },

    async listVisitorDonations(req, res, next) {
        try {
            const result = await acquisitionService.listVisitorDonations(req.user.id);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    }
};
