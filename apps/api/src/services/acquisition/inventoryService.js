import { baseService } from './baseService.js';
import { db } from '../../config/db.js';
import { notificationService } from '../notificationService.js';
import { logger } from '../../utils/logger.js';
import { globalMutex } from '../../utils/mutex.js';
import { generateCatalogNumber } from '../../utils/sequenceGenerator.js';
import { assertTransition } from '../../utils/stateMachine.js';
import { documentService } from '../documentService.js';

export const inventoryService = {
    // ==========================================
    // PHASE 4: Finalize to Active Inventory
    // ==========================================
    async finalizeToInventory(staffId, accessionId, inventoryData) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            try {
                const accession = await baseService._getRecord('accessions', accessionId);
                assertTransition('accession', accession.status, 'finalized');

                const existing = await db.query('SELECT * FROM inventory WHERE accession_id = ?', [accessionId]);
                if (existing && existing.length > 0) {
                    throw new Error(`Inventory item already exists for this accession.`);
                }

                const missingFields = [];
                if (!accession.dimensions) missingFields.push('Dimensions');
                if (!accession.materials) missingFields.push('Materials');
                if (!accession.historical_significance) missingFields.push('Historical Significance');

                if (missingFields.length > 0) {
                    throw new Error(`Cannot finalize. Missing required research fields: ${missingFields.join(', ')}`);
                }

                const media = await db.query(`
                    SELECT l.id 
                    FROM media_links l 
                    WHERE l.entity_type = 'accession' AND l.entity_id = ?
                `, [accessionId]);
                const hasImages = media.length > 0;
                const skipReason = inventoryData.imageSkipReason;

                if (!hasImages && !skipReason) {
                    throw new Error("Mandatory Imaging Requirement: You must either upload artifact images or provide a formal curatorial fallback reason.");
                }

                const catalogNumber = inventoryData.catalogNumber || await generateCatalogNumber();
                const location = inventoryData.location || 'Receiving Bay';

                const inventory = await baseService._createRecord(staffId, 'inventory', {
                    accession_id: accession.id,
                    catalog_number: catalogNumber,
                    current_location: location,
                    status: 'active',
                    // Note: Ensure image_skip_reason exists on DB table or omit if unsupported
                    deaccession_reason: skipReason ? `Image Skipped: ${skipReason}` : null 
                });

                const conditionReports = await baseService.getConditionReports('accession', accessionId);
                if (conditionReports.items?.length > 0) {
                    const latestCondition = conditionReports.items[0];
                    await baseService.createConditionReport(staffId, 'inventory', inventory.id, latestCondition.condition_status, latestCondition.notes);
                } else if (inventoryData.conditionReport) {
                    await baseService.createConditionReport(staffId, 'inventory', inventory.id, inventoryData.conditionReport);
                }

                await baseService._createRecord(staffId, 'location_history', {
                    inventory_item_id: inventory.id,
                    from_location: 'N/A (New Entry)',
                    to_location: location,
                    reason: 'Initial cataloging',
                    moved_by: staffId
                });

                await baseService._transitionRecord(staffId, 'accession', 'accessions', accessionId, 'finalized');

                notificationService.sendGlobal('New Artifact Cataloged', 
                    `Item ${catalogNumber} has been moved to ${location}.`, 'success', { actionUrl: `/inventory?id=${inventory.id}` });
                
                return inventory;
            } catch (error) {
                logger.error(`Error finalizing to inventory: ${error.message}`);
                throw error; 
            }
        });
    },

    // ==========================================
    // INVENTORY: Location Transfer
    // ==========================================
    async transferLocation(staffId, inventoryId, toLocation, reason, submissionId = null, extra = {}) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const inventory = await baseService._getRecord('inventory', inventoryId);
            
            if (inventory.status === 'deaccessioned') {
                throw new Error('Cannot move a deaccessioned item.');
            }

            const fromLocation = inventory.current_location;

            return await db.transaction(async (tx) => {
                // 1. Create history entry
                await baseService._createRecord(staffId, 'location_history', {
                    inventory_item_id: inventoryId,
                    from_location: fromLocation,
                    to_location: toLocation,
                    movement_type: extra.movement_type || null,
                    reason: reason,
                    handling_notes: extra.handling_notes || null,
                    moved_by: staffId,
                    submission_id: submissionId
                }, tx);

                const updated = await tx.updateRecord('inventory', inventoryId, {
                    current_location: toLocation
                });

                this.autoDeriveArtifactStatus(staffId, inventoryId).catch(err => 
                    logger.error(`Auto-derivation failed for ${inventoryId}: ${err.message}`)
                );

                return updated;
            });
        });
    },

    // ==========================================
    // BATCH OPERATIONS
    // ==========================================
    async batchTransfer(staffId, inventoryIds, toLocation, reason, extra = {}) {
        if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
            throw new Error('VALIDATION_FAILED: No inventory IDs provided for batch transfer.');
        }

        return await globalMutex.runExclusive('inventory_batch_move', async () => {
            return await db.transaction(async (tx) => {
                const results = [];
                
                for (const id of inventoryIds) {
                    const item = await tx.query('SELECT * FROM inventory WHERE id = ?', [id]);
                    if (!item || item.length === 0) continue;
                    
                    const fromLocation = item[0].current_location;

                    // 1. Create history
                    await baseService._createRecord(staffId, 'location_history', {
                        inventory_item_id: id,
                        from_location: fromLocation,
                        to_location: toLocation,
                        movement_type: extra.movement_type || 'Batch Transfer',
                        reason: reason,
                        moved_by: staffId
                    }, tx);

                    // 2. Update inventory
                    const updated = await tx.updateRecord('inventory', id, {
                        current_location: toLocation
                    });
                    
                    results.push(updated);
                }

                notificationService.sendGlobal('Batch Movement Completed', 
                    `${inventoryIds.length} artifacts have been moved to ${toLocation}.`, 'info', { actionUrl: '/inventory' });

                return { count: results.length, items: results };
            });
        });
    },

    // ==========================================
    // DEACCESSION
    // ==========================================
    async deaccessionItem(staffId, inventoryId, reason) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await baseService._getRecord('inventory', inventoryId);
            if (item.status === 'deaccessioned') throw new Error('ALREADY_DEACCESSIONED');

            // Move to pending state first
            const updated = await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                status: 'deaccession_pending',
                deaccession_reason: reason
            });

            notificationService.sendToRole('admin', 'Deaccession Approval Required', 
                `Artifact ${item.catalog_number} has been proposed for deaccessioning.`, 'warning', { actionUrl: `/inventory?id=${inventoryId}` });
            
            return updated;
        });
    },

    async approveDeaccession(staffId, inventoryId) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await baseService._getRecord('inventory', inventoryId);
            if (item.status !== 'deaccession_pending') throw new Error('INVALID_STATE: Item must be deaccession_pending');

            await baseService._createRecord(staffId, 'location_history', {
                inventory_item_id: inventoryId,
                from_location: item.current_location,
                to_location: 'OFF-SITE / DEACCESSIONED',
                movement_type: 'Deaccession',
                reason: item.deaccession_reason,
                moved_by: staffId
            });

            return await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                status: 'deaccessioned'
            });
        });
    },

    async getMovementHistory(inventoryId) {
        return await baseService._listRecords('location_history', {
            filter: `inventory_item_id="${inventoryId}"`
        });
    },

    async createConservationLog(staffId, inventoryId, treatment, findings, recommendations, submissionId = null, extra = {}) {
        return await globalMutex.runExclusive(`conservation_${inventoryId}`, async () => {
            const log = await baseService._createRecord(staffId, 'conservation_logs', {
                inventory_item_id: inventoryId,
                conservator_name: extra.conservator_name || null,
                treatment_objective: extra.treatment_objective || null,
                treatment: treatment,
                findings: findings,
                recommendations: recommendations,
                next_review_date: extra.next_review_date || null,
                conservator_id: staffId,
                submission_id: submissionId
            });

            await baseService._updateRecord(staffId, 'inventory', inventoryId, {}); // Update timestamp/version

            return log;
        });
    },

    async getConservationLogs(inventoryId) {
        return await baseService._listRecords('conservation_logs', {
            filter: `inventory_item_id="${inventoryId}"`
        });
    },

    // ==========================================
    // TRAVERSAL: Full chain view
    // ==========================================
    async getFullChain(intakeId) {
        try {
            const intake = await baseService._getRecord('intakes', intakeId);
            const accessions = await db.query('SELECT * FROM accessions WHERE intake_id = ?', [intakeId]);
            
            let inventoryItems = [];
            for (const acc of accessions) {
                const items = await db.query('SELECT * FROM inventory WHERE accession_id = ?', [acc.id]);
                inventoryItems = inventoryItems.concat(items);
            }

            return { intake, accessions, inventoryItems };
        } catch (error) {
            logger.error(`Error fetching full chain: ${error.message}`);
            throw error;
        }
    },

    async updateArtifactStatus(staffId, inventoryId, newStatus, isManual = false, reason = '') {
        if (isManual && (!reason || reason.trim().length < 5)) {
            throw new Error('VALIDATION_FAILED: A mandatory justification (at least 5 characters) is required for manual status overrides.');
        }

        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await baseService._getRecord('inventory', inventoryId);
            
            // Assuming manual_status_override is added to the table schema, else we omit.
            return await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                status: newStatus
            });
        });
    },

    async autoDeriveArtifactStatus(staffId, inventoryId) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await baseService._getRecord('inventory', inventoryId);
            
            if (item.manual_status_override) {
                logger.info(`Skipping auto-derivation for artifact ${inventoryId} due to manual override.`);
                return item;
            }

            const healthReports = await baseService.getConditionReports('inventory', inventoryId);
            const latestHealth = healthReports.items?.[0];

            const movementHistory = await this.getMovementHistory(inventoryId);
            const latestMovement = movementHistory.items?.[0];

            let derivedStatus = 'active';

            if (latestHealth) {
                const condition = latestHealth.condition_status;
                if (condition === 'Critical' || condition === 'Poor') {
                    derivedStatus = 'maintenance';
                }
            }

            if (latestMovement) {
                const loc = (latestMovement.to_location || '').toLowerCase();
                if (loc.includes('loan')) {
                    derivedStatus = 'loan';
                } else if (loc.includes('storage') || loc.includes('vault')) {
                    derivedStatus = 'storage';
                }
            }

            if (item.status === 'deaccessioned' || item.status === 'deaccession_pending') {
                derivedStatus = item.status;
            }

            if (item.status !== derivedStatus) {
                logger.info(`Auto-deriving status for ${inventoryId}: ${item.status} -> ${derivedStatus}`);
                return await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                    status: derivedStatus
                });
            }

            return item;
        });
    },

    // ==========================================
    // REPORT GENERATION & EXPORT
    // ==========================================
    async generateReport(inventoryId) {
        const inventory = await baseService._getRecord('inventory', inventoryId);
        const accession = await baseService._getRecord('accessions', inventory.accession_id);
        const intake = await baseService._getRecord('intakes', accession.intake_id);
        const movementRes = await this.getMovementHistory(inventoryId);
        
        return await documentService.generateInventoryReport(inventory, accession, intake, movementRes.items, 'html');
    },

    async exportReport(inventoryId) {
        const inventory = await baseService._getRecord('inventory', inventoryId);
        const accession = await baseService._getRecord('accessions', inventory.accession_id);
        const intake = await baseService._getRecord('intakes', accession.intake_id);
        const movementRes = await this.getMovementHistory(inventoryId);
        
        return await documentService.generateInventoryReport(inventory, accession, intake, movementRes.items, 'docx');
    }
};