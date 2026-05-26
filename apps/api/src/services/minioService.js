import * as Minio from 'minio';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Create and export the client so other files can use it
let minioClient = null;

if (env.minio.enabled) {
    const endpointUrl = new URL(env.minio.endpoint);
    minioClient = new Minio.Client({
        endPoint: endpointUrl.hostname,
        port: parseInt(endpointUrl.port, 10) || (endpointUrl.protocol === 'https:' ? 443 : 9000),
        useSSL: endpointUrl.protocol === 'https:',
        accessKey: env.minio.accessKey,
        secretKey: env.minio.secret
    });
}

export { minioClient };

export const minioService = {
    async initialize(retries = 10, delayMs = 2000) {
        if (!env.minio.enabled || !minioClient) return;

        for (let i = 0; i < retries; i++) {
            try {
                const bucketName = env.minio.bucket;

                const exists = await minioClient.bucketExists(bucketName);
                if (exists) {
                    logger.info(`MinIO bucket '${bucketName}' already exists. Ready.`);
                    return;
                }

                logger.warn(`MinIO bucket '${bucketName}' not found. Auto-provisioning...`);
                await minioClient.makeBucket(bucketName, env.minio.region || 'us-east-1');
                
                logger.info(`Successfully auto-provisioned Private MinIO bucket '${bucketName}'!`);
                return; // Success, exit the loop
            } catch (error) {
                if (i === retries - 1) {
                    logger.error('Failed to auto-provision MinIO bucket after multiple attempts. Ensure MinIO is running if you need file uploads.', { error: error.message });
                    return; 
                }
                logger.warn(`MinIO connection failed (attempt ${i + 1}/${retries}). Retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
};