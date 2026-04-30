import { db } from '../config/db.js';
import { mapDTO } from '../utils/dtoMapper.js';

export const analyticsController = {
    async getAcquisitionStats(req, res, next) {
        try {
            const { startDate, endDate } = req.query;
            let dateFilter = '';
            const params = [];

            if (startDate && endDate) {
                dateFilter = 'WHERE created_at BETWEEN ? AND ?';
                params.push(startDate, endDate);
            }

            // 1. Overview Totals
            const [intakeCount] = await db.query(`SELECT COUNT(*) as count FROM intakes ${dateFilter}`, params);
            const [accessionCount] = await db.query(`SELECT COUNT(*) as count FROM accessions ${dateFilter}`, params);
            const [inventoryCount] = await db.query(`SELECT COUNT(*) as count FROM inventory ${dateFilter}`, params);

            // 2. Intake Status Distribution
            const intakeDistribution = await db.query(`
                SELECT status, COUNT(*) as count 
                FROM intakes 
                ${dateFilter}
                GROUP BY status
            `, params);

            // 3. Acquisition Methods
            const methods = await db.query(`
                SELECT acquisition_method as method, COUNT(*) as count 
                FROM intakes 
                ${dateFilter}
                GROUP BY acquisition_method
            `, params);

            // 4. Monthly Growth (Last 6 months)
            const growth = await db.query(`
                SELECT 
                    DATE_FORMAT(created_at, '%Y-%m') as month,
                    COUNT(*) as count
                FROM inventory
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY month
                ORDER BY month ASC
            `);

            // 5. Object Type Distribution (from Accessions)
            const categories = await db.query(`
                SELECT object_type, COUNT(*) as count 
                FROM accessions 
                WHERE object_type IS NOT NULL
                GROUP BY object_type
            `);

            res.status(200).json({
                status: 'success',
                data: {
                    totals: {
                        intakes: intakeCount.count,
                        accessions: accessionCount.count,
                        inventory: inventoryCount.count
                    },
                    distributions: {
                        intakeStatus: intakeDistribution,
                        methods: methods,
                        categories: categories
                    },
                    trends: {
                        monthlyGrowth: growth
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    },
    async getCollectionHealth(req, res, next) {
        try {
            // 1. Distribution of health states
            const healthDist = await db.query(`
                SELECT condition_status as state, COUNT(*) as count 
                FROM condition_reports 
                WHERE entity_type = 'inventory'
                GROUP BY condition_status
            `);

            // 2. Artifacts requiring maintenance
            const [maintenanceCount] = await db.query(`SELECT COUNT(*) as count FROM inventory WHERE status = 'maintenance'`);
            const [totalCount] = await db.query(`SELECT COUNT(*) as count FROM inventory`);

            // 3. Last 10 conservation actions
            const recentTreatments = await db.query(`
                SELECT cl.*, i.catalog_number, i.id as inventory_id
                FROM conservation_logs cl
                JOIN inventory i ON cl.inventory_item_id = i.id
                ORDER BY cl.created_at DESC
                LIMIT 10
            `);

            res.status(200).json({
                status: 'success',
                data: {
                    healthDistribution: healthDist,
                    maintenanceRequired: maintenanceCount.count,
                    totalInventory: totalCount.count,
                    healthPercentage: totalCount.count > 0 ? ((totalCount.count - maintenanceCount.count) / totalCount.count * 100).toFixed(2) : 100,
                    recentTreatments
                }
            });
        } catch (error) { next(error); }
    },
    async getValuationSummary(req, res, next) {
        try {
            // 1. Total Collection Value (Sum of latest valuations per item)
            const totalValue = await db.query(`
                SELECT SUM(amount) as total, currency
                FROM valuations v
                WHERE v.id IN (
                    SELECT MAX(id) FROM valuations GROUP BY inventory_id
                )
                GROUP BY currency
            `);

            // 2. Valuation Reasons Distribution
            const reasonDist = await db.query(`
                SELECT valuation_reason as reason, COUNT(*) as count
                FROM valuations
                GROUP BY valuation_reason
            `);

            res.status(200).json({
                status: 'success',
                data: {
                    totalValue,
                    reasonDistribution: reasonDist
                }
            });
        } catch (error) { next(error); }
    }
};
