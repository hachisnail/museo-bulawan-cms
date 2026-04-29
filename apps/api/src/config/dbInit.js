import { db } from './db.js';
import { logger } from '../utils/logger.js';

/**
 * Initializes all required MariaDB tables if they do not exist.
 */
export async function initMariaDB() {
    try {
        // 1. Users Table (Core Auth / Legacy fallback)
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(26) PRIMARY KEY,
                fname VARCHAR(100),
                lname VARCHAR(100),
                email VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(100) UNIQUE,
                password VARCHAR(255),
                role VARCHAR(50) DEFAULT 'guest',
                status VARCHAR(20) DEFAULT 'active',
                current_session_id VARCHAR(255) NULL,
                action_token VARCHAR(255) NULL,
                action_token_expires DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 2. Sequences Table (for Accession & Catalog numbers)
        await db.query(`
            CREATE TABLE IF NOT EXISTS sequences (
                sequence_name VARCHAR(50) PRIMARY KEY,
                current_value BIGINT NOT NULL DEFAULT 0,
                reset_year SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Seed sequences if they don't exist
        await db.query(`INSERT IGNORE INTO sequences (sequence_name, current_value, reset_year) VALUES ('accession', 0, 0)`);
        await db.query(`INSERT IGNORE INTO sequences (sequence_name, current_value, reset_year) VALUES ('catalog', 0, 0)`);

        logger.info('MariaDB tables initialized successfully.');
    } catch (error) {
        logger.error('Failed to initialize MariaDB tables', { error: error.message });
        throw error;
    }
}
