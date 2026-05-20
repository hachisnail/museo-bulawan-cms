import { acquisitionService } from '../../services/acquisitionService.js';
import { mapDTO } from '../../utils/dtoMapper.js';

/**
 * AccessionController
 * 
 * Handles formal accessioning, research data updates, and formal report generation.
 */
export const accessionController = {
    /**
     * GET /accessions
     * 
     * Supports query parameters:
     *   ?status=pending_approval|in_research|finalized  — Filter by accession status
     *   ?contractType=deed_of_gift|loan_agreement       — Filter by contract type
     *   ?search=text                                    — Search by accession number (LIKE)
     *   ?tag=tag_name                                   — Filter by tag
     *   ?page=1&perPage=50                              — Pagination
     *   ?expand=intake_id                               — Expand relations
     */
    async listAccessions(req, res, next) {
        try {
            const filters = [];
            if (req.query.status) filters.push(`status="${req.query.status}"`);
            if (req.query.contractType) filters.push(`contract_type="${req.query.contractType}"`);
            if (req.query.search) filters.push(`accession_number~"${req.query.search}"`);
            if (req.query.legalStatus) filters.push(`legal_status="${req.query.legalStatus}"`);

            const query = {
                page: req.query.page,
                perPage: req.query.perPage,
                expand: req.query.expand || 'intake_id',
                filter: filters.length > 0 ? filters.join(' && ') : req.query.filter
            };

            const result = await acquisitionService._listRecords('accessions', query);
            res.status(200).json({ status: 'success', data: mapDTO(result) });
        } catch (error) { next(error); }
    },

    async getAccessionItem(req, res, next) {
        try {
            const { accessionId } = req.params;
            const item = await acquisitionService.getAccessionItem(accessionId, req.query);
            res.status(200).json({ status: 'success', data: mapDTO(item) });
        } catch (error) { next(error); }
    },

    async uploadMOA(req, res, next) {
        try {
            const { accessionId } = req.params;
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: "No file provided." });
            }
            const accession = await acquisitionService.uploadMOA(req.user.id, accessionId, req.files);
            res.status(200).json({ message: "Signed MOA uploaded successfully.", accession: mapDTO(accession) });
        } catch (error) { next(error); }
    },

    async processAccession(req, res, next) {
        try {
            const { intakeId } = req.params;
            const accession = await acquisitionService.processAccession(req.user.id, intakeId, req.body);
            res.status(201).json({ message: "Artifact formally accessioned.", accession: mapDTO(accession) });
        } catch (error) { next(error); }
    },

    async approveAccession(req, res, next) {
        try {
            const { accessionId } = req.params;
            const accession = await acquisitionService.approveAccession(req.user.id, accessionId, req.body.notes);
            res.status(200).json({ message: "Accession approved and moved to research.", accession: mapDTO(accession) });
        } catch (error) { next(error); }
    },

    async updateResearch(req, res, next) {
        try {
            const { accessionId } = req.params;
            const accession = await acquisitionService.updateAccessionResearch(req.user.id, accessionId, req.body);
            res.status(200).json({ message: "Research notes saved.", accession: mapDTO(accession) });
        } catch (error) { next(error); }
    },

    async generateReport(req, res, next) {
        try {
            const { accessionId } = req.params;
            const html = await acquisitionService.generateFormalReport(accessionId);
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(html);
        } catch (error) { next(error); }
    },

    async exportReport(req, res, next) {
        try {
            const { accessionId } = req.params;
            const buffer = await acquisitionService.exportFormalReport(accessionId);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=ACCESSION_REPORT_${accessionId}.docx`);
            res.status(200).send(buffer);
        } catch (error) { next(error); }
    },

    rollbackAccession: async (req, res, next) => {
        try {
            const { accessionId } = req.params;
            const result = await acquisitionService.rollbackAccession(req.user.id, accessionId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    async getFullChain(req, res, next) {
        try {
            const { intakeId } = req.params;
            const chain = await acquisitionService.getFullChain(intakeId);
            res.status(200).json({ status: 'success', data: mapDTO(chain) });
        } catch (error) { next(error); }
    },
    
    async getUniqueTags(req, res, next) {
        try {
            const { db } = await import('../../config/db.js');
            const accTags = await db.query('SELECT tags FROM accessions WHERE tags IS NOT NULL');
            const invTags = await db.query('SELECT tags FROM inventory WHERE tags IS NOT NULL');
            
            const allTags = new Set();
            [...accTags, ...invTags].forEach(row => {
                try {
                    const parsed = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
                    if (Array.isArray(parsed)) {
                        parsed.forEach(t => allTags.add(t));
                    }
                } catch (e) {}
            });
            
            res.status(200).json({ status: 'success', data: Array.from(allTags).sort() });
        } catch (error) { next(error); }
    }
};
