import { createServer } from 'http';
import app from './src/app.js';
import { env } from './src/config/env.js';
import { pbService } from './src/services/pocketbaseService.js'; 
import { minioService } from './src/services/minioService.js';
import { initMariaDB } from './src/config/dbInit.js';
import { maintenanceService } from './src/services/maintenanceService.js';

const startServer = async () => {
    const PORT = env.port;

    // 1. Initialize MinIO first so the bucket exists
    if (env.minio.enabled) {
        await minioService.initialize();
    }

    // 2. Then initialize PocketBase (which relies on that bucket)
    if (env.pb.url) {
        await pbService.initialize();
    }

    // 3. Initialize all MariaDB tables (users, sequences)
    await initMariaDB();

    // 4. Start maintenance cron jobs
    maintenanceService.init();

    const httpServer = createServer(app);

    httpServer.listen(PORT, () => {
        console.log(`API running on port ${PORT} in ${env.isProd ? 'production' : 'development'} mode`);
    });
};

startServer();