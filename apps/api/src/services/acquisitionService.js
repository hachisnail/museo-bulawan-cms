import { baseService } from './acquisition/baseService.js';
import { intakeService } from './acquisition/intakeService.js';
import { accessionService } from './acquisition/accessionService.js';
import { inventoryService } from './acquisition/inventoryService.js';

/**
 * AcquisitionService Facade
 * 
 * Provides a unified entry point for the acquisition pipeline.
 * Delegates to specialized domain services while maintaining backward compatibility.
 * This ensures that controllers and other services don't need to change their imports.
 */
export const acquisitionService = {
    // ==========================================
    // SHARED & BASE HELPERS
    // ==========================================
    _genId: baseService._genId.bind(baseService),
    _listRecords: baseService._listRecords.bind(baseService),
    _getRecord: baseService._getRecord.bind(baseService),
    _createRecord: baseService._createRecord.bind(baseService),
    _updateRecord: baseService._updateRecord.bind(baseService),
    _transitionRecord: baseService._transitionRecord.bind(baseService),
    
    // Condition Reporting (Shared)
    createConditionReport: baseService.createConditionReport.bind(baseService),
    getConditionReports: baseService.getConditionReports.bind(baseService),

    // ==========================================
    // INTAKE DOMAIN (Phases 1 & 2)
    // ==========================================
    registerExternalIntake: intakeService.registerExternalIntake.bind(intakeService),
    createInternalIntake: intakeService.createInternalIntake.bind(intakeService),
    approveIntake: intakeService.approveIntake.bind(intakeService),
    rejectIntake: intakeService.rejectIntake.bind(intakeService),
    reopenIntake: intakeService.reopenIntake.bind(intakeService),
    generateDynamicMOA: intakeService.generateDynamicMOA.bind(intakeService),
    rollbackToReview: intakeService.rollbackToReview.bind(intakeService),
    verifyDeliveryToken: intakeService.verifyDeliveryToken.bind(intakeService),
    confirmPhysicalDelivery: intakeService.confirmPhysicalDelivery.bind(intakeService),

    // ==========================================
    // ACCESSION DOMAIN (Phase 3)
    // ==========================================
    getAccessionItem: (id, q) => baseService._getRecord('accessions', id, q),
    processAccession: accessionService.processAccession.bind(accessionService),
    uploadMOA: accessionService.uploadMOA.bind(accessionService),
    approveAccession: accessionService.approveAccession.bind(accessionService),
    updateAccessionResearch: accessionService.updateAccessionResearch.bind(accessionService),
    generateFormalReport: accessionService.generateFormalReport.bind(accessionService),

    // ==========================================
    // INVENTORY DOMAIN (Phase 4 & Beyond)
    // ==========================================
    getInventoryItem: (id, q) => baseService._getRecord('inventory', id, q),
    finalizeToInventory: inventoryService.finalizeToInventory.bind(inventoryService),
    transferLocation: inventoryService.transferLocation.bind(inventoryService),
    deaccessionItem: inventoryService.deaccessionItem.bind(inventoryService),
    getMovementHistory: inventoryService.getMovementHistory.bind(inventoryService),
    createConservationLog: inventoryService.createConservationLog.bind(inventoryService),
    getConservationLogs: inventoryService.getConservationLogs.bind(inventoryService),
    getFullChain: inventoryService.getFullChain.bind(inventoryService),
    updateArtifactStatus: inventoryService.updateArtifactStatus.bind(inventoryService),
    autoDeriveArtifactStatus: inventoryService.autoDeriveArtifactStatus.bind(inventoryService)
};