import { intakeController } from './acquisition/intakeController.js';
import { accessionController } from './acquisition/accessionController.js';
import { inventoryController } from './acquisition/inventoryController.js';
import { complianceController } from './acquisition/complianceController.js';
import { schemas } from './acquisition/schemas.js';

/**
 * AcquisitionController Facade
 * 
 * Provides a unified entry point for all acquisition-related operations.
 * Delegates to specialized sub-controllers while maintaining backward compatibility.
 * 
 * Domain breakdown:
 * - Intake: Registration, initial review, and physical delivery.
 * - Accession: Formal documentation, research, and legal MOA.
 * - Inventory: Cataloging, location management, and deaccessioning.
 * - Compliance: Condition reporting and conservation logs.
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
    getFullChain: accessionController.getFullChain.bind(accessionController),

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

    // ==========================================
    // COMPLIANCE & HISTORY
    // ==========================================
    getMovementHistory: complianceController.getMovementHistory.bind(complianceController),
    addConservationLog: complianceController.addConservationLog.bind(complianceController),
    getConservationLogs: complianceController.getConservationLogs.bind(complianceController),
    addConditionReport: complianceController.addConditionReport.bind(complianceController),
    getConditionReports: complianceController.getConditionReports.bind(complianceController),
    getAvailableActions: complianceController.getAvailableActions.bind(complianceController)
};