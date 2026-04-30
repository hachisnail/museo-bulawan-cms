import { db } from '../src/config/db.js';
import { maintenanceService } from '../src/services/maintenanceService.js';

async function fullMaintenance() {
    try {
        console.log('Starting full maintenance cycle...');
        
        const beforeMedia = await db.query('SELECT COUNT(*) as count FROM media_metadata');
        const beforeSubmissions = await db.query('SELECT COUNT(*) as count FROM form_submissions');
        
        console.log(`Before: Submissions=${beforeSubmissions[0].count}, Media=${beforeMedia[0].count}`);

        await maintenanceService.runCleanup();

        const afterMedia = await db.query('SELECT COUNT(*) as count FROM media_metadata');
        const afterSubmissions = await db.query('SELECT COUNT(*) as count FROM form_submissions');
        
        console.log(`After: Submissions=${afterSubmissions[0].count}, Media=${afterMedia[0].count}`);

        process.exit(0);
    } catch (error) {
        console.error('Maintenance cycle failed:', error);
        process.exit(1);
    }
}

fullMaintenance();
