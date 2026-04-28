import * as Minio from 'minio';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const minioService = {
    async initialize() {
        if (!env.minio.enabled) return;

        try {
            const endpointUrl = new URL(env.minio.endpoint);
            const minioClient = new Minio.Client({
                endPoint: endpointUrl.hostname,
                port: parseInt(endpointUrl.port, 10) || 9000,
                useSSL: endpointUrl.protocol === 'https:',
                accessKey: env.minio.accessKey,
                secretKey: env.minio.secret
            });

            const bucketName = env.minio.bucket;

            const exists = await minioClient.bucketExists(bucketName);
            if (exists) {
                logger.info(`MinIO bucket '${bucketName}' already exists. Ready.`);
                return;
            }

            logger.warn(`MinIO bucket '${bucketName}' not found. Auto-provisioning...`);
            await minioClient.makeBucket(bucketName, env.minio.region);

            // ==========================================
            // FIX: Removed the Public Read Policy. 
            // MinIO is now 100% Private by default!
            // ==========================================
            
            logger.info(`Successfully auto-provisioned Private MinIO bucket '${bucketName}'!`);

        } catch (error) {
            logger.error('Failed to auto-provision MinIO bucket', { error: error.message });
            throw error; 
        }
    }
};