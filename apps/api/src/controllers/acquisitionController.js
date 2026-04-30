import { intakeController } from './acquisition/intakeController.js';
import { accessionController } from './acquisition/accessionController.js';
import { inventoryController } from './acquisition/inventoryController.js';
import { complianceController } from './acquisition/complianceController.js';
import { loansController } from './loansController.js';
import { acquisitionService } from '../services/acquisitionService.js';
import { schemas } from './acquisition/schemas.js';

/**
 * AcquisitionController Facade
 * 
 * Provides a unified entry point for all acquisition-related operations.
 * Delegates to specialized sub-controllers while maintaining backward compatibility.
 */
export const acquisitionController = {
    // ==========================================
    // VALIDATION SCHEMAS
    // ==========================================
    schemas,

    // ==========================================
    // INTAKE ACTIONS
    // ==========================================
    listIntakes: intakeController.listIntakes.bind(intakeController),
    getIntakeItem: intakeController.getIntakeItem.bind(intakeController),
    processExternalIntake: intakeController.processExternalIntake.bind(intakeController),
    createInternalIntake: intakeController.createInternalIntake.bind(intakeController),
    approveIntake: intakeController.approveIntake.bind(intakeController),
    rejectIntake: intakeController.rejectIntake.bind(intakeController),
    reopenIntake: intakeController.reopenIntake.bind(intakeController),
    generateMOA: intakeController.generateMOA.bind(intakeController),
    rollbackIntake: intakeController.rollbackIntake.bind(intakeController),
    verifyDeliveryToken: intakeController.verifyDeliveryToken.bind(intakeController),
    confirmDelivery: intakeController.confirmDelivery.bind(intakeController),

    // ==========================================
    // ACCESSION ACTIONS
    // ==========================================
    listAccessions: accessionController.listAccessions.bind(accessionController),
    getAccessionItem: accessionController.getAccessionItem.bind(accessionController),
    uploadMOA: accessionController.uploadMOA.bind(accessionController),
    processAccession: accessionController.processAccession.bind(accessionController),
    approveAccession: accessionController.approveAccession.bind(accessionController),
    updateResearch: accessionController.updateResearch.bind(accessionController),
    generateReport: accessionController.generateReport.bind(accessionController),
    exportReport: accessionController.exportReport.bind(accessionController),
    getFullChain: accessionController.getFullChain.bind(accessionController),
    getUniqueTags: accessionController.getUniqueTags.bind(accessionController),
    exportMOA: intakeController.exportMOA.bind(intakeController),

    // ==========================================
    // INVENTORY ACTIONS
    // ==========================================
    listInventory: inventoryController.listInventory.bind(inventoryController),
    listDeaccessioned: inventoryController.listDeaccessioned.bind(inventoryController),
    getInventoryItem: inventoryController.getInventoryItem.bind(inventoryController),
    finalizeInventory: inventoryController.finalizeInventory.bind(inventoryController),
    transferLocation: inventoryController.transferLocation.bind(inventoryController),
    deaccessionItem: inventoryController.deaccessionItem.bind(inventoryController),
    updateArtifactStatus: inventoryController.updateArtifactStatus.bind(inventoryController),
    generateInventoryReport: inventoryController.generateReport.bind(inventoryController),
    exportInventoryReport: inventoryController.exportReport.bind(inventoryController),
    batchTransfer: async (req, res, next) => {
        try {
            const { inventoryIds, toLocation, reason, extra } = req.body;
            const result = await acquisitionService.batchTransfer(req.user.id, inventoryIds, toLocation, reason, extra);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    // ==========================================
    // COMPLIANCE & HISTORY
    // ==========================================
    getMovementHistory: complianceController.getMovementHistory.bind(complianceController),
    addConservationLog: complianceController.addConservationLog.bind(complianceController),
    getConservationLogs: complianceController.getConservationLogs.bind(complianceController),
    addConditionReport: complianceController.addConditionReport.bind(complianceController),
    getConditionReports: complianceController.getConditionReports.bind(complianceController),
    getAvailableActions: complianceController.getAvailableActions.bind(complianceController),

    // ==========================================
    // AUTHORITY CONTROL (CONSTITUENTS)
    // ==========================================
    listConstituents: async (req, res, next) => {
        try {
            const result = await acquisitionService.listConstituents(req.query);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },
    createConstituent: async (req, res, next) => {
        try {
            const result = await acquisitionService.createConstituent(req.user.id, req.body);
            res.status(201).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },
    searchConstituents: async (req, res, next) => {
        try {
            const result = await acquisitionService.searchConstituents(req.query.q);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    // ==========================================
    // FINANCIALS (VALUATIONS)
    // ==========================================
    addValuation: async (req, res, next) => {
        try {
            const { inventoryId } = req.params;
            const result = await acquisitionService.addValuation(req.user.id, inventoryId, req.body);
            res.status(201).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },
    getValuationHistory: async (req, res, next) => {
        try {
            const { inventoryId } = req.params;
            const result = await acquisitionService.getValuationHistory(inventoryId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    // ==========================================
    // EXHIBITIONS & USAGE
    // ==========================================
    listExhibitions: async (req, res, next) => {
        try {
            const result = await acquisitionService.listExhibitions(req.query);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },
    createExhibition: async (req, res, next) => {
        try {
            const result = await acquisitionService.createExhibition(req.user.id, req.body);
            res.status(201).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },
    getExhibitionDetails: async (req, res, next) => {
        try {
            const result = await acquisitionService.getExhibitionDetails(req.params.exhibitionId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },
    addArtifactToExhibition: async (req, res, next) => {
        try {
            const { exhibitionId } = req.params;
            const { inventoryId, displayNotes } = req.body;
            const result = await acquisitionService.addArtifactToExhibition(req.user.id, exhibitionId, inventoryId, displayNotes);
            res.status(201).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },
    getArtifactExhibitionHistory: async (req, res, next) => {
        try {
            const { inventoryId } = req.params;
            const result = await acquisitionService.getArtifactExhibitionHistory(inventoryId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    // ==========================================
    // LOAN ACTIONS (Outbound)
    // ==========================================
    listLoans: (req, res) => loansController.listLoans(req, res),
    createLoan: (req, res) => loansController.createLoan(req, res),
    activateLoan: (req, res) => loansController.activateLoan(req, res)
};