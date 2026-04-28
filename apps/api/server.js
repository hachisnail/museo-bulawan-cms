import { createServer } from 'http';
import app from './src/app.js';
import { env } from './src/config/env.js';
import { pbService } from './src/services/pocketbaseService.js'; 
import { minioService } from './src/services/minioService.js'; // <-- 1. Import it

const startServer = async () => {
    const PORT = env.port;

    // 2. Initialize MinIO first so the bucket exists
    if (env.minio.enabled) {
        await minioService.initialize();
    }

    // 3. Then initialize PocketBase (which relies on that bucket)
    if (env.pb.url) {
        await pbService.initialize();
    }

    const httpServer = createServer(app);

    httpServer.listen(PORT, () => {
        console.log(`API running on port ${PORT} in ${env.isProd ? 'production' : 'development'} mode`);
    });
};

startServer();