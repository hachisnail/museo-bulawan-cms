import * as mariadb from 'mariadb';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config({ path: 'apps/api/.env' });

const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'bing',
    database: process.env.DB_NAME || 'scratch',
    connectionLimit: 1
});

async function resetAdmin() {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT id, username, email FROM users WHERE role = 'admin' LIMIT 1");
        
        if (rows.length === 0) {
            console.log("No admin user found.");
            return;
        }

        const admin = rows[0];
        const newPassword = "Password123!";
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await conn.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, admin.id]);
        
        console.log("Admin account reset successfully.");
        console.log("Username: " + admin.username);
        console.log("Password: " + newPassword);
    } catch (err) {
        console.error(err);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

resetAdmin();
