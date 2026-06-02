import { createServer } from 'http';
import app from './src/app.js';
import { env } from './src/config/env.js';
import { initMariaDB } from './src/config/dbInit.js';
import { maintenanceService } from './src/services/maintenanceService.js';
import fs from 'fs';
import path from 'path';

const startServer = async () => {
    const PORT = env.port;

    // 1. Ensure upload directory exists
    const mediaDir = path.join(env.uploadDir, 'media');
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
    }

    // 2. Initialize all MariaDB tables (now unified and replacing PocketBase!)
    await initMariaDB();

    // 3. Start maintenance cron jobs
    maintenanceService.init();

    const httpServer = createServer(app);

    httpServer.listen(PORT, () => {
        console.log(`API running on port ${PORT} in ${env.isProd ? 'production' : 'development'} mode`);
    });
};

startServer();