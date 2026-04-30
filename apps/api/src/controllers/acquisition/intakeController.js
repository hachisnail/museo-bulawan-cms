import { acquisitionService } from '../../services/acquisitionService.js';
import { formPipelineService } from '../../services/formPipelineService.js';
import { mapDTO } from '../../utils/dtoMapper.js';

/**
 * IntakeController
 * 
 * Handles early lifecycle actions: initial registration, MOA generation, and delivery tracking.
 */
export const intakeController = {
    async listIntakes(req, res, next) {
        try {
            const result = await acquisitionService._listRecords('intakes', req.query);
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
    }
};
