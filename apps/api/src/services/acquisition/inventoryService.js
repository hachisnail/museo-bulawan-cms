import { baseService } from './baseService.js';
import { pbService } from '../pocketbaseService.js';
import { notificationService } from '../notificationService.js';
import { userService } from '../userService.js';
import { logger } from '../../utils/logger.js';
import { globalMutex } from '../../utils/mutex.js';
import { generateCatalogNumber } from '../../utils/sequenceGenerator.js';
import { assertTransition } from '../../utils/stateMachine.js';

export const inventoryService = {
    // ==========================================
    // PHASE 4: Finalize to Active Inventory
    // ==========================================
    async finalizeToInventory(staffId, accessionId, inventoryData) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            try {
                const accession = await pbService.pb.collection('accessions').getOne(accessionId);
                assertTransition('accession', accession.status, 'finalized');

                const existing = await pbService.pb.collection('inventory').getFirstListItem(`accession_id="${accessionId}"`).catch(() => null);
                if (existing) {
                    throw new Error(`Inventory item already exists for this accession (Catalog #${existing.catalog_number}).`);
                }

                const missingFields = [];
                if (!accession.dimensions) missingFields.push('Dimensions');
                if (!accession.materials) missingFields.push('Materials');
                if (!accession.historical_significance) missingFields.push('Historical Significance');

                if (missingFields.length > 0) {
                    throw new Error(`Cannot finalize. Missing required research fields: ${missingFields.join(', ')}`);
                }

                const media = await pbService.pb.collection('media_attachments').getFullList({
                    filter: `entity_type="accession" && entity_id="${accessionId}"`
                });

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
                    image_skip_reason: skipReason || ''
                });

                const conditionReports = await baseService.getConditionReports('accession', accessionId);
                if (conditionReports.items?.length > 0) {
                    const latestCondition = conditionReports.items[0];
                    await baseService.createConditionReport(staffId, 'inventory', inventory.id, latestCondition.condition, latestCondition.notes);
                } else if (inventoryData.conditionReport) {
                    await baseService.createConditionReport(staffId, 'inventory', inventory.id, inventoryData.conditionReport);
                }

                let pbUserIdFinal = await pbService.getAppUserId(staffId);
                if (!pbUserIdFinal) {
                    const adminUser = await pbService.pb.collection('app_users').getFirstListItem('role="admin"').catch(() => null);
                    pbUserIdFinal = adminUser?.id;
                }

                await pbService.pb.collection('location_history').create({
                    id: baseService._genId(),
                    inventory_item_id: inventory.id,
                    from_location: 'N/A (New Entry)',
                    to_location: location,
                    reason: 'Initial cataloging',
                    moved_by: pbUserIdFinal
                });

                await baseService._transitionRecord(staffId, 'accession', 'accessions', accessionId, 'finalized');

                notificationService.sendGlobal('New Artifact Cataloged', 
                    `Item ${catalogNumber} has been moved to ${location}.`);
                
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
    async transferLocation(staffId, inventoryId, toLocation, reason = '', submissionId = null) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await pbService.pb.collection('inventory').getOne(inventoryId);
            
            if (item.status === 'deaccessioned') {
                throw new Error('Cannot move a deaccessioned item.');
            }

            const pbUserId = await pbService.getAppUserId(staffId);
            await pbService.pb.collection('location_history').create({
                id: baseService._genId(),
                inventory_item_id: inventoryId,
                from_location: item.current_location,
                to_location: toLocation,
                reason: reason,
                moved_by: pbUserId,
                submission_id: submissionId
            });

            const updated = await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                current_location: toLocation
            });

            this.autoDeriveArtifactStatus(staffId, inventoryId).catch(err => 
                logger.error(`Auto-derivation failed for ${inventoryId}: ${err.message}`)
            );

            return updated;
        });
    },

    // ==========================================
    // DEACCESSION
    // ==========================================
    async deaccessionItem(staffId, inventoryId, reason) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await pbService.pb.collection('inventory').getOne(inventoryId);
            assertTransition('inventory', item.status, 'deaccessioned');

            const pbUserId = await pbService.getAppUserId(staffId);

            // 1. Create a formal movement log for the deaccession
            await pbService.pb.collection('location_history').create({
                id: baseService._genId(),
                inventory_item_id: inventoryId,
                from_location: item.current_location,
                to_location: 'Deaccessioned / Removed from Collection',
                reason: `Deaccession: ${reason}`,
                moved_by: pbUserId
            });

            // 2. Update the record
            const updated = await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                status: 'deaccessioned',
                deaccession_reason: reason,
                current_location: 'Off-site (Deaccessioned)'
            });

            // 3. Notify relevant staff
            notificationService.sendGlobal('Artifact Deaccessioned', 
                `Item ${item.catalog_number} has been formally removed from the collection. Reason: ${reason}`);

            logger.warn(`Artifact ${inventoryId} formally deaccessioned by ${staffId}. Reason: ${reason}`);

            return updated;
        });
    },

    // ==========================================
    // PHASE 7: MUSEUM COMPLIANCE
    // ==========================================
    async getMovementHistory(inventoryId) {
        return await baseService._listRecords('location_history', {
            filter: `inventory_item_id="${inventoryId}"`,
            sort: '-created',
            expand: 'moved_by'
        });
    },

    async createConservationLog(staffId, inventoryId, treatment, findings, recommendations = '') {
        return await globalMutex.runExclusive(`conservation_${inventoryId}`, async () => {
            const pbUserId = await pbService.getAppUserId(staffId);
            const log = await pbService.pb.collection('conservation_logs').create({
                id: baseService._genId(),
                inventory_item_id: inventoryId,
                treatment: treatment,
                findings: findings,
                recommendations: recommendations,
                conservator_id: pbUserId
            });

            await baseService._updateRecord(staffId, 'inventory', inventoryId, {}); // Update timestamp/version

            return log;
        });
    },

    async getConservationLogs(inventoryId) {
        return await baseService._listRecords('conservation_logs', {
            filter: `inventory_item_id="${inventoryId}"`,
            sort: '-created',
            expand: 'conservator_id'
        });
    },

    // ==========================================
    // TRAVERSAL: Full chain view
    // ==========================================
    async getFullChain(intakeId) {
        try {
            const intake = await pbService.pb.collection('intakes').getOne(intakeId, {
                expand: 'submission_id,donation_item_id,donor_account_id'
            });

            const accessions = await pbService.pb.collection('accessions').getFullList({
                filter: `intake_id="${intakeId}"`
            });

            let inventoryItems = [];
            for (const acc of accessions) {
                const items = await pbService.pb.collection('inventory').getFullList({
                    filter: `accession_id="${acc.id}"`
                });
                inventoryItems = inventoryItems.concat(items);
            }

            return { intake, accessions, inventoryItems };
        } catch (error) {
            logger.error(`Error fetching full chain: ${error.message}`);
            throw error;
        }
    },

    /**
     * Updates an artifact's status with mandatory justification for manual overrides.
     */
    async updateArtifactStatus(staffId, inventoryId, newStatus, isManual = false, reason = '') {
        if (isManual && (!reason || reason.trim().length < 5)) {
            throw new Error('VALIDATION_FAILED: A mandatory justification (at least 5 characters) is required for manual status overrides.');
        }

        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await pbService.pb.collection('inventory').getOne(inventoryId);
            
            return await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                status: newStatus,
                manual_status_override: isManual,
                override_reason: isManual ? reason : (item.override_reason || '')
            });
        });
    },

    /**
     * Automatically derives artifact status based on latest health and movement.
     */
    async autoDeriveArtifactStatus(staffId, inventoryId) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await pbService.pb.collection('inventory').getOne(inventoryId);
            
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
                const condition = latestHealth.condition;
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

            if (item.status === 'deaccessioned') {
                derivedStatus = 'deaccessioned';
            }

            if (item.status !== derivedStatus) {
                logger.info(`Auto-deriving status for ${inventoryId}: ${item.status} -> ${derivedStatus}`);
                return await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                    status: derivedStatus
                });
            }

            return item;
        });
    }
};
