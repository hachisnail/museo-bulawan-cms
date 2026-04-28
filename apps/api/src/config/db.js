

import * as mariadb from 'mariadb';
import { env } from './env.js';

const pool = mariadb.createPool({
    host: env.db.host,
    user: env.db.user,
    password: env.db.pass,
    database: env.db.name,
    connectionLimit: 5
});

export const db = {
    async query(sql, params = []) {
        let conn;
        try {
            conn = await pool.getConnection();
            
            const result = await conn.query(sql, params);
            return result;
            
        } catch (error) {
            console.error(`[DB Query Error] ${sql}:`, error.message);
            throw error; 
            
        } finally {
            if (conn) conn.release();
        }
    }
};