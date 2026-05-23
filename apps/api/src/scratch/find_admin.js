import * as mariadb from 'mariadb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'apps/api/.env' });

const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'bing',
    database: process.env.DB_NAME || 'scratch',
    connectionLimit: 1
});

async function findAdmin() {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT email, role FROM users WHERE role = 'admin' LIMIT 1");
        console.log("Admin Users:", JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

findAdmin();
