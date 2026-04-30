import { acquisitionService } from '../../services/acquisitionService.js';
import { getValidTransitions } from '../../utils/stateMachine.js';
import { mapDTO } from '../../utils/dtoMapper.js';

/**
 * ComplianceController
 * 
 * Handles museum compliance actions: conservation logs, movement trails, 
 * condition reports, and state machine metadata.
 */
export const complianceController = {
    async getMovementHistory(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const history = await acquisitionService.getMovementHistory(inventoryId);
            res.status(200).json({ status: 'success', data: mapDTO(history) });
        } catch (error) { next(error); }
    },

    async addConservationLog(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const { treatment, findings, recommendations } = req.body;
            if (!treatment) return res.status(400).json({ error: "Treatment is required." });
            const log = await acquisitionService.createConservationLog(req.user.id, inventoryId, treatment, findings, recommendations);
            res.status(201).json({ message: "Conservation log added.", log: mapDTO(log) });
        } catch (error) { next(error); }
    },

    async getConservationLogs(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const logs = await acquisitionService.getConservationLogs(inventoryId);
            res.status(200).json({ status: 'success', data: mapDTO(logs) });
        } catch (error) { next(error); }
    },

    async addConditionReport(req, res, next) {
        try {
            const { entityType, entityId } = req.params;
            const report = await acquisitionService.createConditionReport(req.user.id, entityType, entityId, req.body.condition, req.body.notes);
            res.status(201).json({ message: "Condition report added.", report: mapDTO(report) });
        } catch (error) { next(error); }
    },

    async getConditionReports(req, res, next) {
        try {
            const { entityType, entityId } = req.params;
            const reports = await acquisitionService.getConditionReports(entityType, entityId);
            res.status(200).json({ status: 'success', data: mapDTO(reports) });
        } catch (error) { next(error); }
    },

    /**
     * Returns available next actions for a given entity.
     * Useful for the frontend to render available action buttons.
     */
    async getAvailableActions(req, res, next) {
        try {
            const { entityType, status } = req.params;
            const transitions = getValidTransitions(entityType, status);
            res.status(200).json({ 
                entityType, 
                currentStatus: status, 
                availableTransitions: transitions 
            });
        } catch (error) { next(error); }
    }
};
