import { db } from '../src/config/db.js';

async function run() {
    try {
        const rows = await db.query('SELECT id, title, slug FROM form_definitions');
        console.log(rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
