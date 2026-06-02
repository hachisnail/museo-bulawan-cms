import { initMariaDB } from '../src/config/dbInit.js';
import { db } from '../src/config/db.js';

async function run() {
    try {
        console.log("Running initMariaDB()...");
        await initMariaDB();
        console.log("Success!");
    } catch (e) {
        console.error("Failed:", e);
    } finally {
        process.exit();
    }
}

run();
