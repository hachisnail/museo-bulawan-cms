import { acquisitionService } from '../../services/acquisitionService.js';
import { mapDTO } from '../../utils/dtoMapper.js';

/**
 * InventoryController
 * 
 * Handles active inventory management: cataloging, status updates, transfers, and deaccessioning.
 */
export const inventoryController = {
    /**
     * GET /inventory
     * 
     * Supports query parameters:
     *   ?status=active|loan|maintenance|storage   — Filter by artifact status
     *   ?location=Gallery+A                       — Filter by current location
     *   ?search=text                              — Search by catalog number (LIKE)
     *   ?page=1&perPage=50                        — Pagination
     *   ?expand=accession_id.intake_id            — Expand relations (default)
     * 
     * Note: Deaccessioned items are excluded by default. Use /inventory/archive instead.
     */
    async listInventory(req, res, next) {
        try {
            const filters = ['status!="deaccessioned"'];

            if (req.query.status) filters.push(`status="${req.query.status}"`);
            if (req.query.location) filters.push(`current_location="${req.query.location}"`);
            if (req.query.search) filters.push(`catalog_number~"${req.query.search}"`);

            const query = { 
                page: req.query.page,
                perPage: req.query.perPage,
                expand: req.query.expand || 'accession_id.intake_id',
                filter: filters.join(' && ')
            };
            const result = await acquisitionService._listRecords('inventory', query);
            res.status(200).json({ status: 'success', data: mapDTO(result) });
        } catch (error) { next(error); }
    },

    /**
     * GET /inventory/archive
     * 
     * Supports the same query parameters as listInventory but only returns deaccessioned items.
     */
    async listDeaccessioned(req, res, next) {
        try {
            const filters = ['status="deaccessioned"'];

            if (req.query.search) filters.push(`catalog_number~"${req.query.search}"`);
            if (req.query.location) filters.push(`current_location="${req.query.location}"`);

            const query = { 
                page: req.query.page,
                perPage: req.query.perPage,
                expand: req.query.expand || 'accession_id.intake_id',
                filter: filters.join(' && ')
            };
            const result = await acquisitionService._listRecords('inventory', query);
            res.status(200).json({ status: 'success', data: mapDTO(result) });
        } catch (error) { next(error); }
    },

    async getInventoryItem(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const item = await acquisitionService.getInventoryItem(inventoryId, req.query);
            res.status(200).json({ status: 'success', data: mapDTO(item) });
        } catch (error) { next(error); }
    },

    async finalizeInventory(req, res, next) {
        try {
            const { accessionId } = req.params;
            const inventory = await acquisitionService.finalizeToInventory(req.user.id, accessionId, req.body);
            res.status(201).json({ 
                message: "Artifact fully cataloged into active inventory.", 
                inventory: mapDTO(inventory) 
            });
        } catch (error) { 
            if (error.message.includes('Missing required research fields') || error.message.includes('Cannot finalize')) {
                return res.status(400).json({ error: error.message });
            }
            next(error); 
        }
    },

    async transferLocation(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const item = await acquisitionService.transferLocation(req.user.id, inventoryId, req.body.toLocation, req.body.reason);
            res.status(200).json({ message: "Location updated.", item: mapDTO(item) });
        } catch (error) { next(error); }
    },

    async deaccessionItem(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const item = await acquisitionService.deaccessionItem(req.user.id, inventoryId, req.body.reason);
            res.status(200).json({ message: "Item deaccessioned.", item: mapDTO(item) });
        } catch (error) { next(error); }
    },

    async updateArtifactStatus(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const { status, isManual, reason } = req.body;
            const item = await acquisitionService.updateArtifactStatus(req.user.id, inventoryId, status, isManual, reason);
            res.status(200).json({ message: "Artifact status updated successfully.", item: mapDTO(item) });
        } catch (error) { next(error); }
    },

    async generateReport(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const html = await acquisitionService.generateInventoryReport(inventoryId);
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(html);
        } catch (error) { next(error); }
    },

    async exportReport(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const buffer = await acquisitionService.exportInventoryReport(inventoryId);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=Inventory_Report_${inventoryId}.docx`);
            res.status(200).send(buffer);
        } catch (error) { next(error); }
    },

    async exportConditionReport(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const buffer = await acquisitionService.getConditionReportDocument(inventoryId, 'docx');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=Condition_Report_${inventoryId}.docx`);
            res.status(200).send(buffer);
        } catch (error) { next(error); }
    },

    async exportDeaccessionReport(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const buffer = await acquisitionService.getDeaccessionReport(inventoryId, 'docx');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=Deaccession_Report_${inventoryId}.docx`);
            res.status(200).send(buffer);
        } catch (error) { next(error); }
    },

    // ==========================================
    // INVENTORY AUDIT (SPECTRUM: Inventory procedure)
    // ==========================================

    /**
     * POST /inventory/:inventoryId/audit
     * Records the result of a physical audit/spot check for a single item.
     */
    async recordAuditCheck(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const result = await acquisitionService.recordAuditCheck(req.user.id, inventoryId, req.body);
            res.status(201).json({ 
                message: 'Audit check recorded.', 
                audit: result 
            });
        } catch (error) { next(error); }
    },

    /**
     * GET /inventory/:inventoryId/audits
     * Returns the audit history for a specific inventory item.
     */
    async getAuditHistory(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const result = await acquisitionService.getAuditHistory(inventoryId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    /**
     * GET /inventory/overdue-audits
     * Returns items that are overdue for their periodic inventory check.
     */
    async getOverdueAudits(req, res, next) {
        try {
            const thresholdDays = parseInt(req.query.days) || 365;
            const result = await acquisitionService.getOverdueAudits(thresholdDays);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    // ==========================================
    // OBJECT SUMMARY (Aggregated compliance view)
    // ==========================================

    /**
     * GET /inventory/:inventoryId/summary
     * Returns a complete compliance snapshot for a single artifact.
     */
    async getObjectSummary(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const result = await acquisitionService.getObjectSummary(inventoryId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    // ==========================================
    // DEACCESSION MANAGEMENT
    // ==========================================

    /**
     * POST /inventory/:inventoryId/approve-deaccession
     */
    async approveDeaccession(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const result = await acquisitionService.approveDeaccession(req.user.id, inventoryId);
            res.status(200).json({ message: 'Deaccession approved. Item removed from active collection.', item: result });
        } catch (error) { next(error); }
    },

    /**
     * POST /inventory/:inventoryId/cancel-deaccession
     */
    async cancelDeaccession(req, res, next) {
        try {
            const { inventoryId } = req.params;
            const result = await acquisitionService.cancelDeaccession(req.user.id, inventoryId);
            res.status(200).json({ message: 'Deaccession cancelled. Item restored to active status.', item: result });
        } catch (error) { next(error); }
    }
};
