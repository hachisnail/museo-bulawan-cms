import { db } from '../src/config/db.js';

async function fix() {
    try {
        console.log("Running manual migration for signed_moa...");
        await db.query(`ALTER TABLE accessions ADD COLUMN signed_moa BOOLEAN DEFAULT FALSE AFTER status`);
        console.log("Migration successful.");
    } catch (e) {
        console.error("Migration failed or already applied:", e.message);
    }
    process.exit(0);
}

fix();
