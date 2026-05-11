/**
 * Accession & Catalog Number Generators
 * 
 * Accession Number Format: YYYY.SEQ.BATCH
 *   Example: 2026.001.01
 *
 * Catalog Number Format: CAT-YYYY-NNNNN
 *   Example: CAT-2026-00042
 *
 * Uses MariaDB LAST_INSERT_ID() for truly atomic sequence generation,
 * preventing duplicates even under concurrent access.
 */

import { db } from '../config/db.js';
import { logger } from './logger.js';

/**
 * Atomically increments a named sequence counter.
 * Resets to 1 at the start of each new year.
 * 
 * Uses LAST_INSERT_ID() to make the UPDATE + read atomic in a single
 * round-trip, eliminating the race condition where two concurrent requests
 * could read the same current_value between separate UPDATE and SELECT queries.
 * 
 * @param {string} name - Sequence name ('accession' or 'catalog')
 * @returns {Promise<{ year: number, seq: number }>}
 */
async function nextSequenceValue(name) {
    const currentYear = new Date().getFullYear();

    // Atomic: UPDATE sets LAST_INSERT_ID to the new value, which we read back
    // in the same connection context. No window for a concurrent reader to 
    // observe a stale value.
    await db.query(`
        UPDATE sequences 
        SET current_value = LAST_INSERT_ID(
            IF(reset_year = ?, current_value + 1, 1)
        ),
        reset_year = ?
        WHERE sequence_name = ?
    `, [currentYear, currentYear, name]);

    const rows = await db.query('SELECT LAST_INSERT_ID() as seq');
    const seq = Number(rows[0]?.seq || 1);
    return { year: currentYear, seq };
}

/**
 * Generates the next accession number.
 * Format: YYYY.SEQ.BATCH
 * 
 * @param {number} [batch=1] - Batch number (for multi-item donations)
 * @returns {Promise<string>} e.g. "2026.001.01"
 */
export async function generateAccessionNumber(batch = 1) {
    const { year, seq } = await nextSequenceValue('accession');
    const seqPadded = String(seq).padStart(3, '0');
    const batchPadded = String(batch).padStart(2, '0');
    return `${year}.${seqPadded}.${batchPadded}`;
}

/**
 * Generates the next catalog number.
 * Format: CAT-YYYY-NNNNN
 * 
 * @returns {Promise<string>} e.g. "CAT-2026-00042"
 */
export async function generateCatalogNumber() {
    const { year, seq } = await nextSequenceValue('catalog');
    const seqPadded = String(seq).padStart(5, '0');
    return `CAT-${year}-${seqPadded}`;
}
