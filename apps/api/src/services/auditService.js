import { db } from "../config/db.js";
import { ulid } from "ulid"; 
import { logger } from "../utils/logger.js";

export const auditService = {
    async log({ userId, action, resource, details = {}, ipAddress = null }) {
        try {
            // 2. Generate the ULID
            const logId = ulid();
            
            // 3. Include the 'id' in the INSERT statement
            const sql = `INSERT INTO audit_logs (id, user_id, action, resource, details, ip_address) 
                         VALUES (?, ?, ?, ?, ?, ?)`;
            await db.query(sql, [logId, userId, action, resource, JSON.stringify(details), ipAddress]);
        } catch (error) {
            logger.error("Failed to write to audit log", { error: error.message });
        }
    },

    async fetchAll() {
        return await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
    }
};