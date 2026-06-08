// ─── No-Show Appointment Scheduler ───────────────────────────────────────────
// Runs daily at midnight (Philippine Standard Time).
// Any appointment that was APPROVED but the preferred_date has already passed
// and no present_count was recorded (visitor never arrived) is automatically
// marked FAILED.

import cron from 'node-cron';
import { db } from '../config/db.js';
import { appEvents } from '../utils/eventBus.js';
import { logger } from '../utils/logger.js';

/**
 * Starts the daily cron job that auto-fails no-show appointments.
 * Call once on server startup.
 */
export const startNoShowScheduler = () => {
    // Run every day at 00:00 Philippine Standard Time
    cron.schedule('0 0 * * *', async () => {
        const startTime = Date.now();
        try {
            // Find APPROVED appointments whose preferred_date is strictly before today
            // and that have no present_count recorded (visitor never arrived)
            const missed = await db.query(
                `SELECT id FROM appointments
                 WHERE status = 'APPROVED'
                   AND preferred_date < CURDATE()
                   AND present_count IS NULL`
            );

            if (!missed.length) return;

            for (const appt of missed) {
                await db.query(
                    `UPDATE appointments
                     SET status = 'FAILED', updated_at = NOW()
                     WHERE id = ?`,
                    [appt.id]
                );
                // Emit SSE events so the admin panel refreshes in real time
                appEvents.emit('db_change', { resource: 'Appointment',       action: 'update', id: appt.id, status: 'FAILED' });
                appEvents.emit('db_change', { resource: 'AppointmentStatus', action: 'update', id: appt.id, status: 'FAILED' });
            }

            const execMs = Date.now() - startTime;
            const phTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
            logger.info(
                `[No-Show Scheduler] [${phTime} PST] Marked ${missed.length} appointment(s) as FAILED | ${execMs}ms`
            );
        } catch (err) {
            logger.error('[No-Show Scheduler] Error auto-failing missed appointments:', err);
        }
    }, { timezone: 'Asia/Manila' });

    logger.info('[No-Show Scheduler] Started — runs daily at 00:00 PST');
};
