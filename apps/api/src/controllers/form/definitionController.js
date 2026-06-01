import { definitionService } from '../../services/form/definitionService.js';
import { db } from '../../config/db.js';
import { schemas } from './schemas.js';

export const definitionController = {
    async listDefinitions(req, res, next) {
        try {
            const result = await definitionService.listDefinitions();
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    },

    async createDefinition(req, res, next) {
        try {
            const { error, value } = schemas.createDefinition.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            // Check if slug is unique
            try {
                await definitionService.getFormDefinition(value.slug);
                return res.status(400).json({ error: `Form definition with slug '${value.slug}' already exists.` });
            } catch (err) {
                // Ignore if not found, it means slug is unique
            }

            const result = await definitionService.createDefinition(value);
            res.status(201).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    },

    async updateDefinition(req, res, next) {
        try {
            const { id } = req.params;
            const { error, value } = schemas.updateDefinition.validate(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            // If slug is changing, verify uniqueness
            if (value.slug) {
                try {
                    const existing = await definitionService.getFormDefinition(value.slug);
                    if (existing && existing.id !== id) {
                        return res.status(400).json({ error: `Form definition with slug '${value.slug}' already exists.` });
                    }
                } catch (err) {
                    // Ignore if not found
                }
            }

            const result = await definitionService.updateDefinition(id, value);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    },

    async deleteDefinition(req, res, next) {
        try {
            const { id } = req.params;
            await definitionService.deleteDefinition(id);
            res.status(200).json({ status: 'success', message: "Form definition deleted successfully." });
        } catch (error) {
            next(error);
        }
    },

    async exportSubmissions(req, res, next) {
        try {
            const { slug } = req.query;
            if (!slug) {
                return res.status(400).json({ error: "slug query parameter is required" });
            }

            const definition = await definitionService.getFormDefinition(slug);
            const submissions = await db.query(
                `SELECT * FROM form_submissions WHERE form_id = ? AND status != 'pending' ORDER BY created_at DESC`, 
                [definition.id]
            );

            // Extract properties from schema to define table columns
            const properties = definition.schema_data?.properties || {};
            const schemaKeys = Object.keys(properties);
            const columns = ['submission_id', 'submitted_email', 'status', 'created_at', ...schemaKeys];

            // Generate CSV header row
            // We write a robust CSV generator manually to avoid dependency issues
            let csvLines = [];
            
            // Map headers to capitalize or keep key name
            const headers = columns.map(col => {
                if (col === 'submission_id') return 'Submission ID';
                if (col === 'submitted_email') return 'Email Address';
                if (col === 'status') return 'Status';
                if (col === 'created_at') return 'Submission Date';
                return properties[col]?.title || col;
            });
            
            csvLines.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

            // Generate CSV rows
            for (const sub of submissions) {
                let data = {};
                try {
                    data = typeof sub.data === 'string' ? JSON.parse(sub.data) : (sub.data || {});
                } catch (e) {
                    data = sub.data || {};
                }

                const row = columns.map(col => {
                    let val = '';
                    if (col === 'submission_id') {
                        val = sub.id;
                    } else if (col === 'submitted_email') {
                        val = sub.submitted_email || '';
                    } else if (col === 'status') {
                        val = sub.status || '';
                    } else if (col === 'created_at') {
                        val = sub.created_at || '';
                    } else if (col in data) {
                        val = data[col];
                    }

                    // Format value for CSV
                    if (val instanceof Date) {
                        val = val.toISOString();
                    } else if (typeof val === 'object' && val !== null) {
                        val = JSON.stringify(val);
                    } else {
                        val = String(val ?? '');
                    }

                    // Clean and escape value
                    val = val.replace(/"/g, '""');
                    return `"${val}"`;
                });
                csvLines.push(row.join(','));
            }

            const csvContent = csvLines.join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=submissions-${slug}.csv`);
            return res.status(200).send(csvContent);
        } catch (error) {
            next(error);
        }
    }
};
