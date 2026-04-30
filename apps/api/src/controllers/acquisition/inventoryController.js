import { acquisitionService } from '../../services/acquisitionService.js';
import { mapDTO } from '../../utils/dtoMapper.js';

/**
 * InventoryController
 * 
 * Handles active inventory management: cataloging, status updates, transfers, and deaccessioning.
 */
export const inventoryController = {
    async listInventory(req, res, next) {
        try {
            // By default, exclude deaccessioned items from the active inventory list
            const filter = req.query.filter ? `(${req.query.filter}) && status != "deaccessioned"` : 'status != "deaccessioned"';
            const query = { 
                ...req.query, 
                filter,
                expand: req.query.expand || 'accession_id.intake_id' 
            };
            const result = await acquisitionService._listRecords('inventory', query);
            res.status(200).json({ status: 'success', data: mapDTO(result) });
        } catch (error) { next(error); }
    },

    async listDeaccessioned(req, res, next) {
        try {
            // Explicitly only show deaccessioned items in the archive
            const filter = req.query.filter ? `(${req.query.filter}) && status = "deaccessioned"` : 'status = "deaccessioned"';
            const query = { 
                ...req.query, 
                filter,
                expand: req.query.expand || 'accession_id.intake_id' 
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
    }
};
