import cron from 'node-cron';
import { pbService } from './pocketbaseService.js';
import { logger } from '../utils/logger.js';

/**
 * MaintenanceService
 * 
 * Automates database health checks and data integrity tasks.
 * Scheduled to run during low-traffic hours (3:00 AM).
 */
export const maintenanceService = {
    /**
     * Start the scheduled maintenance cycle
     */
    init() {
        // Run every day at 3:00 AM
        cron.schedule('0 3 * * *', () => {
            logger.info('Starting automated database maintenance cycle...');
            this.runCleanup();
        });
        
        logger.info('Database Maintenance Service initialized (Schedule: 0 3 * * *)');
    },

    /**
     * Orchestrates all cleanup tasks
     */
    async runCleanup() {
        try {
            await this.cleanupOrphanedSubmissions();
            await this.cleanupDuplicateIntakeLinks();
            await this.cleanupOrphanedDonationItems();
            logger.info('Database maintenance cycle completed successfully.');
        } catch (error) {
            logger.error('Database maintenance cycle failed', { error: error.message });
        }
    },

    /**
     * TASK 1: Orphaned Submissions
     * Removes form submissions > 30 days old that never became intakes.
     */
    async cleanupOrphanedSubmissions() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        try {
            // 1. Get all submissions older than 30 days
            const staleSubmissions = await pbService.pb.collection('form_submissions').getFullList({
                filter: `created < "${thirtyDaysAgo}"`
            });

            if (staleSubmissions.length === 0) return;

            // 2. Cross-reference with intakes
            const intakes = await pbService.pb.collection('intakes').getFullList({
                fields: 'submission_id'
            });
            const activeSubmissionIds = new Set(intakes.map(i => i.submission_id));

            let deletedCount = 0;
            for (const sub of staleSubmissions) {
                if (!activeSubmissionIds.has(sub.id)) {
                    await pbService.pb.collection('form_submissions').delete(sub.id);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                logger.info(`Cleanup: Purged ${deletedCount} orphaned submissions older than 30 days.`);
            }
        } catch (err) {
            logger.error('Failed to cleanup orphaned submissions', { error: err.message });
        }
    },

    /**
     * TASK 2: Duplicate Intake Links
     * Ensures each submission_id and donation_item_id is only linked to ONE intake.
     */
    async cleanupDuplicateIntakeLinks() {
        try {
            const intakes = await pbService.pb.collection('intakes').getFullList({
                sort: 'created' // Get oldest first
            });

            const seenSubmissions = new Set();
            const seenItems = new Set();
            let deletedCount = 0;

            for (const intake of intakes) {
                let isDuplicate = false;

                if (intake.submission_id && seenSubmissions.has(intake.submission_id)) {
                    isDuplicate = true;
                }
                if (intake.donation_item_id && seenItems.has(intake.donation_item_id)) {
                    isDuplicate = true;
                }

                if (isDuplicate) {
                    await pbService.pb.collection('intakes').delete(intake.id);
                    deletedCount++;
                } else {
                    if (intake.submission_id) seenSubmissions.add(intake.submission_id);
                    if (intake.donation_item_id) seenItems.add(intake.donation_item_id);
                }
            }

            if (deletedCount > 0) {
                logger.info(`Cleanup: Resolved ${deletedCount} duplicate intake links (deconfliction).`);
            }
        } catch (err) {
            logger.error('Failed to cleanup duplicate links', { error: err.message });
        }
    },

    /**
     * TASK 3: Orphaned Donation Items
     * Removes items that aren't linked to any intake.
     */
    async cleanupOrphanedDonationItems() {
        try {
            const items = await pbService.pb.collection('donation_items').getFullList();
            const intakes = await pbService.pb.collection('intakes').getFullList({
                fields: 'donation_item_id'
            });
            const activeItemIds = new Set(intakes.map(i => i.donation_item_id));

            let deletedCount = 0;
            for (const item of items) {
                if (!activeItemIds.has(item.id)) {
                    await pbService.pb.collection('donation_items').delete(item.id);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                logger.info(`Cleanup: Purged ${deletedCount} orphaned donation items.`);
            }
        } catch (err) {
            logger.error('Failed to cleanup orphaned donation items', { error: err.message });
        }
    }
};
