import { db } from '../config/db.js';
import { mapDTO } from '../utils/dtoMapper.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { umamiService } from '../services/umamiService.js';

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
            const healthDist = await db.query(`
                SELECT condition_status as state, COUNT(*) as count 
                FROM condition_reports 
                WHERE entity_type = 'inventory'
                  AND id IN (
                      SELECT MAX(id) 
                      FROM condition_reports 
                      WHERE entity_type = 'inventory' 
                      GROUP BY entity_id
                  )
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
    },

    async getInventoryStatusSummary(req, res, next) {
        try {
            // 1. Current locations distribution
            const locationsDist = await db.query(`
                SELECT current_location as location, COUNT(*) as count 
                FROM inventory 
                WHERE status != 'deaccessioned'
                GROUP BY current_location
                ORDER BY count DESC
            `);

            // 2. Status distribution (active, maintenance, loan, storage, deaccessioned)
            const statusDist = await db.query(`
                SELECT status, COUNT(*) as count 
                FROM inventory 
                GROUP BY status
            `);

            // 3. Movement volume (moves in the last 30 days)
            const [recentMoves] = await db.query(`
                SELECT COUNT(*) as count 
                FROM location_history 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `);

            res.status(200).json({
                status: 'success',
                data: {
                    locationsDistribution: locationsDist,
                    statusDistribution: statusDist,
                    recentMovementVolume: recentMoves.count
                }
            });
        } catch (error) { next(error); }
    },

    async getAuditStatistics(req, res, next) {
        try {
            // 1. Overall Audit Check Results (last 12 months)
            const auditResults = await db.query(`
                SELECT 
                    SUM(CASE WHEN object_found = 1 THEN 1 ELSE 0 END) as foundCount,
                    SUM(CASE WHEN object_found = 0 THEN 1 ELSE 0 END) as missingCount,
                    SUM(CASE WHEN location_verified = 0 THEN 1 ELSE 0 END) as locationMismatches,
                    SUM(CASE WHEN condition_consistent = 0 THEN 1 ELSE 0 END) as conditionChanged,
                    COUNT(*) as totalAudits
                FROM inventory_audits
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            `);

            // 2. Overdue Audits Count
            // Items not audited in over a year
            const [overdueCount] = await db.query(`
                SELECT COUNT(*) as count
                FROM inventory
                WHERE status != 'deaccessioned'
                  AND (last_audit_date IS NULL OR last_audit_date < DATE_SUB(NOW(), INTERVAL 365 DAY))
            `);

            res.status(200).json({
                status: 'success',
                data: {
                    last12Months: auditResults[0] || {
                        foundCount: 0, missingCount: 0, locationMismatches: 0, conditionChanged: 0, totalAudits: 0
                    },
                    overdueAudits: overdueCount.count
                }
            });
        } catch (error) { next(error); }
    },

    async getUmamiAnalytics(req, res, next) {
        try {
            const { period = '7d' } = req.query;
            const data = await umamiService.getWebsiteAnalytics(period);
            res.status(200).json({
                status: 'success',
                data: {
                    ...data,
                    dashboardUrl: env.umami.url ? `${env.umami.url.replace(/\/$/, '')}/websites/${env.umami.websiteId}` : ''
                }
            });
        } catch (error) {
            logger.error(`[Analytics] Failed to fetch Umami stats: ${error.message}`);
            // Return empty graceful response instead of failing
            res.status(200).json({
                status: 'success',
                data: {
                    period: req.query.period || '7d',
                    stats: {
                        pageviews: { value: 0, change: 0 },
                        visitors: { value: 0, change: 0 },
                        visits: { value: 0, change: 0 },
                        bounces: { value: 0, change: 0 },
                        totaltime: { value: 0, change: 0 }
                    },
                    pageviews: { pageviews: [], sessions: [] },
                    urls: [],
                    referrers: [],
                    devices: [],
                    dashboardUrl: env.umami.url ? `${env.umami.url.replace(/\/$/, '')}/websites/${env.umami.websiteId}` : ''
                }
            });
        }
    },

    async getFeedbackStats(req, res, next) {
        try {
            const submissions = await db.query(`
                SELECT fs.id, fs.data, fs.created_at, fs.submitted_email
                FROM form_submissions fs
                JOIN form_definitions fd ON fs.form_id = fd.id
                WHERE fd.type = 'feedback' OR fd.slug = 'user-feedback'
                ORDER BY fs.created_at DESC
            `);

            let total = 0;
            let sumRating = 0;
            const ratingsDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            const categoryDistribution = {
                'Website Experience': 0,
                'Museum Visit': 0,
                'Visitor Services': 0,
                'Other': 0
            };
            const recentComments = [];

            for (const sub of submissions) {
                let data = {};
                try {
                    data = typeof sub.data === 'string' ? JSON.parse(sub.data) : (sub.data || {});
                } catch (e) {
                    data = sub.data || {};
                }

                const rating = parseInt(data.rating, 10);
                if (!isNaN(rating) && rating >= 1 && rating <= 5) {
                    ratingsDistribution[rating]++;
                    sumRating += rating;
                }
                total++;

                const category = data.feedback_type || 'Other';
                categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;

                if (recentComments.length < 10 && data.comments) {
                    recentComments.push({
                        id: sub.id,
                        name: data.name || 'Anonymous',
                        email: sub.submitted_email || data.email || 'Anonymous',
                        rating: rating || 0,
                        category: category,
                        comments: data.comments,
                        created_at: sub.created_at
                    });
                }
            }

            const averageRating = total > 0 && sumRating > 0 ? parseFloat((sumRating / total).toFixed(2)) : 0;

            res.status(200).json({
                status: 'success',
                data: {
                    totals: {
                        feedbackSubmissions: total,
                        averageRating
                    },
                    distributions: {
                        ratings: Object.entries(ratingsDistribution).map(([rating, count]) => ({
                            rating: parseInt(rating),
                            count
                        })),
                        categories: Object.entries(categoryDistribution).map(([name, count]) => ({
                            name,
                            count
                        }))
                    },
                    recentComments
                }
            });
        } catch (error) {
            next(error);
        }
    },

    async getDashboardStats(req, res, next) {
        try {
            // 1. Total Artifacts
            const [totalResult] = await db.query('SELECT COUNT(*) as count FROM inventory');

            // 2. Acquired Artifacts (method != 'Loan')
            const [acquiredResult] = await db.query(`
                SELECT COUNT(*) as count 
                FROM inventory i 
                JOIN accessions a ON i.accession_id = a.id 
                JOIN intakes jt ON a.intake_id = jt.id 
                WHERE jt.acquisition_method != 'Loan'
            `);

            // 3. Borrowed Artifacts (method = 'Loan')
            const [borrowedResult] = await db.query(`
                SELECT COUNT(*) as count 
                FROM inventory i 
                JOIN accessions a ON i.accession_id = a.id 
                JOIN intakes jt ON a.intake_id = jt.id 
                WHERE jt.acquisition_method = 'Loan'
            `);

            // 4. Displayed Artifacts (in active exhibitions)
            const [displayedResult] = await db.query(`
                SELECT COUNT(DISTINCT ea.inventory_id) as count 
                FROM exhibition_artifacts ea
                JOIN exhibitions e ON ea.exhibition_id = e.id
                WHERE e.status = 'active'
            `);
            let displayedCount = displayedResult?.count || 0;
            if (displayedCount === 0) {
                // Fallback: active status in inventory
                const [activeResult] = await db.query(`SELECT COUNT(*) as count FROM inventory WHERE status = 'active'`);
                displayedCount = activeResult?.count || 0;
            }

            // 5. Visitor Quota (Today's visitor stats)
            const [quotaResult] = await db.query(`
                SELECT SUM(population_count) as total 
                FROM appointments 
                WHERE status IN ('APPROVED', 'COMPLETED') 
                  AND (preferred_date = CURDATE() OR preferred_date = DATE_FORMAT(NOW(), '%Y-%m-%d'))
            `);
            const todayCount = parseInt(quotaResult?.total || 0, 10);
            const quotaLimit = 1000;

            // 6. Unread Queries (Recent pending submissions)
            const unreadQueries = await db.query(`
                SELECT fs.id, fs.created_at, fd.title, fd.type, fd.slug, fs.data
                FROM form_submissions fs
                JOIN form_definitions fd ON fs.form_id = fd.id
                WHERE fs.status = 'pending'
                ORDER BY fs.created_at DESC
                LIMIT 10
            `);

            // 7. Active Exhibition (For middle layout card)
            const activeExhibitions = await db.query(`
                SELECT id, title, venue, start_date, end_date, description
                FROM exhibitions
                WHERE status = 'active'
                ORDER BY start_date DESC
                LIMIT 1
            `);

            res.status(200).json({
                status: 'success',
                data: {
                    totals: {
                        artifacts: totalResult?.count || 0,
                        acquired: acquiredResult?.count || 0,
                        borrowed: borrowedResult?.count || 0,
                        displayed: displayedCount
                    },
                    visitorQuota: {
                        todayCount,
                        limit: quotaLimit,
                        percentage: Math.min(100, Math.round((todayCount / quotaLimit) * 100))
                    },
                    unreadQueries: unreadQueries.map(q => {
                        let parsedData = {};
                        try {
                            parsedData = typeof q.data === 'string' ? JSON.parse(q.data) : (q.data || {});
                        } catch (e) {
                            parsedData = q.data || {};
                        }
                        return {
                            id: q.id,
                            title: q.title,
                            type: q.type,
                            slug: q.slug,
                            created_at: q.created_at,
                            name: parsedData.name || parsedData.firstName ? `${parsedData.firstName || parsedData.name || ''} ${parsedData.lastName || ''}`.trim() : null,
                            email: parsedData.email || null
                        };
                    }),
                    activeExhibition: activeExhibitions[0] || null
                }
            });
        } catch (error) {
            next(error);
        }
    },

    async getOverviewStats(req, res, next) {
        try {
            // Aggregate totals from database
            const [inventoryCount] = await db.query("SELECT COUNT(*) as count FROM inventory");
            const [accessionCount] = await db.query("SELECT COUNT(*) as count FROM accessions");
            const [intakeCount] = await db.query("SELECT COUNT(*) as count FROM intakes");
            const [appointmentCount] = await db.query("SELECT COUNT(*) as count FROM appointments");
            const [schedulesCount] = await db.query("SELECT COUNT(*) as count FROM schedules");
            const [submissionsCount] = await db.query("SELECT COUNT(*) as count FROM form_submissions");
            
            // Total valuation estimate of current active inventory (sum of latest valuations)
            const [valuationSum] = await db.query(`
                SELECT SUM(amount) as total
                FROM valuations
                WHERE id IN (
                    SELECT MAX(id) FROM valuations GROUP BY inventory_id
                )
            `);

            // Fetch from Payload CMS
            let articlesCount = 0;
            let mediaCount = 0;
            try {
                const cmsUrl = env.cmsUrl.replace(/\/$/, '');
                const articlesRes = await fetch(`${cmsUrl}/api/articles?limit=1`, { signal: AbortSignal.timeout(2000) });
                if (articlesRes.ok) {
                    const data = await articlesRes.json();
                    articlesCount = data.totalDocs || 0;
                }
                const mediaRes = await fetch(`${cmsUrl}/api/media?limit=1`, { signal: AbortSignal.timeout(2000) });
                if (mediaRes.ok) {
                    const data = await mediaRes.json();
                    mediaCount = data.totalDocs || 0;
                }
            } catch (err) {
                logger.warn(`[Analytics] Failed to fetch CMS stats: ${err.message}`);
            }

            res.status(200).json({
                status: 'success',
                data: {
                    totals: {
                        inventory: inventoryCount.count || 0,
                        accessions: accessionCount.count || 0,
                        intakes: intakeCount.count || 0,
                        appointments: appointmentCount.count || 0,
                        schedules: schedulesCount.count || 0,
                        submissions: submissionsCount.count || 0,
                        articles: articlesCount,
                        cmsMedia: mediaCount,
                        estimatedValue: valuationSum.total || 0
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
};
