import cron from 'node-cron';
import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { minioClient } from './minioService.js';
import { env } from '../config/env.js';

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
            await this.cleanupOrphanedMedia();
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
        try {
            // Find IDs of submissions older than 30 days that are NOT in the intakes table
            const orphans = await db.query(`
                SELECT s.id 
                FROM form_submissions s
                LEFT JOIN intakes i ON s.id = i.submission_id
                WHERE s.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
                AND i.id IS NULL
            `);

            if (!orphans || orphans.length === 0) return;

            const ids = orphans.map(o => o.id);
            const placeholders = ids.map(() => '?').join(', ');

            const result = await db.query(`DELETE FROM form_submissions WHERE id IN (${placeholders})`, ids);
            
            if (result.affectedRows > 0) {
                logger.info(`Cleanup: Purged ${result.affectedRows} orphaned submissions older than 30 days.`);
            }
        } catch (err) {
            logger.error('Failed to cleanup orphaned submissions', { error: err.message });
        }
    },

    /**
     * TASK 2: Duplicate Intake Links
     * Ensures each submission_id and donation_item_id is only linked to ONE intake.
     * Keeps the oldest record, deletes newer duplicates.
     */
    async cleanupDuplicateIntakeLinks() {
        try {
            // This is a more complex SQL query to find and delete duplicates
            // We keep the one with the smallest created_at (oldest)
            
            // 1. Resolve Submission ID duplicates
            const subDupes = await db.query(`
                DELETE i1 FROM intakes i1
                INNER JOIN intakes i2 
                WHERE i1.created_at > i2.created_at 
                AND i1.submission_id = i2.submission_id
                AND i1.submission_id IS NOT NULL
            `);

            // 2. Resolve Donation Item ID duplicates
            const itemDupes = await db.query(`
                DELETE i1 FROM intakes i1
                INNER JOIN intakes i2 
                WHERE i1.created_at > i2.created_at 
                AND i1.donation_item_id = i2.donation_item_id
                AND i1.donation_item_id IS NOT NULL
            `);

            const totalDeleted = (subDupes.affectedRows || 0) + (itemDupes.affectedRows || 0);

            if (totalDeleted > 0) {
                logger.info(`Cleanup: Resolved ${totalDeleted} duplicate intake links (deconfliction).`);
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
            const orphans = await db.query(`
                SELECT d.id 
                FROM donation_items d
                LEFT JOIN intakes i ON d.id = i.donation_item_id
                WHERE i.id IS NULL
            `);

            if (!orphans || orphans.length === 0) return;

            const ids = orphans.map(o => o.id);
            const placeholders = ids.map(() => '?').join(', ');

            const result = await db.query(`DELETE FROM donation_items WHERE id IN (${placeholders})`, ids);
            
            if (result.affectedRows > 0) {
                logger.info(`Cleanup: Purged ${result.affectedRows} orphaned donation items.`);
            }
        } catch (err) {
            logger.error('Failed to cleanup orphaned donation items', { error: err.message });
        }
    },

    /**
     * TASK 4: Orphaned Media
     * Purges media_metadata and physical MinIO files that are no longer linked to any entity.
     */
    async cleanupOrphanedMedia() {
        try {
            // Find media with NO links
            const orphans = await db.query(`
                SELECT m.id, m.storage_key 
                FROM media_metadata m
                LEFT JOIN media_links l ON m.id = l.media_id
                WHERE l.id IS NULL
            `);

            if (!orphans || orphans.length === 0) return;

            logger.info(`Cleanup: Found ${orphans.length} orphaned media items. Purging...`);

            for (const media of orphans) {
                try {
                    // 1. Delete from MinIO
                    await minioClient.removeObject(env.minio.bucket, media.storage_key);
                    
                    // 2. Delete from DB
                    await db.query(`DELETE FROM media_metadata WHERE id = ?`, [media.id]);
                } catch (err) {
                    logger.error(`Failed to purge media item ${media.id}`, { error: err.message });
                }
            }

            logger.info(`Cleanup: Successfully purged ${orphans.length} unreferenced media files.`);
        } catch (err) {
            logger.error('Failed to cleanup orphaned media', { error: err.message });
        }
    }
};
