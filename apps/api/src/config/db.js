import * as mariadb from 'mariadb';
import { env } from './env.js';
import { appEvents } from '../utils/eventBus.js';

const pool = mariadb.createPool({
    host: env.db.host,
    user: env.db.user,
    password: env.db.pass,
    database: env.db.name,
    connectionLimit: 5
});

export const db = {
    async query(sql, params = [], connection = null) {
        let conn = connection;
        let shouldRelease = false;
        try {
            if (!conn) {
                conn = await pool.getConnection();
                shouldRelease = true;
            }
            const result = await conn.query(sql, params);
            return result;
        } catch (error) {
            console.error(`[DB Query Error] ${sql}:`, error.message);
            throw error; 
        } finally {
            if (conn && shouldRelease) conn.release();
        }
    },
    async getConnection() {
        return await pool.getConnection();
    },
    /**
     * transaction
     * Runs a set of queries in a single transaction.
     * @param {Function} callback - async (tx) => { ... } where tx is a db-like object
     */
    async transaction(callback) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            
            // Create a proxy of 'db' that uses this connection
            const tx = {
                query: (sql, params) => this.query(sql, params, conn),
                insertRecord: (table, data) => this.insertRecord(table, data, conn),
                updateRecord: (table, id, data) => this.updateRecord(table, id, data, conn),
                executeAndBroadcast: (sql, params, action, resource, resourceId) => 
                    this.executeAndBroadcast(sql, params, action, resource, resourceId, conn)
            };

            const result = await callback(tx);
            await conn.commit();
            return result;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    },
    /**
     * Executes a query and emits a change event to the global event bus.
     * Useful for SSE triggers.
     */
    
    async insertRecord(table, data, connection = null) {
        // Prepare JSON strings for objects/arrays
        const processedData = {};
        for (const [k, v] of Object.entries(data)) {
            processedData[k] = (typeof v === 'object' && v !== null && !(v instanceof Date)) 
                ? JSON.stringify(v, (key, value) => typeof value === 'bigint' ? value.toString() : value) 
                : v;
        }

        const keys = Object.keys(processedData);
        const values = Object.values(processedData);
        const placeholders = keys.map(() => '?').join(', ');
        
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        await this.executeAndBroadcast(sql, values, 'create', table, data.id, connection);
        
        return processedData;
    },
    async updateRecord(table, id, data, connection = null) {
        const processedData = {};
        for (const [k, v] of Object.entries(data)) {
            if (k === 'id') continue;
            processedData[k] = (typeof v === 'object' && v !== null && !(v instanceof Date)) 
                ? JSON.stringify(v, (key, value) => typeof value === 'bigint' ? value.toString() : value) 
                : v;
        }

        const keys = Object.keys(processedData);
        const values = Object.values(processedData);
        const assignments = keys.map(k => `${k} = ?`).join(', ');
        
        const sql = `UPDATE ${table} SET ${assignments} WHERE id = ?`;
        await this.executeAndBroadcast(sql, [...values, id], 'update', table, id, connection);
        
        return { id, ...processedData };
    },
    async executeAndBroadcast(sql, params, action, resource, resourceId, connection = null) {
        const result = await this.query(sql, params, connection);
        
        // Fetch the updated/inserted record if we have an ID
        let record = null;
        if (resourceId) {
            try {
                const rows = await this.query(`SELECT * FROM ${resource} WHERE id = ?`, [resourceId], connection);
                record = rows[0]; // Result from query on a table is typically rows array
            } catch (e) {
                console.warn(`Could not fetch newly mutated record ${resourceId} for SSE`);
            }
        }

        // Broadcast to SSE Manager
        appEvents.emit('db_change', { action, resource, record });
        return result;
    }
};