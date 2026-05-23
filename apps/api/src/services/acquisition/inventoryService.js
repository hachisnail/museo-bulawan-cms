import { baseService } from './baseService.js';
import { db } from '../../config/db.js';
import { notificationService } from '../notificationService.js';
import { logger } from '../../utils/logger.js';
import { globalMutex } from '../../utils/mutex.js';
import { generateCatalogNumber } from '../../utils/sequenceGenerator.js';
import { assertTransition } from '../../utils/stateMachine.js';
import { documentService } from '../documentService.js';
import { auditService } from '../auditService.js';

export const inventoryService = {
    async validateLocationName(locationName, connection = null) {
        if (!locationName || typeof locationName !== 'string') {
            throw new Error('VALIDATION_FAILED: Invalid location name.');
        }

        const trimmedLocation = locationName.trim();
        const lowerLocation = trimmedLocation.toLowerCase();

        // Whitelisted pre-custody or off-site locations that don't need to be in the locations table
        const whitelist = [
            'pending documentation (with donor)',
            'with donor (awaiting delivery)',
            'n/a (new entry)',
            'off-site / deaccessioned'
        ];

        if (whitelist.includes(lowerLocation)) {
            return;
        }

        // Query the database to see if the location name exists (case-insensitive check)
        const check = await db.query(
            'SELECT name FROM locations WHERE LOWER(name) = ?',
            [lowerLocation],
            connection
        );

        if (!check || check.length === 0) {
            throw new Error(`VALIDATION_FAILED: The location "${trimmedLocation}" does not exist in the system.`);
        }
    },

    // ==========================================
    // PHASE 4: Finalize to Active Inventory
    // ==========================================
    async finalizeToInventory(staffId, accessionId, inventoryData) {
        return await globalMutex.runExclusive(`accession_${accessionId}`, async () => {
            try {
                return await db.transaction(async (tx) => {
                    const accession = await baseService._getRecord('accessions', accessionId, {}, tx);
                    assertTransition('accession', accession.status, 'finalized');

                    const existing = await tx.query('SELECT * FROM inventory WHERE accession_id = ?', [accessionId]);
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

                    if (!accession.signed_moa) {
                        throw new Error("Cannot finalize. Signed MOA document must be uploaded.");
                    }
                    if (!accession.research_completed) {
                        throw new Error("Cannot finalize. Curatorial research must be marked as completed.");
                    }

                    const media = await tx.query(`
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

                    await this.validateLocationName(location, tx);

                    const inventory = await baseService._createRecord(staffId, 'inventory', {
                        accession_id: accession.id,
                        catalog_number: catalogNumber,
                        current_location: location,
                        status: 'active',
                        last_audit_date: new Date().toISOString().slice(0, 10),
                        last_audited_by: staffId,
                        deaccession_reason: skipReason ? `Image Skipped: ${skipReason}` : null 
                    }, tx);

                    const conditionReports = await baseService.getConditionReports('accession', accessionId, tx);
                    if (conditionReports.items?.length > 0) {
                        const latestCondition = conditionReports.items[0];
                        await baseService.createConditionReport(staffId, 'inventory', inventory.id, latestCondition.condition_status, latestCondition.notes, null, '', {}, tx);
                    } else if (inventoryData.conditionReport) {
                        await baseService.createConditionReport(staffId, 'inventory', inventory.id, inventoryData.conditionReport, '', null, '', {}, tx);
                    }

                    await baseService._createRecord(staffId, 'location_history', {
                        inventory_item_id: inventory.id,
                        from_location: 'N/A (New Entry)',
                        to_location: location,
                        reason: 'Initial cataloging',
                        moved_by: staffId
                    }, tx);

                    await this._autoDeriveArtifactStatus(staffId, inventory.id, tx);

                    await baseService._transitionRecord(staffId, 'accession', 'accessions', accessionId, 'finalized', {}, tx);

                    notificationService.sendGlobal('New Artifact Cataloged', 
                        `Item ${catalogNumber} has been moved to ${location}.`, 'success', { actionUrl: `/inventory?id=${inventory.id}` });
                    
                    return inventory;
                });
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
        await this.validateLocationName(toLocation);

        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const inventory = await baseService._getRecord('inventory', inventoryId);
            
            if (inventory.status === 'deaccessioned') {
                throw new Error('Cannot move a deaccessioned item.');
            }

            const fromLocation = inventory.current_location;

            const updated = await db.transaction(async (tx) => {
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

                await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                    current_location: toLocation
                }, tx);

                return await this._autoDeriveArtifactStatus(staffId, inventoryId, tx);
            });

            return updated;
        });
    },

    // ==========================================
    // BATCH OPERATIONS
    // ==========================================
    async batchTransfer(staffId, inventoryIds, toLocation, reason, extra = {}) {
        if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
            throw new Error('VALIDATION_FAILED: No inventory IDs provided for batch transfer.');
        }

        await this.validateLocationName(toLocation);

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
                    const updated = await baseService._updateRecord(staffId, 'inventory', id, {
                        current_location: toLocation
                    }, tx);

                    // 3. Auto-derive status
                    const derived = await this._autoDeriveArtifactStatus(staffId, id, tx);
                    
                    results.push(derived);
                }

                notificationService.sendGlobal('Batch Movement Completed', 
                    `${inventoryIds.length} artifacts have been moved to ${toLocation}.`, 'info', { actionUrl: '/inventory' });

                return { count: results.length, items: results };
            });
        });
    },

    // ==========================================
    // DEACCESSION (SPECTRUM: Deaccession & Disposal)
    // ==========================================
    async deaccessionItem(staffId, inventoryId, reason) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await baseService._getRecord('inventory', inventoryId);
            if (item.status === 'deaccessioned') throw new Error('ALREADY_DEACCESSIONED');

            assertTransition('inventory', item.status, 'deaccession_pending');

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
            try {
                return await db.transaction(async (tx) => {
                    const item = await baseService._getRecord('inventory', inventoryId, {}, tx);
                    assertTransition('inventory', item.status, 'deaccessioned');

                    await baseService._createRecord(staffId, 'location_history', {
                        inventory_item_id: inventoryId,
                        from_location: item.current_location,
                        to_location: 'OFF-SITE / DEACCESSIONED',
                        movement_type: 'Deaccession',
                        reason: item.deaccession_reason,
                        moved_by: staffId
                    }, tx);

                    return await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                        status: 'deaccessioned',
                        deaccession_date: new Date().toISOString().slice(0, 10)
                    }, tx);
                });
            } catch (error) {
                logger.error(`Error approving deaccession: ${error.message}`);
                throw error;
            }
        });
    },

    /**
     * Cancel a pending deaccession, restoring the item to active status.
     * SPECTRUM requires that disposal can be cancelled at any point before execution.
     */
    async cancelDeaccession(staffId, inventoryId) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            const item = await baseService._getRecord('inventory', inventoryId);
            assertTransition('inventory', item.status, 'active');

            const updated = await db.transaction(async (tx) => {
                await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                    status: 'active',
                    deaccession_reason: null
                }, tx);

                return await this._autoDeriveArtifactStatus(staffId, inventoryId, tx);
            });

            notificationService.sendToRole('admin', 'Deaccession Cancelled', 
                `Deaccession for ${item.catalog_number} has been cancelled by staff.`, 'info', { actionUrl: `/inventory?id=${inventoryId}` });

            return updated;
        });
    },

    // ==========================================
    // MOVEMENT HISTORY & CONSERVATION (SPECTRUM: Location & Movement Control)
    // ==========================================
    async getMovementHistory(inventoryId, connection = null) {
        return await baseService._listRecords('location_history', {
            filter: `inventory_item_id="${inventoryId}"`
        }, connection);
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
    // INVENTORY AUDIT / SPOT CHECK (SPECTRUM: Inventory procedure)
    // 
    // Per SPECTRUM 5.0, museums must periodically verify that:
    //   1. The object physically exists at its recorded location
    //   2. The catalog number is legible/attached
    //   3. The object matches its description
    //   4. The condition is consistent with the last report
    //
    // This records the result of such a check for a single item.
    // ==========================================
    async recordAuditCheck(staffId, inventoryId, auditData) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            try {
                return await db.transaction(async (tx) => {
                    const item = await baseService._getRecord('inventory', inventoryId, {}, tx);

                    // If audited location is provided, validate it first
                    if (auditData.auditedLocation) {
                        await this.validateLocationName(auditData.auditedLocation, tx);
                    }

                    const auditRecord = await baseService._createRecord(staffId, 'inventory_audits', {
                        inventory_item_id: inventoryId,
                        audit_type: auditData.auditType || 'spot_check',
                        location_verified: auditData.locationVerified ?? true,
                        object_found: auditData.objectFound ?? true,
                        number_legible: auditData.numberLegible ?? true,
                        condition_consistent: auditData.conditionConsistent ?? true,
                        discrepancy_notes: auditData.discrepancyNotes || null,
                        audited_location: auditData.auditedLocation || item.current_location,
                        audited_by: staffId
                    }, tx);

                    // Update the inventory record's last-audit timestamp
                    await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                        last_audit_date: new Date().toISOString().slice(0, 10),
                        last_audited_by: staffId
                    }, tx);

                    // If the object was NOT found at the expected location, flag it
                    if (!auditData.objectFound) {
                        notificationService.sendToRole('admin', 'Audit Discrepancy: Object Not Found',
                            `Artifact ${item.catalog_number} was not found at ${item.current_location} during ${auditData.auditType || 'spot check'}.`,
                            'error', { actionUrl: `/inventory?id=${inventoryId}` });
                    }

                    // If the object was found but location doesn't match records, auto-correct
                    if (auditData.objectFound && !auditData.locationVerified && auditData.auditedLocation) {
                        logger.warn(`Audit location mismatch for ${item.catalog_number}: expected ${item.current_location}, found at ${auditData.auditedLocation}`);
                        
                        await baseService._createRecord(staffId, 'location_history', {
                            inventory_item_id: inventoryId,
                            from_location: item.current_location,
                            to_location: auditData.auditedLocation,
                            movement_type: 'Audit Correction',
                            reason: `Location corrected during ${auditData.auditType || 'spot check'}: ${auditData.discrepancyNotes || 'Location mismatch'}`,
                            moved_by: staffId
                        }, tx);

                        await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                            current_location: auditData.auditedLocation
                        }, tx);
                    }

                    // If condition is inconsistent, trigger a formal condition check
                    if (!auditData.conditionConsistent && auditData.observedCondition) {
                        await baseService.createConditionReport(
                            staffId, 'inventory', inventoryId,
                            auditData.observedCondition,
                            `Flagged during ${auditData.auditType || 'spot check'}: ${auditData.discrepancyNotes || 'Condition changed'}`,
                            null, '', {}, tx
                        );
                    }

                    await this._autoDeriveArtifactStatus(staffId, inventoryId, tx);

                    return auditRecord;
                });
            } catch (error) {
                logger.error(`Error recording audit check: ${error.message}`);
                throw error;
            }
        });
    },

    /**
     * Retrieves audit history for a single inventory item.
     */
    async getAuditHistory(inventoryId) {
        return await baseService._listRecords('inventory_audits', {
            filter: `inventory_item_id="${inventoryId}"`
        });
    },

    /**
     * SPECTRUM: Items overdue for periodic audit.
     * Returns artifacts that have not been audited within a given number of days.
     * Industry standard is typically 12–36 months depending on collection value.
     */
    async getOverdueAudits(thresholdDays = 365) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - thresholdDays);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const rows = await db.query(`
            SELECT i.*, a.accession_number
            FROM inventory i
            LEFT JOIN accessions a ON i.accession_id = a.id
            WHERE i.status != 'deaccessioned'
              AND (i.last_audit_date IS NULL OR i.last_audit_date < ?)
            ORDER BY i.last_audit_date ASC
            LIMIT 100
        `, [cutoffStr]);

        return { 
            items: rows, 
            totalItems: rows.length,
            thresholdDays,
            cutoffDate: cutoffStr
        };
    },

    // ==========================================
    // OBJECT SUMMARY (Aggregated compliance snapshot)
    // 
    // Provides a single-call view of an artifact's full state:
    //  - Core record data
    //  - Latest condition
    //  - Movement count & last move
    //  - Conservation log count & next review
    //  - Valuation
    //  - Active loans
    //  - Audit status
    //  - Exhibition history count
    // ==========================================
    async getObjectSummary(inventoryId) {
        const item = await baseService._getRecord('inventory', inventoryId, { expand: 'accession_id.intake_id' });

        // Latest condition report
        const conditionRes = await baseService.getConditionReports('inventory', inventoryId);
        const latestCondition = conditionRes.items?.[0] || null;

        // Movement history summary
        const movements = await this.getMovementHistory(inventoryId);
        const lastMove = movements.items?.[0] || null;

        // Conservation summary
        const conservationRes = await this.getConservationLogs(inventoryId);
        const nextReview = conservationRes.items?.find(log => 
            log.next_review_date && new Date(log.next_review_date) > new Date()
        ) || null;

        // Latest valuation
        const valuations = await db.query(
            'SELECT * FROM valuations WHERE inventory_id = ? ORDER BY valuation_date DESC LIMIT 1',
            [inventoryId]
        );
        const latestValuation = valuations?.[0] || null;

        // Active loan check
        const activeLoans = await db.query(`
            SELECT l.* FROM loans l
            INNER JOIN loan_artifacts la ON la.loan_id = l.id
            WHERE la.inventory_id = ? AND l.status = 'active'
        `, [inventoryId]);

        // Audit history summary
        const audits = await db.query(
            'SELECT * FROM inventory_audits WHERE inventory_item_id = ? ORDER BY created_at DESC LIMIT 1',
            [inventoryId]
        );
        const lastAudit = audits?.[0] || null;

        // Exhibition count
        const exhibitionCount = await db.query(
            'SELECT COUNT(*) as count FROM exhibition_artifacts WHERE inventory_id = ?',
            [inventoryId]
        );

        // Media count
        const mediaCount = await db.query(
            `SELECT COUNT(*) as count FROM media_links WHERE entity_type = 'inventory' AND entity_id = ?`,
            [inventoryId]
        );

        return {
            item,
            compliance: {
                condition: {
                    latest: latestCondition,
                    status: latestCondition?.condition_status || 'Unknown'
                },
                movement: {
                    totalMoves: movements.totalItems,
                    lastMove: lastMove ? {
                        from: lastMove.from_location,
                        to: lastMove.to_location,
                        date: lastMove.created_at,
                        movedBy: lastMove.moved_by
                    } : null
                },
                conservation: {
                    totalTreatments: conservationRes.totalItems,
                    nextScheduledReview: nextReview?.next_review_date || null,
                    isOverdueForReview: nextReview ? new Date(nextReview.next_review_date) < new Date() : false
                },
                valuation: {
                    current: latestValuation ? {
                        amount: latestValuation.amount,
                        currency: latestValuation.currency,
                        date: latestValuation.valuation_date,
                        reason: latestValuation.valuation_reason
                    } : null,
                    hasValuation: !!latestValuation
                },
                loans: {
                    isOnLoan: activeLoans.length > 0,
                    activeLoans: activeLoans
                },
                audit: {
                    lastAuditDate: item.last_audit_date || null,
                    lastAuditedBy: item.last_audited_by || null,
                    lastAuditResult: lastAudit ? {
                        objectFound: lastAudit.object_found,
                        locationVerified: lastAudit.location_verified,
                        conditionConsistent: lastAudit.condition_consistent,
                        date: lastAudit.created_at
                    } : null,
                    isOverdue: !item.last_audit_date || 
                        (new Date() - new Date(item.last_audit_date)) > (365 * 24 * 60 * 60 * 1000)
                },
                media: {
                    imageCount: Number(mediaCount[0]?.count || 0)
                },
                exhibitions: {
                    totalExhibitions: Number(exhibitionCount[0]?.count || 0)
                }
            }
        };
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
            
            assertTransition('inventory', item.status, newStatus);

            return await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                status: newStatus,
                ...(isManual ? { manual_status_override: true } : {})
            });
        });
    },

    async autoDeriveArtifactStatus(staffId, inventoryId) {
        return await globalMutex.runExclusive(`inventory_${inventoryId}`, async () => {
            return await this._autoDeriveArtifactStatus(staffId, inventoryId);
        });
    },

    async _autoDeriveArtifactStatus(staffId, inventoryId, connection = null) {
        const item = await baseService._getRecord('inventory', inventoryId, {}, connection);
        
        if (item.manual_status_override) {
            logger.info(`Skipping auto-derivation for artifact ${inventoryId} due to manual override.`);
            return item;
        }

        const healthReports = await baseService.getConditionReports('inventory', inventoryId, connection);
        const latestHealth = healthReports.items?.[0];

        const movementHistory = await this.getMovementHistory(inventoryId, connection);
        const latestMovement = movementHistory.items?.[0];

        let derivedStatus = 'active';

        if (latestMovement) {
            const loc = (latestMovement.to_location || '').toLowerCase();
            if (loc.includes('loan')) {
                derivedStatus = 'loan';
            } else if (loc.includes('storage') || loc.includes('vault')) {
                derivedStatus = 'storage';
            }
        }

        if (latestHealth && derivedStatus !== 'loan') {
            const condition = latestHealth.condition_status;
            if (condition === 'Critical' || condition === 'Poor') {
                derivedStatus = 'maintenance';
            }
        }

        if (item.status === 'deaccessioned' || item.status === 'deaccession_pending') {
            derivedStatus = item.status;
        }

        if (item.status !== derivedStatus) {
            logger.info(`Auto-deriving status for ${inventoryId}: ${item.status} -> ${derivedStatus}`);
            await baseService._updateRecord(staffId, 'inventory', inventoryId, {
                status: derivedStatus
            }, connection);
            return await baseService._getRecord('inventory', inventoryId, {}, connection);
        }

        return item;
    },

    // ==========================================
    // REPORT GENERATION & EXPORT
    // ==========================================
    /**
     * Generates a report for an inventory item in the specified format.
     * @param {string} inventoryId
     * @param {'html'|'docx'} [format='html']
     */
    async getReport(inventoryId, format = 'html') {
        const inventory = await baseService._getRecord('inventory', inventoryId);
        const accession = await baseService._getRecord('accessions', inventory.accession_id);
        const intake = await baseService._getRecord('intakes', accession.intake_id);
        const movementRes = await this.getMovementHistory(inventoryId);
        
        return await documentService.generateInventoryReport(inventory, accession, intake, movementRes.items, format);
    },

    // Legacy aliases for backward compatibility with existing controllers
    async generateReport(inventoryId) {
        return this.getReport(inventoryId, 'html');
    },

    async exportReport(inventoryId) {
        return this.getReport(inventoryId, 'docx');
    },

    // ==========================================
    // CONDITION & DEACCESSION REPORTS
    // ==========================================

    async getConditionReportDocument(inventoryId, format = 'html') {
        const inventory = await baseService._getRecord('inventory', inventoryId);
        const accession = await baseService._getRecord('accessions', inventory.accession_id);
        const conditionLogs = await this.getConditionReports('inventory', inventoryId);
        
        return await documentService.generateConditionReport(inventory, accession, conditionLogs.items, format);
    },

    async getDeaccessionReport(inventoryId, format = 'html') {
        const inventory = await baseService._getRecord('inventory', inventoryId);
        const accession = await baseService._getRecord('accessions', inventory.accession_id);
        
        return await documentService.generateDeaccessionReport(inventory, accession, format);
    }
};